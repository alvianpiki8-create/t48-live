// Reset device binding for an access token (max 3 resets per token).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const MAX_RESETS = 3;

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
    const tokenCode = typeof body?.token === "string" ? body.token.trim() : "";
    const deviceId = typeof body?.device_id === "string" ? body.device_id.trim() : "";
    if (!tokenCode || tokenCode.length > 200 || !deviceId || deviceId.length > 200) {
      return json({ error: "invalid_input" });
    }

    const { data: tok } = await admin
      .from("access_tokens")
      .select("id,is_blocked,reset_count,duration_days,valid_until,max_uses")
      .eq("token_code", tokenCode)
      .maybeSingle();

    if (!tok) return json({ error: "not_found" });
    if (tok.is_blocked) return json({ error: "blocked" });

    const used = tok.reset_count || 0;
    if (used >= MAX_RESETS) return json({ error: "limit_reached", remaining: 0 });

    // Clear all previous device bindings, then bind this device.
    await admin.from("access_token_devices").delete().eq("token_id", tok.id);

    const { error: upErr } = await admin
      .from("access_tokens")
      .update({
        device_id: deviceId,
        reset_count: used + 1,
        used_at: new Date().toISOString(),
      })
      .eq("id", tok.id);
    if (upErr) return json({ error: "update_failed" });

    if ((tok.max_uses || 1) > 1) {
      await admin.from("access_token_devices").insert({ token_id: tok.id, device_id: deviceId });
    }

    return json({ ok: true, remaining: MAX_RESETS - (used + 1) });
  } catch (e) {
    console.error("reset-token-device error:", e);
    return json({ error: "server_error" }, 500);
  }
});
