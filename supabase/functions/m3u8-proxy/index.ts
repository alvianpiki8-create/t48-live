// M3U8 proxy + signed short-lived token.
// Hides the real M3U8 URL from viewers. Returns a signed token that expires in 5 min.
// Two endpoints:
//   POST /m3u8-proxy  body { url } -> { token }   (called by frontend on player init)
//   GET  /m3u8-proxy?t=<token>      -> proxied playlist/segment (called by HLS)
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const SECRET = Deno.env.get("OWNER_PANEL_TOKEN") || "fallback-secret-change-me";
const TOKEN_TTL_SEC = 60 * 10; // 10 min

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

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return b64url(sig);
}

async function makeToken(url: string, headers: Record<string, string> = {}, ttl = TOKEN_TTL_SEC): Promise<string> {
  const payload = { u: url, e: Math.floor(Date.now() / 1000) + ttl, h: headers };
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const sig = await hmac(body);
  return `${body}.${sig}`;
}

async function readToken(token: string): Promise<{ url: string; headers: Record<string, string> } | null> {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = await hmac(body);
  if (expected !== sig) return null;
  try {
    const payload = JSON.parse(b64urlDecode(body));
    if (typeof payload.u !== "string" || typeof payload.e !== "number") return null;
    if (payload.e < Math.floor(Date.now() / 1000)) return null;
    return { url: payload.u, headers: payload.h && typeof payload.h === "object" ? payload.h : {} };
  } catch {
    return null;
  }
}

// Rewrite m3u8 playlist so segment & sub-playlist URLs go back through this proxy
async function rewritePlaylist(text: string, baseUrl: string, proxyOrigin: string, headers: Record<string, string>): Promise<string> {
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) { out.push(line); continue; }

    if (trimmed.startsWith("#EXT-X-KEY") || trimmed.startsWith("#EXT-X-MAP")) {
      const m = trimmed.match(/URI="([^"]+)"/);
      if (m) {
        const abs = new URL(m[1], baseUrl).toString();
        const tok = await makeToken(abs, headers);
        const proxied = `${proxyOrigin}?t=${encodeURIComponent(tok)}`;
        out.push(trimmed.replace(/URI="[^"]+"/, `URI="${proxied}"`));
        continue;
      }
    }

    if (trimmed.startsWith("#")) { out.push(line); continue; }

    const abs = new URL(trimmed, baseUrl).toString();
    const tok = await makeToken(abs, headers);
    out.push(`${proxyOrigin}?t=${encodeURIComponent(tok)}`);
  }
  return out.join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const publicBase = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
  const proxyOrigin = publicBase ? `${publicBase}/functions/v1/m3u8-proxy` : `${url.origin}${url.pathname}`;

  try {
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const target = (body?.url || "").trim();
      if (!target || !/^https?:\/\//i.test(target)) {
        return new Response(JSON.stringify({ error: "invalid_url" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const token = await makeToken(target);
      const proxied = `${proxyOrigin}?t=${encodeURIComponent(token)}`;
      return new Response(JSON.stringify({ token, url: proxied }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "GET") {
      const t = url.searchParams.get("t");
      if (!t) return new Response("missing token", { status: 400, headers: corsHeaders });
      const target = await readToken(t);
      if (!target) return new Response("invalid token", { status: 403, headers: corsHeaders });

      const upstream = await fetch(target, {
        headers: { "User-Agent": "Mozilla/5.0", "Referer": new URL(target).origin + "/" },
      });

      const ct = upstream.headers.get("content-type") || "";
      const isPlaylist = /mpegurl|m3u8/i.test(ct) || /\.m3u8(\?|$)/i.test(target);

      if (isPlaylist) {
        const text = await upstream.text();
        const rewritten = await rewritePlaylist(text, target, proxyOrigin);
        return new Response(rewritten, {
          status: upstream.status,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/vnd.apple.mpegurl",
            "Cache-Control": "no-cache",
          },
        });
      }

      // Segment / key / init
      return new Response(upstream.body, {
        status: upstream.status,
        headers: {
          ...corsHeaders,
          "Content-Type": ct || "video/mp2t",
          "Cache-Control": "public, max-age=10",
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
