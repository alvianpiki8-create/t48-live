import { createClient } from "npm:@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const tokenCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => (b % 10).toString()).join("");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { showId } = await req.json();
    if (typeof showId !== "string" || !showId.trim()) {
      return new Response(JSON.stringify({ error: "Show tidak valid" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Silakan login terlebih dahulu" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const userId = userData.user.id;

    const { data: existing } = await admin
      .from("show_purchases")
      .select("show_id,token_code")
      .eq("user_id", userId)
      .eq("show_id", showId)
      .maybeSingle();
    if (existing?.token_code) {
      return new Response(JSON.stringify({ ok: true, token: existing.token_code, alreadyPurchased: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: show, error: showError } = await admin
      .from("show_catalog")
      .select("id,title,price_coins,show_date,access_hour,is_active")
      .eq("id", showId)
      .maybeSingle();
    if (showError) throw showError;
    if (!show || !show.is_active) {
      return new Response(JSON.stringify({ error: "Show tidak tersedia" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("coins")
      .eq("user_id", userId)
      .maybeSingle();
    if (profileError) throw profileError;

    const currentCoins = Number(profile?.coins || 0);
    const price = Number(show.price_coins || 0);
    if (currentCoins < price) {
      return new Response(JSON.stringify({ error: "Koin tidak cukup" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let code = tokenCode();
    for (let i = 0; i < 5; i++) {
      const { data: dup } = await admin.from("access_tokens").select("id").eq("token_code", code).maybeSingle();
      if (!dup) break;
      code = tokenCode();
    }

    const validUntil = new Date((show.show_date ? new Date(show.show_date).getTime() : Date.now()) + 24 * 60 * 60 * 1000).toISOString();
    const expiresDate = validUntil.slice(0, 10);

    const { error: coinError } = await admin.from("profiles").update({ coins: currentCoins - price }).eq("user_id", userId);
    if (coinError) throw coinError;

    const { error: tokenError } = await admin.from("access_tokens").insert({
      token_code: code,
      user_id: userId,
      show_id: show.id,
      show_name: show.title,
      access_hour: show.access_hour,
      expires_at: expiresDate,
      duration_days: 1,
      valid_until: validUntil,
    });
    if (tokenError) throw tokenError;

    const { error: purchaseError } = await admin.from("show_purchases").insert({
      user_id: userId,
      show_id: show.id,
      coins_spent: price,
      token_code: code,
    });
    if (purchaseError) throw purchaseError;

    return new Response(JSON.stringify({ ok: true, token: code, coins: currentCoins - price }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Gagal membeli show" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
