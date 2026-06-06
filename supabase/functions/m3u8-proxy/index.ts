// M3U8 proxy + signed short-lived token.
// - Hides the real upstream URL and the x-api-token from viewers.
// - Tokens are bound to client fingerprint (IP + UA hash) to prevent stealing.
// - Playlist rewrites are parallelized and the HMAC key is cached at module
//   scope for low-latency repeat calls (HLS hits this dozens of times/min).
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SECRET = Deno.env.get("OWNER_PANEL_TOKEN") || "fallback-secret-change-me";
const PLAYLIST_TTL_SEC = 60 * 60 * 2; // 2 hours — avoids player reload loops while still fingerprint-bound
const SEGMENT_TTL_SEC = 60;           // 1 min — short, segments rotate quickly

const IDN_API = "https://v5.jkt48connect.com/api/jkt48/idnplus?apikey=JKTCONNECT";
const LIVE_API = "https://v5.jkt48connect.com/api/jkt48/live?apikey=JKTCONNECT";
const TOKEN_API_BASE = "https://v5.jkt48connect.com";
const CTV_BASE = "https://ctv.jkt48connect.com";
const SIGNING_PATH = "/api/token/generate?apikey=JKTCONNECT";
const PARTNER_KID = "jkt48connect-v1";
const PARTNER_SECRET = "gstream@jkt48connect@2108";

let idnCache: { value: any; expiresAt: number } | null = null;

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
const b64urlToBytes = (s: string) => {
  const bin = b64urlDecode(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
};

const toHex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");

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

let aesKeyPromise: Promise<CryptoKey> | null = null;
const getAesKey = async () => {
  if (!aesKeyPromise) {
    aesKeyPromise = crypto.subtle.digest("SHA-256", enc.encode(SECRET)).then((key) =>
      crypto.subtle.importKey("raw", key, { name: "AES-GCM" }, false, ["encrypt", "decrypt"])
    );
  }
  return aesKeyPromise;
};

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(s));
  return toHex(buf);
}

async function hmacSHA256Hex(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toHex(await crypto.subtle.sign("HMAC", key, enc.encode(msg)));
}

// Fingerprint binds a token to a particular client to prevent token theft.
async function fpHash(req: Request): Promise<string> {
  const rawIp = req.headers.get("x-forwarded-for")?.split(",")[0].trim()
    || req.headers.get("cf-connecting-ip")
    || "unknown";
  const ip = rawIp.includes(":") ? rawIp.split(":").slice(0, 4).join(":") : rawIp.split(".").slice(0, 3).join(".");
  const ua = req.headers.get("user-agent") || "ua";
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(`${ip}|${ua}`));
  return b64url(digest).slice(0, 12);
}

interface Payload { u: string; e: number; h?: Record<string, string>; f: string; }

async function makeToken(url: string, headers: Record<string, string>, fp: string, ttl: number): Promise<string> {
  const payload: Payload = { u: url, e: Math.floor(Date.now() / 1000) + ttl, h: headers, f: fp };
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await getAesKey(), enc.encode(JSON.stringify(payload)));
  const body = `${b64url(iv)}.${b64url(cipher)}`;
  const sig = await hmac(`v2.${body}`);
  return `v2.${body}.${sig}`;
}

async function readToken(token: string): Promise<Payload | null> {
  if (token.startsWith("v2.")) {
    const [, iv, cipher, sig] = token.split(".");
    if (!iv || !cipher || !sig) return null;
    const expected = await hmac(`v2.${iv}.${cipher}`);
    if (expected !== sig) return null;
    try {
      const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64urlToBytes(iv) }, await getAesKey(), b64urlToBytes(cipher));
      const payload = JSON.parse(new TextDecoder().decode(plain)) as Payload;
      if (typeof payload.u !== "string" || typeof payload.e !== "number" || typeof payload.f !== "string") return null;
      if (payload.e < Math.floor(Date.now() / 1000)) return null;
      return payload;
    } catch { return null; }
  }

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

async function buildHMACHeaders(): Promise<Record<string, string>> {
  const timestamp = Date.now().toString();
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const bodyHash = await sha256Hex("{}");
  const signature = await hmacSHA256Hex(PARTNER_SECRET, `${timestamp}:${nonce}:POST:${SIGNING_PATH}:${bodyHash}`);
  return { "x-kid": PARTNER_KID, "x-timestamp": timestamp, "x-nonce": nonce, "x-signature": signature };
}

async function generateStreamToken(slugOrId: string, isSlug: boolean): Promise<string> {
  const hh = await buildHMACHeaders();
  const res = await fetch(`${TOKEN_API_BASE}${SIGNING_PATH}`, {
    method: "POST",
    headers: { ...hh, ...(isSlug ? { "x-slug": slugOrId } : { "x-showid": slugOrId }), "Content-Type": "application/json" },
    body: "{}",
  });
  const data = await res.json().catch(() => null);
  if (!data?.status || !data?.data?.token) throw new Error(data?.message || "generate_token_failed");
  return data.data.token;
}

async function getStreamURL(token: string, slugOrId: string, isSlug: boolean) {
  const param = isSlug ? `slug=${encodeURIComponent(slugOrId)}` : `showId=${encodeURIComponent(slugOrId)}`;
  const res = await fetch(`${CTV_BASE}/stream?${param}`, {
    headers: { "x-api-token": token, ...(isSlug ? { "x-slug": slugOrId } : { "x-showid": slugOrId }) },
  });
  const data = await res.json();
  if (!data?.success) throw new Error(data?.message || "stream_url_failed");
  const streams = Array.isArray(data.streams) ? data.streams : [];
  return {
    url: streams[0]?.url || "",
    qualities: streams.map((s: any, idx: number) => ({
      index: idx,
      name: s.NAME || `${String(s.RESOLUTION || "").split("x")[1] || "?"}p`,
      bandwidth: Number.parseInt(s.BANDWIDTH) || 0,
      resolution: s.RESOLUTION || "",
      url: s.url || "",
    })).filter((q: any) => q.url),
  };
}

async function resolveIdnLive() {
  const pick = (arr: any[]) => arr.find((s) => s?.status === "live" || s?.is_live) || arr[0];
  let show: any = null;
  try { show = pick((await (await fetch(IDN_API)).json())?.data || []); } catch {}
  if (!show) {
    const live = await (await fetch(LIVE_API)).json();
    const arr = Array.isArray(live?.data) ? live.data : (Array.isArray(live) ? live : []);
    show = arr.find((s) => (s.type === "idn" || s.platform === "idn") && (s.is_live || s.status === "live")) || arr[0];
  }
  const slugOrId = show?.slug || show?.identifier || show?.url_key || show?.showid || show?.show_id;
  if (!slugOrId) return null;
  const isSlug = Boolean(show?.slug || show?.identifier || show?.url_key);
  const token = await generateStreamToken(String(slugOrId), isSlug);
  const { url, qualities } = await getStreamURL(token, String(slugOrId), isSlug);
  if (!url) return null;
  return { url, token, qualities, name: show?.name || show?.member?.name || "IDN Live", slug: String(slugOrId), isSlug };
}

async function cachedResolveIdnLive() {
  if (idnCache && idnCache.expiresAt > Date.now()) return idnCache.value;
  const value = await resolveIdnLive();
  if (value) idnCache = { value, expiresAt: Date.now() + 45_000 };
  return value;
}

const qualityHeight = (q: any) => Number(String(q?.name || q?.resolution || "").match(/(\d{3,4})/)?.[1] || 0);
const pickStartupQuality = (qualities: any[]) => {
  const valid = qualities.filter((q) => q?.url);
  return valid.find((q) => /360p/i.test(q.name))
    || valid.find((q) => /480p/i.test(q.name))
    || valid.find((q) => /160p|240p/i.test(q.name))
    || [...valid].sort((a, b) => (a.bandwidth || qualityHeight(a)) - (b.bandwidth || qualityHeight(b)))[0];
};

// Rewrite m3u8 playlist so segments & sub-playlists go back through this proxy.
// All HMAC signings run in parallel.
async function rewritePlaylist(text: string, baseUrl: string, proxyOrigin: string, headers: Record<string, string>, fp: string): Promise<string> {
  const lines = trimLiveWindow(text.split(/\r?\n/));
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
    if (trimmed.startsWith("#EXT-X-PREFETCH:")) {
      const uri = trimmed.slice("#EXT-X-PREFETCH:".length).trim();
      const abs = new URL(uri, baseUrl).toString();
      const tok = await makeToken(abs, headers, fp, SEGMENT_TTL_SEC);
      return `#EXT-X-PREFETCH:${proxyOrigin}?t=${encodeURIComponent(tok)}`;
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

function trimLiveWindow(lines: string[]) {
  if (lines.some((line) => line.startsWith("#EXT-X-STREAM-INF")) || lines.some((line) => line.startsWith("#EXT-X-ENDLIST"))) return lines;
  const mediaIndexes = lines.map((line, idx) => (!line.trim() || line.trim().startsWith("#") ? -1 : idx)).filter((idx) => idx >= 0);
  if (mediaIndexes.length <= 4) return lines;
  const keepFrom = mediaIndexes[Math.max(0, mediaIndexes.length - 4)];
  return lines.filter((line, idx) => idx < keepFrom ? !line.startsWith("#EXTINF") && !line.startsWith("#EXT-X-PROGRAM-DATE-TIME") && (line.startsWith("#EXTM3U") || line.startsWith("#EXT-X-VERSION") || line.startsWith("#EXT-X-TARGETDURATION") || line.startsWith("#EXT-X-MEDIA-SEQUENCE")) : true);
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
      if (body?.action === "resolve-idn") {
        const resolved = await cachedResolveIdnLive();
        if (!resolved) return new Response(JSON.stringify({ live: false }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const headers: Record<string, string> = { "x-api-token": resolved.token };
        const startup = pickStartupQuality(resolved.qualities) || { url: resolved.url, name: "Auto" };
        const proxied = await makeToken(startup.url, headers, fp, PLAYLIST_TTL_SEC);
        return new Response(JSON.stringify({
          live: true,
          url: `${proxyOrigin}?t=${encodeURIComponent(proxied)}`,
          startupQuality: startup.name,
          name: resolved.name,
          slug: resolved.slug,
          qualities: await Promise.all([...resolved.qualities]
            .sort((a: any, b: any) => qualityHeight(b) - qualityHeight(a))
            .map(async (q: any) => ({
            name: q.name,
            resolution: q.resolution,
            bandwidth: q.bandwidth,
            url: `${proxyOrigin}?t=${encodeURIComponent(await makeToken(q.url, headers, fp, PLAYLIST_TTL_SEC))}`,
          }))),
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

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
      if (!upstream.ok) {
        return new Response(await upstream.text(), {
          status: upstream.status,
          headers: { ...corsHeaders, "Content-Type": upstream.headers.get("content-type") || "text/plain", "Cache-Control": "no-store" },
        });
      }

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
