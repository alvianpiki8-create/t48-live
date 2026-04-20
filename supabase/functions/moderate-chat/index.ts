// Edge function: AI moderation for live chat messages.
// Returns { allow: boolean, reason?: string, word?: string }.
// If a message is unsafe, the client bans the device + deletes the message.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Hard list of obvious slurs / profanity (Indonesian + English) — instant block, no AI needed.
const HARD_BANNED = [
  "anjing", "anjg", "babi", "bangsat", "bajingan", "kontol", "memek", "ngentot",
  "ngentod", "pepek", "pantek", "pantat", "tai", "taik", "tolol", "goblok",
  "idiot", "bego", "kampret", "asu", "jancok", "jancuk", "cok", "cuk",
  "fuck", "shit", "bitch", "bastard", "asshole", "dick", "pussy", "cunt",
  "porn", "porno", "bokep", "ngewe", "colmek", "puki", "pukimak",
];

const containsHardBan = (text: string): string | null => {
  const lower = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
  const words = lower.split(/\s+/);
  for (const w of words) {
    if (HARD_BANNED.includes(w)) return w;
  }
  // Also catch substring leetspeak attempts
  for (const bad of HARD_BANNED) {
    if (lower.includes(bad)) return bad;
  }
  return null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { text } = await req.json();
    if (typeof text !== "string" || !text.trim()) {
      return new Response(JSON.stringify({ allow: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 1: instant local check
    const hardHit = containsHardBan(text);
    if (hardHit) {
      return new Response(
        JSON.stringify({ allow: false, reason: "Mengandung kata kasar / tidak pantas", word: hardHit }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: AI moderation for subtle/ambiguous messages
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      // No AI available → allow by default (already passed hard check)
      return new Response(JSON.stringify({ allow: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content:
              "Anda adalah moderator chat live streaming Indonesia. Tugas: deteksi pesan yang mengandung kata kasar, makian, hinaan, ujaran kebencian, pelecehan seksual, SARA, ancaman, atau ajakan tindakan ilegal. Pesan netral, sapaan, dukungan, candaan ringan, atau kritik sopan = aman. Jangan terlalu sensitif terhadap singkatan biasa.",
          },
          { role: "user", content: `Pesan: "${text}"` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "moderate",
              description: "Putuskan apakah pesan boleh ditampilkan",
              parameters: {
                type: "object",
                properties: {
                  safe: { type: "boolean", description: "true jika pesan aman" },
                  reason: { type: "string", description: "Alasan singkat jika tidak aman" },
                  word: { type: "string", description: "Kata yang melanggar jika ada" },
                },
                required: ["safe"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "moderate" } },
      }),
    });

    if (!aiResp.ok) {
      // 429/402 → don't block legitimate users on AI failure
      console.error("AI moderation failed:", aiResp.status);
      return new Response(JSON.stringify({ allow: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResp.json();
    const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) {
      return new Response(JSON.stringify({ allow: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = JSON.parse(args);
    if (parsed.safe === false) {
      return new Response(
        JSON.stringify({
          allow: false,
          reason: parsed.reason || "Pesan terdeteksi tidak pantas",
          word: parsed.word,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ allow: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("moderate-chat error:", e);
    return new Response(JSON.stringify({ allow: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
