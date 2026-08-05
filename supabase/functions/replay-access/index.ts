// Replay access gateway.
// Replay passwords and YouTube links are NOT publicly readable anymore.
// Every unlock is verified server-side and only the matching video link is returned.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

interface Row {
  id: string;
  show_date: string;
  description: string | null;
  youtube_url: string | null;
  show_id: string | null;
  replay_password: string;
}

const publicShape = (r: Row) => ({
  id: r.id,
  show_date: r.show_date,
  description: r.description,
  show_id: r.show_id,
  has_video: Boolean(r.youtube_url),
});

const fullShape = (r: Row) => ({ ...publicShape(r), youtube_url: r.youtube_url });

async function allSchedules(): Promise<Row[]> {
  const { data } = await admin
    .from("replay_schedules")
    .select("id,show_date,description,youtube_url,show_id,replay_password")
    .order("show_date", { ascending: false });
  return (data as Row[]) || [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({} as any));
    const action = String(body?.action || "").trim();
    const secret = typeof body?.secret === "string" ? body.secret.trim() : "";

    if (secret.length > 200) return json({ error: "invalid_input" }, 400);

    // 1) Public listing — metadata only, no passwords, no video links.
    if (action === "list") {
      return json({ schedules: (await allSchedules()).map(publicShape) });
    }

    // 2) Owner: full rows (requires the owner panel token).
    if (action === "owner") {
      const expected = Deno.env.get("OWNER_PANEL_TOKEN");
      if (!expected || secret !== expected) return json({ error: "unauthorized" }, 401);
      const rows = await allSchedules();
      return json({ schedules: rows.map((r) => ({ ...fullShape(r), replay_password: r.replay_password })) });
    }

    // 3) Unlock with a replay password OR a live access token.
    //    A replay password only works when its schedule is tied to a show ID,
    //    and it unlocks exactly the replays of that show.
    if (action === "unlock") {
      if (!secret) return json({ error: "missing_secret" }, 400);
      const rows = await allSchedules();

      const matches = rows.filter((r) => (r.replay_password || "").trim() === secret);
      if (matches.length) {
        const linked = matches.filter((r) => r.show_id);
        if (!linked.length) return json({ error: "no_show" }, 403);
        const showId = linked[0].show_id;
        const forShow = rows.filter((r) => r.show_id === showId && r.youtube_url);
        if (!forShow.length) return json({ error: "no_video" }, 404);
        return json({ mode: "password", show_id: showId, schedules: forShow.map(fullShape) });
      }

      const { data: tok } = await admin
        .from("access_tokens")
        .select("id,is_blocked,valid_until,expires_at,show_id")
        .eq("token_code", secret)
        .maybeSingle();

      if (tok && !tok.is_blocked) {
        const notExpired =
          (!tok.valid_until || new Date(tok.valid_until) > new Date()) &&
          (!tok.expires_at || new Date(tok.expires_at) > new Date());
        if (!notExpired) return json({ error: "expired" }, 403);
        if (!tok.show_id) return json({ error: "no_show" }, 403);
        const forShow = rows.filter((r) => r.youtube_url && r.show_id === tok.show_id);
        if (!forShow.length) return json({ error: "no_video" }, 404);
        return json({ mode: "token", show_id: tok.show_id, schedules: forShow.map(fullShape) });
      }

      return json({ error: "invalid_secret" }, 403);
    }

    // 4) Membership: all replays, verified server-side (JWT membership or membership token).
    if (action === "membership") {
      let active = false;

      const authHeader = req.headers.get("Authorization") || "";
      if (authHeader.startsWith("Bearer ")) {
        const { data: claims } = await admin.auth.getClaims(authHeader.slice(7));
        const uid = claims?.claims?.sub as string | undefined;
        if (uid) {
          const { data } = await admin
            .from("user_memberships")
            .select("id")
            .eq("user_id", uid)
            .gt("expires_at", new Date().toISOString())
            .limit(1)
            .maybeSingle();
          active = Boolean(data);
        }
      }

      if (!active && secret) {
        const { data: tok } = await admin
          .from("access_tokens")
          .select("is_blocked,show_name,valid_until")
          .eq("token_code", secret)
          .maybeSingle();
        active = Boolean(
          tok &&
            !tok.is_blocked &&
            (tok.show_name || "").toLowerCase().startsWith("membership") &&
            (!tok.valid_until || new Date(tok.valid_until) > new Date()),
        );
      }

      if (!active) return json({ error: "no_membership" }, 403);
      const rows = (await allSchedules()).filter((r) => r.youtube_url);
      return json({ mode: "membership", schedules: rows.map(fullShape) });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    console.error("replay-access error:", e);
    return json({ error: "server_error" }, 500);
  }
});
