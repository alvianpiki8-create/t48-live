// Admin login by name + code. Validates server-side so client never sees other admin codes.
// POST { name, code } -> { ok, admin: { id, name } } or { ok:false, error }
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const { name, code } = await req.json();
    if (typeof name !== "string" || typeof code !== "string" || !name.trim() || !code.trim()) {
      return new Response(JSON.stringify({ ok: false, error: "Nama dan kode wajib diisi" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supa = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: admin, error } = await supa
      .from("admins")
      .select("id, name, code, is_blocked, blocked_reason")
      .eq("name", name.trim())
      .maybeSingle();

    if (error || !admin) {
      return new Response(JSON.stringify({ ok: false, error: "Nama atau kode admin salah" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (admin.code !== code.trim()) {
      return new Response(JSON.stringify({ ok: false, error: "Nama atau kode admin salah" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (admin.is_blocked) {
      return new Response(JSON.stringify({
        ok: false,
        blocked: true,
        error: admin.blocked_reason || "Akses Anda telah ditutup oleh owner",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    await supa.from("admins").update({ last_login_at: new Date().toISOString() }).eq("id", admin.id);

    return new Response(JSON.stringify({
      ok: true,
      admin: { id: admin.id, name: admin.name },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
