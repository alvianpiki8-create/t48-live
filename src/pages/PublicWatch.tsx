import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Clock3 } from "lucide-react";
import RainEffect from "@/components/RainEffect";
import LivePlayer from "@/components/LivePlayer";
import ChannelInfo from "@/components/ChannelInfo";
import CommentSection from "@/components/CommentSection";
import NicknameModal from "@/components/NicknameModal";
import CountdownOverlay from "@/components/CountdownOverlay";
import OrderShowBanner from "@/components/OrderShowBanner";
import LineupDisplay from "@/components/LineupDisplay";
import { supabase } from "@/integrations/supabase/client";
import { getDeviceId } from "@/lib/deviceId";
import { useViewerPresence } from "@/hooks/useViewerPresence";
import { useRealtimeChat } from "@/hooks/useRealtimeChat";

interface PublicWatchProps {
  mode?: "public" | "membership" | "trial";
}

const PublicWatch = ({ mode = "public" }: PublicWatchProps) => {
  const navigate = useNavigate();
  const [nickname, setNickname] = useState<string | null>(() => sessionStorage.getItem("teamlive_nickname"));
  const viewerCount = useViewerPresence();
  const { messages, sendMessage } = useRealtimeChat();
  const [countdownDatetime, setCountdownDatetime] = useState<string | null>(null);
  const [countdownDone, setCountdownDone] = useState(false);
  const [publicEnabled, setPublicEnabled] = useState<boolean | null>(null);

  const [videoId, setVideoId] = useState("");
  const [channelName, setChannelName] = useState("TEAM Live");
  const [streamTitle, setStreamTitle] = useState("Siaran Langsung");
  const [channelAvatar, setChannelAvatar] = useState("");
  const [lineup, setLineup] = useState<any[]>([]);
  const [channelAvatar2, setChannelAvatar2] = useState("");
  const [countdownBackground, setCountdownBackground] = useState("");
  const [streamSourceUrl, setStreamSourceUrl] = useState("");
  const [streamSourceUrl2, setStreamSourceUrl2] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [membershipAllowed, setMembershipAllowed] = useState(mode !== "membership");
  const [trialAllowed, setTrialAllowed] = useState(mode !== "trial");
  const [trialSecondsLeft, setTrialSecondsLeft] = useState(180);

  useEffect(() => {
    const applySettings = (data: any) => {
      if (!data) return;
      setPublicEnabled(data.public_link_enabled ?? false);
      setVideoId(data.video_id || "");
      setChannelName(data.channel_name || "TEAM Live");
      setStreamTitle(data.stream_title || "Siaran Langsung");
      setChannelAvatar(data.channel_avatar || "");
      setChannelAvatar2(data.channel_avatar_2 || "");
      setCountdownBackground(data.countdown_background || "");
      setStreamSourceUrl(data.stream_source_url || "");
      setStreamSourceUrl2(data.stream_source_url_2 || "");
      setLogoUrl(data.logo_url || "");
      setLineup(data.lineup || []);
      if (data.countdown_datetime) {
        const target = new Date(data.countdown_datetime).getTime();
        if (target > Date.now()) { setCountdownDatetime(data.countdown_datetime); setCountdownDone(false); }
        else { setCountdownDatetime(null); setCountdownDone(true); }
      } else { setCountdownDatetime(null); setCountdownDone(true); }
    };

    const fetchData = async () => {
      const { data } = await supabase.from("stream_settings").select("*").limit(1).maybeSingle();
      if (data) applySettings(data); else { setPublicEnabled(false); setCountdownDone(true); }
    };
    fetchData();

    const channel = supabase.channel("public_stream_settings")
      .on("postgres_changes", { event: "*", schema: "public", table: "stream_settings" }, (payload) => applySettings(payload.new))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (mode !== "membership") return;
    const checkMembership = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth", { replace: true }); return; }
      const { data } = await (supabase as any)
        .from("user_memberships")
        .select("id")
        .eq("user_id", user.id)
        .gt("expires_at", new Date().toISOString())
        .order("expires_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setMembershipAllowed(Boolean(data));
    };
    checkMembership();
    const ch = supabase.channel("membership_watch_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "user_memberships" }, () => checkMembership())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [mode, navigate]);

  useEffect(() => {
    if (mode !== "trial") return;
    const deviceId = getDeviceId();
    const startTrial = async () => {
      const now = Date.now();
      const { data } = await (supabase as any)
        .from("livestream_trials")
        .select("started_at,expires_at,cooldown_until")
        .eq("device_id", deviceId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data && new Date(data.cooldown_until).getTime() > now && new Date(data.expires_at).getTime() <= now) {
        setTrialAllowed(false);
        return;
      }

      const activeExpiry = data && new Date(data.expires_at).getTime() > now ? new Date(data.expires_at).getTime() : now + 180000;
      if (!data || new Date(data.cooldown_until).getTime() <= now) {
        await (supabase as any).from("livestream_trials").insert({
          device_id: deviceId,
          expires_at: new Date(activeExpiry).toISOString(),
          cooldown_until: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
        });
      }
      setTrialAllowed(true);
      setTrialSecondsLeft(Math.max(0, Math.ceil((activeExpiry - Date.now()) / 1000)));
    };
    startTrial();
  }, [mode]);

  useEffect(() => {
    if (mode !== "trial" || !trialAllowed) return;
    const timer = window.setInterval(() => {
      setTrialSecondsLeft((left) => {
        if (left <= 1) {
          window.clearInterval(timer);
          navigate("/catalog", { replace: true });
          return 0;
        }
        return left - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [mode, trialAllowed, navigate]);

  const handleNickname = useCallback((name: string) => {
    sessionStorage.setItem("teamlive_nickname", name); setNickname(name);
  }, []);

  const handleSendMessage = useCallback((text: string) => {
    if (!nickname) return;
    sendMessage(nickname, text);
  }, [nickname, sendMessage]);

  if (publicEnabled === null) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }
  if (mode === "public" && !publicEnabled) {
    return (<><RainEffect /><div className="min-h-screen flex items-center justify-center px-4 relative z-10"><div className="bg-card border border-border rounded-xl p-8 w-full max-w-sm text-center"><div className="text-4xl mb-4">🔒</div><h2 className="text-foreground font-semibold text-lg">Link Publik Tidak Aktif</h2><p className="text-muted-foreground text-sm mt-2">Admin belum mengaktifkan akses publik.</p></div></div></>);
  }
  if (mode === "membership" && !membershipAllowed) {
    return (<><RainEffect /><div className="min-h-screen flex items-center justify-center px-4 relative z-10"><div className="bg-card border border-border rounded-xl p-8 w-full max-w-sm text-center"><div className="text-4xl mb-4">💎</div><h2 className="text-foreground font-semibold text-lg">Membership Belum Aktif</h2><p className="text-muted-foreground text-sm mt-2">Beli membership dulu untuk membuka livestreaming dan akses replay.</p><button onClick={() => navigate("/catalog")} className="mt-5 w-full bg-primary text-primary-foreground py-2.5 rounded-lg font-semibold">Beli Membership</button></div></div></>);
  }
  if (mode === "trial" && !trialAllowed) {
    return (<><RainEffect /><div className="min-h-screen flex items-center justify-center px-4 relative z-10"><div className="bg-card border border-border rounded-xl p-8 w-full max-w-sm text-center"><div className="text-4xl mb-4">⏳</div><h2 className="text-foreground font-semibold text-lg">Tester Sudah Dipakai</h2><p className="text-muted-foreground text-sm mt-2">Akses preview gratis bisa dicoba lagi setelah 24 jam.</p><button onClick={() => navigate("/catalog")} className="mt-5 w-full bg-primary text-primary-foreground py-2.5 rounded-lg font-semibold">Lihat Paket Akses</button></div></div></>);
  }
  if (!nickname) {
    return (<><RainEffect /><NicknameModal onSubmit={handleNickname} /></>);
  }

  return (
    <><RainEffect />
      <div className="relative z-10 min-h-screen">
        <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            {logoUrl && <img src={logoUrl} alt="Logo" className="w-8 h-8 rounded-lg object-cover" />}
            <h1 className="text-lg font-bold text-foreground tracking-tight">TEAM Live</h1>
            <span className="text-xs text-muted-foreground font-mono">@t48id</span>
          </div>
          <span className="text-sm text-muted-foreground">Hai, <span className="text-foreground font-medium">{nickname}</span></span>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-4 space-y-3">
          {mode === "trial" && (
            <div className="rounded-xl border border-primary/30 bg-card/80 backdrop-blur-sm p-3 flex items-center justify-between gap-3 animate-fade-in">
              <div className="flex items-center gap-2 min-w-0">
                <Clock3 size={18} className="text-primary flex-shrink-0" />
                <p className="text-sm text-foreground font-medium">Preview gratis sedang berjalan — nikmati cuplikan live sebelum memilih akses penuh.</p>
              </div>
              <span className="text-sm font-mono text-primary bg-primary/10 px-2.5 py-1 rounded-md">{Math.floor(trialSecondsLeft / 60)}:{String(trialSecondsLeft % 60).padStart(2, "0")}</span>
            </div>
          )}
          <div className="relative">
            {countdownDatetime && !countdownDone ? (
              <div className="w-full" style={{ aspectRatio: "16/9" }}><CountdownOverlay targetDatetime={countdownDatetime} onComplete={() => setCountdownDone(true)} backgroundImage={countdownBackground} /></div>
            ) : (
              <LivePlayer videoId={videoId} sourceUrl={streamSourceUrl} sourceUrl2={streamSourceUrl2} watermarkText="@t48id" />
            )}
          </div>
          <ChannelInfo channelName={channelName} channelAvatar={channelAvatar} channelAvatar2={channelAvatar2} viewerCount={viewerCount} streamTitle={streamTitle} />
          <LineupDisplay lineup={lineup} />
          <CommentSection nickname={nickname} messages={messages} onSendMessage={handleSendMessage} />
          <OrderShowBanner />
        </main>

        <footer className="text-center py-5 space-y-3 px-4">
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 max-w-4xl mx-auto">
            <p className="text-destructive text-xs font-medium">⚠️ Dilarang restream dari sini! Jika ketahuan, akses akan kami blokir. Kode T4-**** adalah tanda unik Anda — pelanggaran akan terdeteksi.</p>
          </div>
          <div className="text-muted-foreground/30 text-xs font-mono">Powered by TEAM Live · @t48id</div>
        </footer>
      </div>
    </>
  );
};

export default PublicWatch;
