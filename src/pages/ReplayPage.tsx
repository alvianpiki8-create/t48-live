import { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KeyRound, ArrowLeft, Film, Lock, Crown, Play } from "lucide-react";
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
  const [searchParams] = useSearchParams();
  const [siteName, setSiteName] = useState<string>("TEAM Live");
  const [schedules, setSchedules] = useState<ReplaySchedule[]>([]);
  const [inputToken, setInputToken] = useState("");
  const [activeToken, setActiveToken] = useState<string | null>(() => sessionStorage.getItem(UNLOCK_KEY));
  const [err, setErr] = useState("");
  const [membershipActive, setMembershipActive] = useState(false);
  const [checkingMembership, setCheckingMembership] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    const [{ data: sched }, { data: settings }] = await Promise.all([
      supabase.from("replay_schedules").select("*").order("show_date", { ascending: false }),
      supabase.from("stream_settings").select("site_name").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    setSchedules((sched as any) || []);
    if (settings?.site_name) setSiteName(settings.site_name);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Check membership session — if active, unlock everything
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { if (!cancelled) { setMembershipActive(false); setCheckingMembership(false); } return; }
        const { data } = await (supabase as any)
          .from("user_memberships")
          .select("id,expires_at")
          .eq("user_id", user.id)
          .gt("expires_at", new Date().toISOString())
          .limit(1)
          .maybeSingle();
        if (!cancelled) { setMembershipActive(Boolean(data)); setCheckingMembership(false); }
      } catch {
        if (!cancelled) setCheckingMembership(false);
      }
    };
    check();
    return () => { cancelled = true; };
  }, []);

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
    if (!t) { setErr("Masukkan sandi."); return; }
    const match = schedules.find((s) => s.replay_password.trim() === t);
    if (!match) { setErr("Sandi tidak valid."); return; }
    if (!match.youtube_url) { setErr("Video belum diatur untuk sandi ini."); return; }
    sessionStorage.setItem(UNLOCK_KEY, t);
    setActiveToken(t);
    setInputToken("");
  };

  // Membership all-access mode
  const membershipMode = searchParams.get("m") === "1" && membershipActive;

  if (checkingMembership && searchParams.get("m") === "1") {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (membershipMode) {
    const withVideo = schedules.filter((s) => s.youtube_url);
    const active = withVideo.find((s) => s.id === selectedId) || withVideo[0];
    const videoId = active ? extractYouTubeVideoId(active.youtube_url || "") : null;
    return (
      <div className="min-h-screen bg-background">
        <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50">
          <div className="flex items-center gap-2 min-w-0">
            <Crown size={18} className="text-primary shrink-0" />
            <h1 className="text-sm font-bold text-foreground truncate">Replay Membership</h1>
          </div>
          <button onClick={() => navigate("/membership-live")} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            <ArrowLeft size={14} /> Kembali ke Live
          </button>
        </header>
        <main className="max-w-4xl mx-auto p-4 space-y-4">
          {active && videoId ? (
            <div className="rounded-xl overflow-hidden border border-border bg-black aspect-video">
              <iframe
                key={active.id}
                src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&autoplay=1`}
                title="Replay" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen className="w-full h-full border-0"
              />
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
              <Film size={40} className="mx-auto mb-3 opacity-50" />
              Belum ada video replay tersedia.
            </div>
          )}
          {active && (
            <div className="text-sm text-foreground font-semibold">
              {active.description || new Date(active.show_date + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
            </div>
          )}
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Daftar Video ({withVideo.length})</p>
            <div className="grid gap-2">
              {withVideo.map((s) => {
                const isActive = active?.id === s.id;
                return (
                  <button key={s.id} onClick={() => setSelectedId(s.id)}
                    className={`text-left rounded-lg border p-3 flex items-center gap-3 transition-all ${isActive ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-secondary/30"}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isActive ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
                      <Play size={14} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-foreground truncate">
                        {s.description || new Date(s.show_date + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                      </div>
                      <div className="text-[10px] text-muted-foreground">{new Date(s.show_date + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground text-center pt-3">{siteName}</p>
        </main>
      </div>
    );
  }

  if (!activeToken || !currentVideo) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="bg-card border border-border rounded-xl p-8 w-full max-w-sm" style={{ animation: "fade-in 0.3s ease-out" }}>
          <div className="text-center mb-6">
            <div className="inline-flex p-3 rounded-full bg-primary/10 mb-3"><Lock size={24} className="text-primary" /></div>
            <h1 className="text-xl font-bold text-foreground">Halaman Replay</h1>
            <p className="text-muted-foreground text-sm mt-1">1 video = 1 sandi. Masukkan sandi untuk menonton.</p>
          </div>
          <form onSubmit={handleUnlock} className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block flex items-center gap-1.5"><KeyRound size={14} /> Sandi Replay</label>
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
          {membershipActive && (
            <button onClick={() => navigate("/replay?m=1")} className="w-full mt-3 bg-secondary text-foreground py-2 rounded-lg text-xs font-semibold hover:bg-accent flex items-center justify-center gap-1.5">
              <Crown size={12} /> Buka Semua Replay (Membership)
            </button>
          )}
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

  const videoId = currentVideo ? extractYouTubeVideoId(currentVideo.youtube_url || "") : null;

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
            Video replay untuk sandi ini belum tersedia.
          </div>
        )}
        <p className="text-[10px] text-muted-foreground text-center mt-3">{siteName}</p>
      </main>
    </div>
  );
};

export default ReplayPage;
