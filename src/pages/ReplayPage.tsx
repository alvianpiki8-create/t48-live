import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { KeyRound, ArrowLeft, Film, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { extractYouTubeVideoId } from "@/lib/youtube";

const UNLOCK_KEY = "teamlive_replay_unlocked";

interface ReplaySettings {
  replay_password?: string | null;
  replay_youtube_url?: string | null;
  site_name?: string | null;
}

const ReplayPage = () => {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<ReplaySettings | null>(null);
  const [inputToken, setInputToken] = useState("");
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(UNLOCK_KEY) === "true");
  const [err, setErr] = useState("");

  const fetchSettings = useCallback(async () => {
    const { data } = await supabase
      .from("stream_settings")
      .select("replay_password, replay_youtube_url, site_name" as any)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setSettings((data as any) || null);
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  // Realtime settings updates (so token/video changes reflect instantly)
  useEffect(() => {
    const ch = supabase.channel("replay_page_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "stream_settings" }, fetchSettings)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchSettings]);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    const expected = (settings?.replay_password || "").trim();
    if (!expected) { setErr("Owner belum mengatur token replay."); return; }
    if (inputToken.trim() !== expected) { setErr("Token salah."); return; }
    sessionStorage.setItem(UNLOCK_KEY, "true");
    setUnlocked(true);
  };

  const videoId = extractYouTubeVideoId(settings?.replay_youtube_url || "");

  if (!unlocked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="bg-card border border-border rounded-xl p-8 w-full max-w-sm" style={{ animation: "fade-in 0.3s ease-out" }}>
          <div className="text-center mb-6">
            <div className="inline-flex p-3 rounded-full bg-primary/10 mb-3"><Lock size={24} className="text-primary" /></div>
            <h1 className="text-xl font-bold text-foreground">Halaman Replay</h1>
            <p className="text-muted-foreground text-sm mt-1">Masukkan token untuk menonton</p>
          </div>
          <form onSubmit={handleUnlock} className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block flex items-center gap-1.5"><KeyRound size={14} /> Token Replay</label>
              <input
                type="password" value={inputToken} onChange={(e) => setInputToken(e.target.value)} autoComplete="off"
                className="w-full bg-input border border-border rounded-lg px-4 py-2.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring text-center font-mono tracking-[0.25em]"
                placeholder="••••••"
              />
            </div>
            {err && <p className="text-destructive text-sm text-center">{err}</p>}
            <button type="submit" disabled={!inputToken.trim()}
              className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg font-semibold hover:opacity-90 transition-all disabled:opacity-50">
              Buka Replay
            </button>
          </form>
          <button onClick={() => navigate("/")} className="w-full mt-3 text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1">
            <ArrowLeft size={12} /> Kembali
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50">
        <div className="flex items-center gap-2">
          <Film size={18} className="text-primary" />
          <h1 className="text-sm font-bold text-foreground">Replay · {settings?.site_name || "TEAM Live"}</h1>
        </div>
        <button onClick={() => navigate("/")} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
          <ArrowLeft size={14} /> Kembali
        </button>
      </header>
      <main className="max-w-3xl mx-auto p-4">
        {videoId ? (
          <div className="rounded-xl overflow-hidden border border-border bg-black aspect-video">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`}
              title="Replay" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen className="w-full h-full border-0"
            />
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
            <Film size={40} className="mx-auto mb-3 opacity-50" />
            Owner belum mengatur video replay.
          </div>
        )}
      </main>
    </div>
  );
};

export default ReplayPage;
