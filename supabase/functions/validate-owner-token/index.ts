const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Satu-satunya akses owner: sandi di bawah ini.
const OWNER_PASSWORD = "JKL95BKL";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const input = typeof body?.password === "string"
      ? body.password.trim()
      : typeof body?.email === "string"
        ? body.email.trim()
        : "";
    const secret = Deno.env.get("OWNER_PANEL_TOKEN");

    if (!secret) {
      return new Response(JSON.stringify({ valid: false, error: "Owner belum dikonfigurasi" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const valid = email === OWNER_EMAIL;
    return new Response(JSON.stringify({ valid, token: valid ? secret : undefined }), {
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
