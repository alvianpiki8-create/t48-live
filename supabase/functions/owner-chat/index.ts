// Posts a chat message under the reserved official nickname.
// The database blocks anon/authenticated clients from using that nickname,
// so official messages can only originate here after the owner token is verified.
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({} as any));
    const ownerToken = typeof body?.ownerToken === "string" ? body.ownerToken.trim() : "";
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    const nickname = typeof body?.nickname === "string" ? body.nickname.trim() : "";
    const color = typeof body?.color === "string" ? body.color.slice(0, 40) : "hsl(0, 0%, 100%)";
    const deviceId = typeof body?.deviceId === "string" ? body.deviceId.slice(0, 128) : null;

    const expected = Deno.env.get("OWNER_PANEL_TOKEN");
    if (!expected || ownerToken !== expected) return json({ error: "unauthorized" }, 401);

    if (!text || text.length > 500) return json({ error: "invalid_text" }, 400);
    if (!nickname || nickname.length > 60) return json({ error: "invalid_nickname" }, 400);

    const { data, error } = await admin
      .from("chat_messages")
      .insert({ nickname, text, color, device_id: deviceId })
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("owner-chat insert failed:", error.message);
      return json({ error: "insert_failed" }, 500);
    }
    return json({ id: data?.id ?? null });
  } catch (e) {
    console.error("owner-chat error:", e);
    return json({ error: "server_error" }, 500);
  }
});
