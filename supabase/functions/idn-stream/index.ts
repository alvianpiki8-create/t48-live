// Auto-resolve currently live JKT48 IDN+ show via GiStream + CTV.
// Returns { ok, url, token, name, slug, qualities } so the browser can play
// the HLS stream directly with `x-api-token` header.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const IDN_API = "https://v5.jkt48connect.com/api/jkt48/idnplus?apikey=JKTCONNECT";
const LIVE_API = "https://v5.jkt48connect.com/api/jkt48/live?apikey=JKTCONNECT";
const TOKEN_API_BASE = "https://v5.jkt48connect.com";
const CTV_BASE = "https://ctv.jkt48connect.com";
const SIGNING_PATH = "/api/token/generate?apikey=JKTCONNECT";
const PARTNER_KID = "jkt48connect-v1";
const PARTNER_SECRET = "gstream@jkt48connect@2108";

const toHex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");

async function sha256Hex(s: string) {
  return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
}
async function hmacSHA256Hex(secret: string, msg: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg)));
}
async function buildHMACHeaders() {
  const timestamp = Date.now().toString();
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const bodyHash = await sha256Hex("{}");
  const sig = await hmacSHA256Hex(
    PARTNER_SECRET,
    `${timestamp}:${nonce}:POST:${SIGNING_PATH}:${bodyHash}`,
  );
  return {
    "x-kid": PARTNER_KID,
    "x-timestamp": timestamp,
    "x-nonce": nonce,
    "x-signature": sig,
  };
}

async function generateStreamToken(slugOrId: string, isSlug: boolean): Promise<string> {
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
  const data = await res.json();
  if (!data.status) throw new Error("token failed: " + (data.message || "unknown"));
  return data.data.token;
}

async function getStreamURL(token: string, slugOrId: string, isSlug: boolean) {
  const q = isSlug ? `slug=${encodeURIComponent(slugOrId)}` : `showId=${encodeURIComponent(slugOrId)}`;
  const res = await fetch(`${CTV_BASE}/stream?${q}`, {
    headers: {
      "x-api-token": token,
      ...(isSlug ? { "x-slug": slugOrId } : { "x-showid": slugOrId }),
    },
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.message || "stream url failed");
  const streams: any[] = data.streams || [];
  const url = streams[0]?.url || "";
  const qualities = streams.map((s: any, idx: number) => ({
    index: idx,
    name: s.NAME || `${s.RESOLUTION?.split("x")[1] || "?"}p`,
    bandwidth: parseInt(s.BANDWIDTH) || 0,
    resolution: s.RESOLUTION || "",
    url: s.url || "",
  }));
  return { url, qualities };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // 1) Find a currently-live IDN+ show
    const idnRes = await fetch(IDN_API);
    const idnJson = await idnRes.json();
    const idnShows: any[] = Array.isArray(idnJson?.data) ? idnJson.data : [];
    let liveShow = idnShows.find((s) => s.status === "live") || null;

    let slugOrId = "";
    let isSlug = true;
    let name = "";

    if (liveShow) {
      slugOrId = liveShow.slug;
      isSlug = true;
      name = liveShow.name || liveShow.member?.name || "IDN Live";
    } else {
      // fallback: try Showroom/IDN live aggregate
      const live = await (await fetch(LIVE_API)).json().catch(() => null);
      const arr: any[] = Array.isArray(live?.data) ? live.data : (Array.isArray(live) ? live : []);
      const show = arr.find((s) => (s.type === "idn" || s.platform === "idn") && (s.is_live || s.status === "live")) || arr[0];
      if (!show) {
        return new Response(JSON.stringify({ ok: false, message: "Tidak ada siaran IDN+ live saat ini." }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const identifier = show.identifier || show.slug || show.url_key;
      const showId = show.showid || show.show_id;
      if (identifier) { slugOrId = identifier; isSlug = true; }
      else if (showId) { slugOrId = String(showId); isSlug = false; }
      else throw new Error("No identifier on live show");
      name = show.name || show.member?.name || "Live";
    }

    const token = await generateStreamToken(slugOrId, isSlug);
    const { url, qualities } = await getStreamURL(token, slugOrId, isSlug);
    if (!url) throw new Error("Empty stream url");

    return new Response(
      JSON.stringify({ ok: true, url, token, name, slug: slugOrId, isSlug, qualities }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, message: (e as Error).message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
