import { createClient } from "npm:@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { requestId, ownerToken } = await req.json();
    const expected = Deno.env.get("OWNER_PANEL_TOKEN");
    if (!expected || ownerToken !== expected || typeof requestId !== "string") {
      return new Response(JSON.stringify({ error: "Tidak diizinkan" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: locked, error: lockError } = await admin
      .from("coin_topup_requests")
      .update({ status: "processing" })
      .eq("id", requestId)
      .eq("status", "pending")
      .select("id,user_id,amount")
      .maybeSingle();

    if (lockError) throw lockError;
    if (!locked) {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("coins")
      .eq("user_id", locked.user_id)
      .maybeSingle();
    if (profileError) throw profileError;

    const nextCoins = Number(profile?.coins || 0) + Number(locked.amount || 0);
    const { error: coinError } = await admin
      .from("profiles")
      .update({ coins: nextCoins })
      .eq("user_id", locked.user_id);
    if (coinError) throw coinError;

    const { error: confirmError } = await admin
      .from("coin_topup_requests")
      .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
      .eq("id", requestId);
    if (confirmError) throw confirmError;

    return new Response(JSON.stringify({ ok: true, coins: nextCoins }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Gagal approve topup" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});