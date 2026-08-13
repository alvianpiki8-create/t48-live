import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const IDN_API = "https://v5.jkt48connect.com/api/jkt48/idnplus?apikey=JKTCONNECT";

// Format a unix timestamp (seconds) into Jakarta (UTC+7) date/time parts.
const jakartaParts = (unixSeconds: number) => {
  const d = new Date((unixSeconds + 7 * 3600) * 1000);
  const date = d.toISOString().slice(0, 10); // YYYY-MM-DD (Jakarta)
  const hour = d.toISOString().slice(11, 16); // HH:MM (Jakarta)
  return { date, hour, iso: new Date(unixSeconds * 1000).toISOString() };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const res = await fetch(IDN_API);
    const json = await res.json();
    const items: any[] = Array.isArray(json?.data) ? json.data : [];

    let synced = 0;
    const results: any[] = [];

    for (const item of items) {
      const code: string | undefined = item?.showId;
      const title: string | undefined = item?.title;
      if (!code || !title) continue;
      const status = String(item?.status || "");
      if (status !== "scheduled" && status !== "live") continue;

      const when = Number(item?.scheduled_at) || Number(item?.live_at) || 0;
      if (!when) continue;
      const { date, hour, iso } = jakartaParts(when);

      const image = item?.image_url || null;
      const description = item?.idnliveplus?.description || null;
      const price = Number(item?.idnliveplus?.liveroom_price) || null;

      // 1) shows (ID show + jadwal untuk token/link)
      const { data: existingShow } = await supabase
        .from("shows").select("id").eq("show_code", code).maybeSingle();

      if (existingShow) {
        await supabase.from("shows")
          .update({ name: title, show_date: date, access_hour: hour })
          .eq("id", existingShow.id);
      } else {
        await supabase.from("shows").insert({
          name: title, show_code: code, show_date: date, access_hour: hour, access_duration_hours: 24,
        });
      }

      // 2) show_catalog (judul, background, countdown otomatis)
      const { data: existingCatalog } = await supabase
        .from("show_catalog").select("id,price_coins").eq("external_id", code).maybeSingle();

      if (existingCatalog) {
        await supabase.from("show_catalog").update({
          title, description, image_url: image, background_url: image,
          show_date: iso, access_hour: hour,
        }).eq("id", existingCatalog.id);
      } else {
        await supabase.from("show_catalog").insert({
          external_id: code, title, description,
          image_url: image, background_url: image,
          show_date: iso, access_hour: hour,
          price_coins: price ?? 4,
          is_active: true,
        });
      }

      synced++;
      results.push({ code, title, date, hour });
    }

    return new Response(JSON.stringify({ success: true, synced, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
