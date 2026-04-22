import { createClient } from "npm:@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { membershipId } = await req.json();
    if (typeof membershipId !== "string" || !membershipId.trim()) {
      return new Response(JSON.stringify({ error: "Membership tidak valid" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Silakan login terlebih dahulu" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const userId = userData.user.id;

    const { data: membership, error: membershipError } = await admin
      .from("memberships")
      .select("id,name,type,price,is_active")
      .eq("id", membershipId)
      .maybeSingle();
    if (membershipError) throw membershipError;
    if (!membership || !membership.is_active) {
      return new Response(JSON.stringify({ error: "Paket membership tidak tersedia" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("coins")
      .eq("user_id", userId)
      .maybeSingle();
    if (profileError) throw profileError;

    const currentCoins = Number(profile?.coins || 0);
    const price = Number(membership.price || 0);
    if (currentCoins < price) {
      return new Response(JSON.stringify({ error: "Koin tidak cukup" }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: settings } = await admin
      .from("stream_settings")
      .select("replay_url,replay_password")
      .limit(1)
      .maybeSingle();

    const durationDays = membership.type === "monthly" ? 30 : 7;
    const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();

    const { error: coinError } = await admin
      .from("profiles")
      .update({ coins: currentCoins - price })
      .eq("user_id", userId);
    if (coinError) throw coinError;

    const { data: created, error: createError } = await admin
      .from("user_memberships")
      .insert({
        user_id: userId,
        membership_id: membership.id,
        membership_name: membership.name,
        membership_type: membership.type,
        coins_spent: price,
        expires_at: expiresAt,
        replay_url: settings?.replay_url || "t48.lovable.app/replay",
        replay_password: settings?.replay_password || "",
      })
      .select("*")
      .single();
    if (createError) throw createError;

    return new Response(JSON.stringify({ ok: true, membership: created, coins: currentCoins - price }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Gagal membeli membership" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});