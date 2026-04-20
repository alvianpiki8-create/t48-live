import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Settings } from "lucide-react";
import RainEffect from "@/components/RainEffect";
import LivePlayer from "@/components/LivePlayer";
import ChannelInfo from "@/components/ChannelInfo";
import CommentSection from "@/components/CommentSection";
import NicknameModal from "@/components/NicknameModal";
import AntiInspect from "@/components/AntiInspect";
import AntiRestream from "@/components/AntiRestream";
import CountdownOverlay from "@/components/CountdownOverlay";
import OrderShowBanner from "@/components/OrderShowBanner";
import LineupDisplay from "@/components/LineupDisplay";
import { supabase } from "@/integrations/supabase/client";
import { getDeviceId } from "@/lib/deviceId";
import { useViewerPresence } from "@/hooks/useViewerPresence";
import { useRealtimeChat } from "@/hooks/useRealtimeChat";

const Index = () => {
  const navigate = useNavigate();
  const [nickname, setNickname] = useState<string | null>(() => sessionStorage.getItem("teamlive_nickname"));
  const viewerCount = useViewerPresence();
  const { messages, sendMessage } = useRealtimeChat();
  const [tokenCode, setTokenCode] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [countdownDatetime, setCountdownDatetime] = useState<string | null>(null);
  const [countdownDone, setCountdownDone] = useState(false);

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

  useEffect(() => {
    const token = sessionStorage.getItem("teamlive_token");
    const deviceId = getDeviceId();
    if (!token) { setAccessDenied(true); return; }

    const validate = async () => {
      const { data, error } = await supabase.from("access_tokens").select("*").eq("token_code", token).maybeSingle();
      if (error || !data || data.is_blocked) {
        sessionStorage.removeItem("teamlive_token"); setAccessDenied(true); return;
      }
      // Allow re-entry: if token is bound to another device, reject; else (unbound) bind to this device now
      if (data.device_id && data.device_id !== deviceId) {
        sessionStorage.removeItem("teamlive_token"); setAccessDenied(true); return;
      }
      if (!data.device_id) {
        await supabase.from("access_tokens").update({ device_id: deviceId, used_at: new Date().toISOString() }).eq("token_code", token);
      }
      if ((data as any).valid_until && new Date() > new Date((data as any).valid_until)) {
        sessionStorage.removeItem("teamlive_token"); setAccessDenied(true); return;
      }
      setTokenCode(data.token_code);
    };
    validate();

    const channel = supabase.channel("token_realtime")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "access_tokens", filter: `token_code=eq.${token}` }, (payload) => {
        if ((payload.new as any).is_blocked) { sessionStorage.removeItem("teamlive_token"); setAccessDenied(true); }
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    const applySettings = (data: any) => {
      if (!data) return;
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

    const fetchSettings = async () => {
      const { data } = await supabase.from("stream_settings").select("*").limit(1).maybeSingle();
      if (data) applySettings(data); else setCountdownDone(true);
    };
    fetchSettings();

    const channel = supabase.channel("stream_settings_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "stream_settings" }, (payload) => applySettings(payload.new))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleNickname = useCallback((name: string) => {
    sessionStorage.setItem("teamlive_nickname", name);
    setNickname(name);
  }, []);

  const handleSendMessage = useCallback((text: string) => {
    if (!nickname) return;
    sendMessage(nickname, text);
  }, [nickname, sendMessage]);

  if (accessDenied) {
    return (
      <><AntiInspect /><RainEffect />
        <div className="min-h-screen flex items-center justify-center px-4 relative z-10">
          <div className="bg-card border border-border rounded-xl p-8 w-full max-w-sm text-center" style={{ animation: "fade-in 0.3s ease-out" }}>
            <div className="text-4xl mb-4">🔒</div>
            <h2 className="text-foreground font-semibold text-lg">Akses Terbatas</h2>
            <p className="text-muted-foreground text-sm mt-2">Anda memerlukan link akses khusus untuk menonton siaran ini.</p>
            <p className="text-muted-foreground/30 text-xs font-mono mt-6">@t48id</p>
          </div>
        </div>
      </>
    );
  }

  if (!nickname) {
    return (
      <><AntiInspect /><RainEffect />
        <button onClick={() => navigate("/owner")} className="fixed top-3 right-3 z-50 p-2 rounded-lg bg-card/50 border border-border text-muted-foreground hover:text-foreground transition-colors backdrop-blur-sm" title="Owner Panel"><Settings size={16} /></button>
        <NicknameModal onSubmit={handleNickname} />
      </>
    );
  }

  return (
    <><AntiInspect /><AntiRestream /><RainEffect />
      <div className="relative z-10 min-h-screen">
        <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            {logoUrl && <img src={logoUrl} alt="Logo" className="w-8 h-8 rounded-lg object-cover" />}
            <h1 className="text-lg font-bold text-foreground tracking-tight">TEAM Live</h1>
            <span className="text-xs text-muted-foreground font-mono">@t48id</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>Hai, <span className="text-foreground font-medium">{nickname}</span></span>
            <button onClick={() => navigate("/owner")} className="p-1.5 rounded-md bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="Owner Panel"><Settings size={14} /></button>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-4 space-y-3">
          <div className="relative">
            {countdownDatetime && !countdownDone && (
              <div className="w-full" style={{ aspectRatio: "16/9" }}>
                <CountdownOverlay targetDatetime={countdownDatetime} onComplete={() => setCountdownDone(true)} backgroundImage={countdownBackground} />
              </div>
            )}
            {(countdownDone || !countdownDatetime) && (
              <LivePlayer videoId={videoId} sourceUrl={streamSourceUrl} sourceUrl2={streamSourceUrl2} watermarkText={tokenCode ? `T4-${tokenCode}` : "@t48id"} />
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
          <a href="https://whatsapp.com/channel/0029VbBgutpEKyZFRQ8hK33l" target="_blank" rel="noreferrer" className="inline-flex items-center justify-center text-sm text-foreground hover:text-primary transition-colors">Saluran WhatsApp Kami</a>
          <div className="max-w-4xl mx-auto bg-card/50 border border-border rounded-lg p-3 space-y-2">
            <p className="text-xs text-muted-foreground">Ganti perangkat? Reset akses device (maks. 2x per hari).</p>
            <button
              onClick={async () => {
                const today = new Date().toISOString().slice(0, 10);
                const key = "teamlive_reset_log";
                const raw = localStorage.getItem(key);
                let log: { date: string; count: number } = raw ? JSON.parse(raw) : { date: today, count: 0 };
                if (log.date !== today) log = { date: today, count: 0 };
                if (log.count >= 2) {
                  alert("Batas reset device tercapai (2x per hari). Coba lagi besok.");
                  return;
                }
                if (!confirm("Reset device akses? Anda harus memasukkan token lagi di perangkat baru.")) return;
                const token = sessionStorage.getItem("teamlive_token");
                if (token) {
                  await supabase.from("access_tokens").update({ device_id: null }).eq("token_code", token);
                }
                log.count += 1;
                localStorage.setItem(key, JSON.stringify(log));
                sessionStorage.removeItem("teamlive_token");
                sessionStorage.removeItem("teamlive_nickname");
                localStorage.removeItem("teamlive_device_id");
                alert(`Device direset. Sisa hari ini: ${2 - log.count}x`);
                window.location.href = "/";
              }}
              className="text-xs px-3 py-1.5 rounded-md bg-secondary hover:bg-secondary/80 text-foreground transition-colors"
            >
              🔄 Reset Device Akses
            </button>
          </div>
          <div className="text-muted-foreground/30 text-xs font-mono">Powered by TEAM Live · @t48id</div>
        </footer>
      </div>
    </>
  );
};

export default Index;
