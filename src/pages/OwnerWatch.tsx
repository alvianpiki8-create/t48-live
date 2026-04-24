import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Shield } from "lucide-react";
import RainEffect from "@/components/RainEffect";
import LivePlayer from "@/components/LivePlayer";
import ChannelInfo from "@/components/ChannelInfo";
import CommentSection from "@/components/CommentSection";
import LineupDisplay from "@/components/LineupDisplay";
import OrderShowBanner from "@/components/OrderShowBanner";
import { supabase } from "@/integrations/supabase/client";
import { useViewerPresence } from "@/hooks/useViewerPresence";
import { useRealtimeChat } from "@/hooks/useRealtimeChat";

const OWNER_AUTH_KEY = "teamlive_owner_auth";
const OWNER_NICKNAME = "TEAM Live";

const OwnerWatch = () => {
  const navigate = useNavigate();
  const viewerCount = useViewerPresence();
  const { messages, sendMessage } = useRealtimeChat();

  const [videoId, setVideoId] = useState("");
  const [channelName, setChannelName] = useState("TEAM Live");
  const [streamTitle, setStreamTitle] = useState("Siaran Langsung");
  const [channelAvatar, setChannelAvatar] = useState("");
  const [lineup, setLineup] = useState<any[]>([]);
  const [channelAvatar2, setChannelAvatar2] = useState("");

  const isAuthenticated = sessionStorage.getItem(OWNER_AUTH_KEY) === "true";

  useEffect(() => {
    const applySettings = (data: any) => {
      if (!data) return;
      setVideoId(data.video_id || "");
      setChannelName(data.channel_name || "TEAM Live");
      setStreamTitle(data.stream_title || "Siaran Langsung");
      setChannelAvatar(data.channel_avatar || "");
      setChannelAvatar2(data.channel_avatar_2 || "");
      setLineup(data.lineup || []);
    };

    const fetchSettings = async () => {
      const { data } = await supabase.from("stream_settings").select("*").order("updated_at", { ascending: false }).limit(1).maybeSingle();
      if (data) applySettings(data);
    };
    fetchSettings();

    const channel = supabase.channel("owner_watch_settings")
      .on("postgres_changes", { event: "*", schema: "public", table: "stream_settings" }, (payload) => applySettings(payload.new))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleSendMessage = useCallback((text: string) => {
    sendMessage(OWNER_NICKNAME, text);
  }, [sendMessage]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-background">
        <div className="bg-card border border-border rounded-xl p-8 w-full max-w-sm text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="text-foreground font-semibold text-lg">Akses Owner Diperlukan</h2>
          <p className="text-muted-foreground text-sm mt-2">Login melalui Owner Panel terlebih dahulu.</p>
          <button onClick={() => navigate("/owner")} className="mt-4 bg-primary text-primary-foreground px-6 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-all">
            Ke Owner Panel
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <RainEffect />
      <div className="relative z-10 min-h-screen">
        <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate("/owner")} className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft size={18} />
            </button>
            <h1 className="text-lg font-bold text-foreground tracking-tight">TEAM Live</h1>
            <div className="flex items-center gap-1 bg-primary/20 text-primary px-2 py-0.5 rounded-full">
              <Shield size={10} />
              <span className="text-[10px] font-bold">OWNER</span>
            </div>
          </div>
          <span className="text-sm text-muted-foreground">
            <span className="text-primary font-semibold">{OWNER_NICKNAME}</span>
          </span>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-4 space-y-3">
          <LivePlayer videoId={videoId} watermarkText="OWNER" />
          <ChannelInfo channelName={channelName} channelAvatar={channelAvatar} channelAvatar2={channelAvatar2} viewerCount={viewerCount} streamTitle={streamTitle} />
          <LineupDisplay lineup={lineup} />
          <CommentSection nickname={OWNER_NICKNAME} messages={messages} onSendMessage={handleSendMessage} isOwner />
          <OrderShowBanner />
        </main>

        <footer className="text-center py-5 space-y-2">
          <div className="text-muted-foreground/30 text-xs font-mono">Owner Mode · @t48id</div>
        </footer>
      </div>
    </>
  );
};

export default OwnerWatch;
