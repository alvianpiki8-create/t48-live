import { corsHeaders } from "@supabase/supabase-js/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { token } = await req.json();
    const expected = Deno.env.get("OWNER_PANEL_TOKEN");

    if (!expected) {
      return new Response(JSON.stringify({ valid: false, error: "Token owner belum dikonfigurasi" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const valid = typeof token === "string" && token.trim() === expected;
    return new Response(JSON.stringify({ valid }), {
      status: valid ? 200 : 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ valid: false }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});