// Direct browser client for JKT48 IDN+ live stream via GiStream + CTV.
// Mirrors the reference implementation — no server-side wrapper.

const IDN_API = "https://v5.jkt48connect.com/api/jkt48/idnplus?apikey=JKTCONNECT";
const LIVE_API = "https://v5.jkt48connect.com/api/jkt48/live?apikey=JKTCONNECT";
const TOKEN_API_BASE = "https://v5.jkt48connect.com";
const CTV_BASE = "https://ctv.jkt48connect.com";
const SIGNING_PATH = "/api/token/generate?apikey=JKTCONNECT";
const PARTNER_KID = "jkt48connect-v1";
const PARTNER_SECRET = "gstream@jkt48connect@2108";

const toHex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return toHex(buf);
}

async function hmacSHA256Hex(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const buf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return toHex(buf);
}

async function buildHMACHeaders(): Promise<Record<string, string>> {
  const timestamp = Date.now().toString();
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const bodyHash = await sha256Hex("{}");
  const signature = await hmacSHA256Hex(
    PARTNER_SECRET,
    `${timestamp}:${nonce}:POST:${SIGNING_PATH}:${bodyHash}`,
  );
  return {
    "x-kid": PARTNER_KID,
    "x-timestamp": timestamp,
    "x-nonce": nonce,
    "x-signature": signature,
  };
}

export async function generateStreamToken(slugOrId: string, isSlug: boolean): Promise<string> {
  const hh = await buildHMACHeaders();
  const res = await fetch(`${TOKEN_API_BASE}${SIGNING_PATH}`, {
    method: "POST",
    headers: {
      ...hh,
      ...(isSlug ? { "x-slug": slugOrId } : { "x-showid": slugOrId }),
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { throw new Error("Token server returned non-JSON"); }
  if (!data.status) throw new Error("Generate token gagal: " + (data.message || ""));
  return data.data.token;
}

export interface IdnQuality {
  index: number;
  name: string;
  bandwidth: number;
  resolution: string;
  url: string;
}

export async function getStreamURL(
  token: string,
  slugOrId: string,
  isSlug: boolean,
): Promise<{ url: string; qualities: IdnQuality[] }> {
  const param = isSlug ? `slug=${encodeURIComponent(slugOrId)}` : `showId=${encodeURIComponent(slugOrId)}`;
  const res = await fetch(`${CTV_BASE}/stream?${param}`, {
    headers: {
      "x-api-token": token,
      ...(isSlug ? { "x-slug": slugOrId } : { "x-showid": slugOrId }),
    },
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.message || "Gagal mendapatkan stream URL");
  const streams: any[] = data.streams || [];
  const qualities: IdnQuality[] = streams.map((s: any, idx: number) => ({
    index: idx,
    name: s.NAME || `${s.RESOLUTION?.split("x")[1] || "?"}p`,
    bandwidth: parseInt(s.BANDWIDTH) || 0,
    resolution: s.RESOLUTION || "",
    url: s.url || "",
  }));
  return { url: streams[0]?.url || "", qualities };
}

export interface IdnLiveResolved {
  url: string;
  token: string;
  name: string;
  slug: string;
  isSlug: boolean;
  qualities: IdnQuality[];
}

/**
 * Resolve the currently-live IDN+ JKT48 show to a playable HLS URL.
 * Returns null when no show is live.
 */
export async function resolveIdnLive(): Promise<IdnLiveResolved | null> {
  // 1) Try IDN+ list
  try {
    const idn = await (await fetch(IDN_API)).json();
    const arr: any[] = Array.isArray(idn?.data) ? idn.data : [];
    const show = arr.find((s) => s.status === "live");
    if (show?.slug) {
      const token = await generateStreamToken(show.slug, true);
      const { url, qualities } = await getStreamURL(token, show.slug, true);
      if (url) {
        return {
          url, token, qualities,
          name: show.name || show.member?.name || "IDN Live",
          slug: show.slug, isSlug: true,
        };
      }
    }
  } catch {}

  // 2) Fallback: live aggregate
  try {
    const live = await (await fetch(LIVE_API)).json();
    const arr: any[] = Array.isArray(live?.data) ? live.data : (Array.isArray(live) ? live : []);
    const show = arr.find((s) => (s.type === "idn" || s.platform === "idn") && (s.is_live || s.status === "live")) || arr[0];
    if (!show) return null;
    const identifier = show.identifier || show.slug || show.url_key;
    const showId = show.showid || show.show_id;
    let slugOrId = ""; let isSlug = true;
    if (identifier) { slugOrId = identifier; isSlug = true; }
    else if (showId) { slugOrId = String(showId); isSlug = false; }
    else return null;
    const token = await generateStreamToken(slugOrId, isSlug);
    const { url, qualities } = await getStreamURL(token, slugOrId, isSlug);
    if (!url) return null;
    return { url, token, qualities, name: show.name || "Live", slug: slugOrId, isSlug };
  } catch {
    return null;
  }
}
