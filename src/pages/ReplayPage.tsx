import { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KeyRound, ArrowLeft, Film, Lock, Crown, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getAccessToken } from "@/lib/tokenStore";
import { extractYouTubeVideoId } from "@/lib/youtube";

const UNLOCK_KEY = "teamlive_replay_unlocked_token";
const UNLOCK_SHOW_KEY = "teamlive_replay_unlocked_show";

interface ReplaySchedule {
  id: string;
  show_date: string;
  description: string | null;
  youtube_url: string | null;
  show_id: string | null;
}

const callReplay = async (payload: Record<string, unknown>) => {
  const { data, error } = await supabase.functions.invoke("replay-access", { body: payload });
  if (error) return null;
  return data as any;
};

const fmtLong = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
const fmtShort = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

/** Thumbnail otomatis dari YouTube — tidak perlu diatur owner. */
const Thumb = ({ url, title }: { url: string | null; title: string }) => {
  const id = extractYouTubeVideoId(url || "");
  const [src, setSrc] = useState(id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : "");
  if (!id || !src) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-secondary/40">
        <Film size={20} className="text-muted-foreground opacity-60" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={`Thumbnail replay ${title}`}
      loading="lazy"
      onError={() => setSrc(`https://i.ytimg.com/vi/${id}/mqdefault.jpg`)}
      className="w-full h-full object-cover"
    />
  );
};

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

  const fetchSiteName = useCallback(async () => {
    const { data: settings } = await supabase
      .from("stream_settings").select("site_name")
      .order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (settings?.site_name) setSiteName(settings.site_name);
  }, []);

  useEffect(() => { fetchSiteName(); }, [fetchSiteName]);

  const membershipMode = searchParams.get("m") === "1";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await callReplay({ action: "membership", secret: getAccessToken() || "" });
      if (cancelled) return;
      if (res?.schedules) {
        setMembershipActive(true);
        if (membershipMode) setSchedules(res.schedules as ReplaySchedule[]);
      } else {
        setMembershipActive(false);
      }
      setCheckingMembership(false);
    })();
    return () => { cancelled = true; };
  }, [membershipMode]);

  useEffect(() => {
    if (membershipMode || !activeToken) return;
    let cancelled = false;
    (async () => {
      const res = await callReplay({ action: "unlock", secret: activeToken });
      if (cancelled) return;
      if (res?.schedules?.length) {
        setSchedules(res.schedules as ReplaySchedule[]);
      } else {
        sessionStorage.removeItem(UNLOCK_KEY);
        sessionStorage.removeItem(UNLOCK_SHOW_KEY);
        setActiveToken(null);
        setSchedules([]);
      }
    })();
    return () => { cancelled = true; };
  }, [activeToken, membershipMode]);

  useEffect(() => {
    const ch = supabase.channel("replay_page_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "stream_settings" }, fetchSiteName)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchSiteName]);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    const t = inputToken.trim();
    if (!t) { setErr("Masukkan sandi."); return; }

    const res = await callReplay({ action: "unlock", secret: t });
    if (res?.schedules?.length) {
      sessionStorage.setItem(UNLOCK_KEY, t);
      if (res.show_id) sessionStorage.setItem(UNLOCK_SHOW_KEY, res.show_id);
      else sessionStorage.removeItem(UNLOCK_SHOW_KEY);
      setSchedules(res.schedules as ReplaySchedule[]);
      setActiveToken(t);
      setInputToken("");
      return;
    }

    if (res?.error === "no_video") { setErr("Video belum diatur untuk sandi ini."); return; }
    if (res?.error === "expired") { setErr("Token sudah kadaluarsa."); return; }
    if (res?.error === "no_show") { setErr("Token ini belum tertaut ke ID show manapun."); return; }
    setErr("Sandi tidak valid.");
  };

  const handleLogout = () => {
    sessionStorage.removeItem(UNLOCK_KEY);
    sessionStorage.removeItem(UNLOCK_SHOW_KEY);
    setActiveToken(null);
    setSchedules([]);
    setSelectedId(null);
  };

  if (checkingMembership && membershipMode) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  const unlocked = (membershipMode && membershipActive) || Boolean(activeToken);
  const withVideo = unlocked ? schedules.filter((s) => s.youtube_url) : [];
  const active = withVideo.find((s) => s.id === selectedId) || withVideo[0] || null;
  const activeVideoId = active ? extractYouTubeVideoId(active.youtube_url || "") : null;

  // ---- Locked screen ----
  if (!unlocked || !active) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="bg-card border border-border rounded-2xl p-8 w-full max-w-sm" style={{ animation: "fade-in 0.3s ease-out" }}>
          <div className="text-center mb-6">
            <div className="inline-flex p-3 rounded-full bg-primary/10 mb-3"><Lock size={24} className="text-primary" /></div>
            <h1 className="text-xl font-bold text-foreground">Halaman Replay</h1>
            <p className="text-muted-foreground text-sm mt-1">Masukkan sandi replay untuk menonton.</p>
          </div>
          <form onSubmit={handleUnlock} className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1 flex items-center gap-1.5"><KeyRound size={14} /> Sandi Replay</label>
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
          {membershipActive && !membershipMode && (
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

  // ---- Unlocked screen (token & membership berbagi tata letak yang sama) ----
  const activeTitle = active.description || fmtLong(active.show_date);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-border bg-card/80 backdrop-blur">
        <div className="flex items-center gap-2 min-w-0">
          {membershipMode ? <Crown size={18} className="text-primary shrink-0" /> : <Film size={18} className="text-primary shrink-0" />}
          <h1 className="text-sm font-bold text-foreground truncate">
            {membershipMode ? "Replay Membership" : "Halaman Replay"}
          </h1>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {!membershipMode && (
            <button onClick={handleLogout} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              <Lock size={12} /> Kunci
            </button>
          )}
          <button onClick={() => navigate(membershipMode ? "/membership-live" : "/")} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            <ArrowLeft size={14} /> Kembali
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 space-y-5">
        <div className="rounded-xl overflow-hidden border border-border bg-black aspect-video shadow-lg">
          {activeVideoId ? (
            <iframe
              key={active.id}
              src={`https://www.youtube-nocookie.com/embed/${activeVideoId}?rel=0&modestbranding=1&autoplay=1`}
              title={`Replay ${activeTitle}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen className="w-full h-full border-0"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
              <Film size={40} className="mb-3 opacity-50" /> Video belum tersedia.
            </div>
          )}
        </div>

        <div>
          <h2 className="text-base font-bold text-foreground">{activeTitle}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{fmtShort(active.show_date)}</p>
        </div>

        {withVideo.length > 1 && (
          <section className="space-y-3">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Daftar Video ({withVideo.length})</p>
            <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
              {withVideo.map((s) => {
                const isActive = active.id === s.id;
                const title = s.description || fmtLong(s.show_date);
                return (
                  <button
                    key={s.id}
                    onClick={() => { setSelectedId(s.id); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    className={`group text-left rounded-xl overflow-hidden border transition-all ${isActive ? "border-primary ring-1 ring-primary/40" : "border-border hover:border-primary/50"} bg-card`}
                  >
                    <div className="relative aspect-video bg-secondary/40">
                      <Thumb url={s.youtube_url} title={title} />
                      <div className={`absolute inset-0 flex items-center justify-center transition-opacity ${isActive ? "bg-primary/20 opacity-100" : "bg-black/30 opacity-0 group-hover:opacity-100"}`}>
                        <span className="w-9 h-9 rounded-full bg-background/85 flex items-center justify-center">
                          <Play size={15} className="text-foreground ml-0.5" />
                        </span>
                      </div>
                      {isActive && (
                        <span className="absolute top-1.5 left-1.5 text-[9px] font-bold uppercase tracking-wide bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
                          Diputar
                        </span>
                      )}
                    </div>
                    <div className="p-2.5">
                      <p className="text-xs font-semibold text-foreground line-clamp-2">{title}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{fmtShort(s.show_date)}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <p className="text-[10px] text-muted-foreground text-center pt-2">{siteName}</p>
      </main>
    </div>
  );
};

export default ReplayPage;
