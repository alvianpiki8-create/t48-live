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
import { useWeeklyViewers } from "@/hooks/useWeeklyViewers";
import { useRealtimeChat } from "@/hooks/useRealtimeChat";

const Index = () => {
  const navigate = useNavigate();
  const [nickname, setNickname] = useState<string | null>(() => sessionStorage.getItem("teamlive_nickname"));
  const viewerCount = useViewerPresence();
  const weeklyViewers = useWeeklyViewers();
  const { messages, sendMessage, isBanned, banReason } = useRealtimeChat();
  const [tokenCode, setTokenCode] = useState<string | null>(null);
  const [tokenShowId, setTokenShowId] = useState<string | null>(null);
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
      setTokenShowId((data as any).show_id || null);
    };
    validate();

    const channel = supabase.channel("token_realtime")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "access_tokens", filter: `token_code=eq.${token}` }, (payload) => {
        if ((payload.new as any).is_blocked) { sessionStorage.removeItem("teamlive_token"); setAccessDenied(true); }
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    const applySettings = async (data: any) => {
      if (!data) return;
      let tokenShow: any = null;
      if (tokenShowId) {
        const { data: show } = await supabase.from("show_catalog").select("title,show_date,background_url,lineup").eq("id", tokenShowId).maybeSingle();
        tokenShow = show;
      }
      setVideoId(data.video_id || "");
      setChannelName(data.channel_name || "TEAM Live");
      setStreamTitle(tokenShow?.title || data.stream_title || "Siaran Langsung");
      setChannelAvatar(data.channel_avatar || "");
      setChannelAvatar2(data.channel_avatar_2 || "");
      setCountdownBackground(tokenShow?.background_url || data.countdown_background || "");
      setStreamSourceUrl(data.stream_source_url || "");
      setStreamSourceUrl2(data.stream_source_url_2 || "");
      setLogoUrl(data.logo_url || "");
      setLineup(tokenShow?.lineup || data.lineup || []);
      const countdownTarget = tokenShow?.show_date || data.countdown_datetime;
      if (countdownTarget) {
        const target = new Date(countdownTarget).getTime();
        if (target > Date.now()) { setCountdownDatetime(countdownTarget); setCountdownDone(false); }
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
      .on("postgres_changes", { event: "*", schema: "public", table: "show_catalog" }, () => fetchSettings())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tokenShowId]);

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
          <CommentSection nickname={nickname} messages={messages} onSendMessage={handleSendMessage} isBanned={isBanned} banReason={banReason} />
          <OrderShowBanner />
        </main>

        <footer className="text-center py-5 space-y-3 px-4">
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 max-w-4xl mx-auto">
            <p className="text-destructive text-xs font-medium">⚠️ Dilarang restream dari sini! Jika ketahuan, akses akan kami blokir. Kode T4-**** adalah tanda unik Anda — pelanggaran akan terdeteksi.</p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <a href="https://whatsapp.com/channel/0029VbBgutpEKyZFRQ8hK33l" target="_blank" rel="noreferrer" className="inline-flex items-center justify-center text-sm text-foreground hover:text-primary transition-colors">Saluran WhatsApp Kami</a>
            <a
              href={`https://wa.me/6282135963767?text=${encodeURIComponent("Halo admin TEAM Live, saya butuh bantuan / konfirmasi pembayaran 🙏")}`}
              target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-green-500/15 border border-green-500/30 text-green-500 hover:bg-green-500/25 transition-colors"
            >
              💬 WA Admin: +62 821-3596-3767
            </a>
          </div>
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
          <div
            className="max-w-4xl mx-auto bg-gradient-to-r from-primary/10 via-card/60 to-primary/10 border border-primary/30 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-center gap-2 shadow-lg backdrop-blur-sm"
            style={{ animation: "fade-in 0.5s ease-out" }}
          >
            <span className="w-2.5 h-2.5 bg-primary rounded-full shadow-[0_0_10px_hsl(var(--primary))]" style={{ animation: "pulse-live 1.5s infinite" }} />
            <span className="text-sm text-muted-foreground text-center">
              Kami telah melayani{" "}
              <span
                key={weeklyViewers}
                className="text-foreground font-mono font-bold text-lg text-primary inline-block"
                style={{ animation: "fade-in 0.4s ease-out" }}
              >
                {weeklyViewers.toLocaleString("id-ID")}
              </span>{" "}
              orang dalam minggu ini
            </span>
          </div>
          <div className="max-w-4xl mx-auto flex flex-col items-center gap-2">
            <div className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full bg-primary/10 border border-primary/30 text-foreground">
              <span className="text-base leading-none">🤖</span>
              <span>Website ini telah dilengkapi fitur <span className="text-primary font-semibold">AI Moderasi Chat</span> otomatis</span>
            </div>
            <p className="text-[10px] text-muted-foreground/60">Kapasitas server: hingga ~10.000 penonton bersamaan · Streaming real-time tanpa lag</p>
          </div>
          <div className="text-muted-foreground/30 text-xs font-mono">Powered by TEAM Live · @t48id</div>
        </footer>
      </div>
    </>
  );
};

export default Index;
