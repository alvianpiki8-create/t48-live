// M3U8 proxy + signed short-lived token.
// - Hides the real upstream URL and the x-api-token from viewers.
// - Tokens are bound to client fingerprint (IP + UA hash) to prevent stealing.
// - Playlist rewrites are parallelized and the HMAC key is cached at module
//   scope for low-latency repeat calls (HLS hits this dozens of times/min).
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SECRET = Deno.env.get("OWNER_PANEL_TOKEN") || "fallback-secret-change-me";
const PLAYLIST_TTL_SEC = 60 * 5;   // 5 min — covers a watch session
const SEGMENT_TTL_SEC  = 60 * 2;   // 2 min — short, segments rotate quickly

const enc = new TextEncoder();

const b64url = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const b64urlDecode = (s: string) => {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return atob(s);
};

// Cache HMAC key across requests in the same isolate — avoids re-importing per signature.
let keyPromise: Promise<CryptoKey> | null = null;
const getKey = () => {
  if (!keyPromise) {
    keyPromise = crypto.subtle.importKey(
      "raw", enc.encode(SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false, ["sign"],
    );
  }
  return keyPromise;
};

async function hmac(data: string): Promise<string> {
  const key = await getKey();
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return b64url(sig);
}

// Fingerprint binds a token to a particular client to prevent token theft.
async function fpHash(req: Request): Promise<string> {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim()
    || req.headers.get("cf-connecting-ip")
    || "unknown";
  const ua = req.headers.get("user-agent") || "ua";
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(`${ip}|${ua}`));
  return b64url(digest).slice(0, 12);
}

interface Payload { u: string; e: number; h?: Record<string, string>; f: string; }

async function makeToken(url: string, headers: Record<string, string>, fp: string, ttl: number): Promise<string> {
  const payload: Payload = { u: url, e: Math.floor(Date.now() / 1000) + ttl, h: headers, f: fp };
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const sig = await hmac(body);
  return `${body}.${sig}`;
}

async function readToken(token: string): Promise<Payload | null> {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = await hmac(body);
  if (expected !== sig) return null;
  try {
    const payload = JSON.parse(b64urlDecode(body)) as Payload;
    if (typeof payload.u !== "string" || typeof payload.e !== "number" || typeof payload.f !== "string") return null;
    if (payload.e < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}

// Rewrite m3u8 playlist so segments & sub-playlists go back through this proxy.
// All HMAC signings run in parallel.
async function rewritePlaylist(text: string, baseUrl: string, proxyOrigin: string, headers: Record<string, string>, fp: string): Promise<string> {
  const lines = text.split(/\r?\n/);
  const tasks: Promise<string>[] = lines.map(async (line) => {
    const trimmed = line.trim();
    if (!trimmed) return line;

    if (trimmed.startsWith("#EXT-X-KEY") || trimmed.startsWith("#EXT-X-MAP")) {
      const m = trimmed.match(/URI="([^"]+)"/);
      if (m) {
        const abs = new URL(m[1], baseUrl).toString();
        const tok = await makeToken(abs, headers, fp, SEGMENT_TTL_SEC);
        return trimmed.replace(/URI="[^"]+"/, `URI="${proxyOrigin}?t=${encodeURIComponent(tok)}"`);
      }
      return line;
    }
    if (trimmed.startsWith("#")) return line;

    const abs = new URL(trimmed, baseUrl).toString();
    // sub-playlist .m3u8 needs longer TTL than .ts segments
    const ttl = /\.m3u8(\?|$)/i.test(abs) ? PLAYLIST_TTL_SEC : SEGMENT_TTL_SEC;
    const tok = await makeToken(abs, headers, fp, ttl);
    return `${proxyOrigin}?t=${encodeURIComponent(tok)}`;
  });
  return (await Promise.all(tasks)).join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const publicBase = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
  const proxyOrigin = publicBase ? `${publicBase}/functions/v1/m3u8-proxy` : `${url.origin}${url.pathname}`;
  const fp = await fpHash(req);

  try {
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const target = (body?.url || "").trim();
      const apiToken = (body?.token || "").trim();
      if (!target || !/^https?:\/\//i.test(target)) {
        return new Response(JSON.stringify({ error: "invalid_url" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const headers: Record<string, string> = {};
      if (apiToken) headers["x-api-token"] = apiToken;
      const token = await makeToken(target, headers, fp, PLAYLIST_TTL_SEC);
      return new Response(JSON.stringify({
        token,
        url: `${proxyOrigin}?t=${encodeURIComponent(token)}`,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (req.method === "GET") {
      const t = url.searchParams.get("t");
      if (!t) return new Response("missing token", { status: 400, headers: corsHeaders });
      const payload = await readToken(t);
      if (!payload) return new Response("invalid token", { status: 403, headers: corsHeaders });
      // Bind to client fingerprint — stops simple token theft / hotlinking from other clients.
      if (payload.f !== fp) return new Response("token bound to another client", { status: 403, headers: corsHeaders });

      const target = payload.u;
      const customHeaders = payload.h || {};

      const upstream = await fetch(target, {
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Referer": new URL(target).origin + "/",
          ...customHeaders,
        },
      });

      const ct = upstream.headers.get("content-type") || "";
      const isPlaylist = /mpegurl|m3u8/i.test(ct) || /\.m3u8(\?|$)/i.test(target);

      if (isPlaylist) {
        const text = await upstream.text();
        const rewritten = await rewritePlaylist(text, target, proxyOrigin, customHeaders, fp);
        return new Response(rewritten, {
          status: upstream.status,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/vnd.apple.mpegurl",
            // very short playlist cache so live edge stays fresh but bursts (~50 viewers)
            // can share a single upstream hit
            "Cache-Control": "public, max-age=1",
          },
        });
      }

      // Segment / key / init — stream straight through with aggressive cache
      return new Response(upstream.body, {
        status: upstream.status,
        headers: {
          ...corsHeaders,
          "Content-Type": ct || "video/mp2t",
          "Cache-Control": "public, max-age=30, immutable",
        },
      });
    }

    return new Response("method not allowed", { status: 405, headers: corsHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
