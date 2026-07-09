import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { KeyRound, ArrowLeft, Film, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { extractYouTubeVideoId } from "@/lib/youtube";

const UNLOCK_KEY = "teamlive_replay_unlocked_token";

interface ReplaySchedule {
  id: string;
  show_date: string;
  replay_password: string;
  description: string | null;
  youtube_url: string | null;
}

const ReplayPage = () => {
  const navigate = useNavigate();
  const [siteName, setSiteName] = useState<string>("TEAM Live");
  const [schedules, setSchedules] = useState<ReplaySchedule[]>([]);
  const [inputToken, setInputToken] = useState("");
  const [activeToken, setActiveToken] = useState<string | null>(() => sessionStorage.getItem(UNLOCK_KEY));
  const [err, setErr] = useState("");

  const fetchAll = useCallback(async () => {
    const [{ data: sched }, { data: settings }] = await Promise.all([
      supabase.from("replay_schedules").select("*").order("show_date", { ascending: false }),
      supabase.from("stream_settings").select("site_name").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    setSchedules((sched as any) || []);
    if (settings?.site_name) setSiteName(settings.site_name);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    const ch = supabase.channel("replay_page_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "replay_schedules" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "stream_settings" }, fetchAll)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchAll]);

  const currentVideo = activeToken
    ? schedules.find((s) => s.replay_password.trim() === activeToken.trim())
    : null;

  // If token no longer valid (deleted), auto-lock
  useEffect(() => {
    if (activeToken && schedules.length > 0 && !currentVideo) {
      sessionStorage.removeItem(UNLOCK_KEY);
      setActiveToken(null);
    }
  }, [activeToken, schedules, currentVideo]);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    const t = inputToken.trim();
    if (!t) { setErr("Masukkan token."); return; }
    const match = schedules.find((s) => s.replay_password.trim() === t);
    if (!match) { setErr("Token tidak valid."); return; }
    if (!match.youtube_url) { setErr("Video belum diatur untuk token ini."); return; }
    sessionStorage.setItem(UNLOCK_KEY, t);
    setActiveToken(t);
    setInputToken("");
  };

  const videoId = currentVideo ? extractYouTubeVideoId(currentVideo.youtube_url || "") : null;

  if (!activeToken || !currentVideo) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="bg-card border border-border rounded-xl p-8 w-full max-w-sm" style={{ animation: "fade-in 0.3s ease-out" }}>
          <div className="text-center mb-6">
            <div className="inline-flex p-3 rounded-full bg-primary/10 mb-3"><Lock size={24} className="text-primary" /></div>
            <h1 className="text-xl font-bold text-foreground">Halaman Replay</h1>
            <p className="text-muted-foreground text-sm mt-1">Masukkan token untuk menonton video replay</p>
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

  const handleLogout = () => {
    sessionStorage.removeItem(UNLOCK_KEY);
    setActiveToken(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50">
        <div className="flex items-center gap-2 min-w-0">
          <Film size={18} className="text-primary shrink-0" />
          <h1 className="text-sm font-bold text-foreground truncate">
            Replay · {currentVideo.description || new Date(currentVideo.show_date + 'T00:00:00').toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
          </h1>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button onClick={handleLogout} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            <Lock size={12} /> Kunci
          </button>
          <button onClick={() => navigate("/")} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            <ArrowLeft size={14} /> Kembali
          </button>
        </div>
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
            Video replay untuk token ini belum tersedia.
          </div>
        )}
        <p className="text-[10px] text-muted-foreground text-center mt-3">{siteName}</p>
      </main>
    </div>
  );
};

export default ReplayPage;
