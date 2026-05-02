import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Trash2, MoreVertical, Flag } from "lucide-react";
import type { ChatMessage } from "@/hooks/useRealtimeChat";
import { supabase } from "@/integrations/supabase/client";
import { getDeviceId } from "@/lib/deviceId";
import badgeNetizen from "@/assets/badge-netizen.png";
import badgePentolan from "@/assets/badge-pentolan.png";
import badgeKuncen from "@/assets/badge-kuncen.png";
import badgeTuanMuda from "@/assets/badge-tuan-muda.png";
import badgeBosBesar from "@/assets/badge-bos-besar.png";
import badgeOwner from "@/assets/badge-owner.png";

const OWNER_NICKNAME = "TEAM Live";
const OWNER_CODE = "123323";

// IDN-Live style badge tiers (assigned deterministically per nickname → no flicker, no delay)
type BadgeTier = {
  name: string;
  image: string;
  pill: string;
  ring: string;
};

const BADGES: BadgeTier[] = [
  { name: "Netizen",   image: badgeNetizen,   pill: "bg-gradient-to-r from-slate-400 to-slate-500 text-white shadow-[0_0_10px_rgba(148,163,184,0.5)]",        ring: "ring-slate-400" },
  { name: "Pentolan",  image: badgePentolan,  pill: "bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-[0_0_10px_rgba(244,63,94,0.55)]",            ring: "ring-red-500" },
  { name: "Kuncen",    image: badgeKuncen,    pill: "bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-[0_0_10px_rgba(249,115,22,0.55)]",      ring: "ring-orange-500" },
  { name: "Tuan Muda", image: badgeTuanMuda,  pill: "bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-600 text-white shadow-[0_0_12px_rgba(217,70,239,0.6)]", ring: "ring-fuchsia-500" },
  { name: "Bos Besar", image: badgeBosBesar,  pill: "bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 text-white shadow-[0_0_14px_rgba(59,130,246,0.65)]",     ring: "ring-blue-500" },
];

const OWNER_BADGE: BadgeTier = {
  name: "OWNER",
  image: badgeOwner,
  pill: "bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-500 text-black shadow-[0_0_14px_rgba(251,191,36,0.7)]",
  ring: "ring-yellow-400",
};

// Premium tiers get a chat-bubble background highlight (like owner)
const PREMIUM_BG: Record<string, string> = {
  "Tuan Muda": "bg-gradient-to-r from-fuchsia-500/15 to-purple-600/10 border border-fuchsia-500/30",
  "Bos Besar": "bg-gradient-to-r from-cyan-400/15 to-indigo-600/10 border border-blue-500/30",
};

// Deterministic hash → same nickname always gets the same badge (no delay/flicker)
const hashString = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};

const getBadge = (nickname: string): BadgeTier => {
  if (nickname === OWNER_NICKNAME) return OWNER_BADGE;
  return BADGES[hashString(nickname) % BADGES.length];
};

interface CommentSectionProps {
  nickname: string;
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  isOwner?: boolean;
  userCode?: string;
  isBanned?: boolean;
  banReason?: string;
}

const CommentSection = ({ nickname, messages, onSendMessage, isOwner, isBanned, banReason }: CommentSectionProps) => {
  const [message, setMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAutoScrollRef = useRef(true);
  const [profileMap, setProfileMap] = useState<Record<string, string>>({});
  const [isModerator, setIsModerator] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfiles = async () => {
      const { data } = await supabase.from("profiles").select("user_code, nickname");
      if (data) {
        const map: Record<string, string> = {};
        (data as any[]).forEach(p => { map[p.nickname] = p.user_code; });
        setProfileMap(map);
      }
    };
    fetchProfiles();

    // Check if current device is moderator
    const checkMod = async () => {
      const deviceId = getDeviceId();
      const { data } = await supabase.from("moderators").select("id").eq("device_id", deviceId).maybeSingle();
      setIsModerator(!!data);
    };
    checkMod();

    const ch = supabase.channel("profiles_chat_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => fetchProfiles())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  useEffect(() => {
    if (isAutoScrollRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    isAutoScrollRef.current = scrollHeight - scrollTop - clientHeight < 60;
  }, []);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = message.trim();
    if (trimmed) { onSendMessage(trimmed); setMessage(""); }
  };

  const canModerate = isOwner || isModerator;

  const handleDeleteMsg = async (id: string) => {
    await supabase.from("chat_messages").delete().eq("id", id);
    setOpenMenu(null);
  };

  const handleClearAll = async () => {
    if (!confirm("Hapus SEMUA komentar? Aksi ini tidak bisa dibatalkan.")) return;
    await supabase.from("chat_messages").delete().not("id", "is", null);
  };

  const handleReport = async (msg: ChatMessage) => {
    if (msg.nickname === nickname) {
      alert("Anda tidak bisa melaporkan komentar sendiri.");
      setOpenMenu(null);
      return;
    }
    const reason = prompt("Alasan laporan (opsional):", "Komentar tidak pantas") || "";
    const { error } = await supabase.from("chat_reports").insert({
      message_id: msg.id,
      message_text: msg.text,
      message_nickname: msg.nickname,
      message_device_id: (msg as any).device_id || null,
      reporter_nickname: nickname,
      reporter_device_id: getDeviceId(),
      reason: reason || null,
    } as any);
    setOpenMenu(null);
    if (error) {
      alert("Gagal mengirim laporan: " + error.message);
    } else {
      alert("Laporan terkirim. Owner akan menindaklanjuti.");
    }
  };


  const getUserCode = (nick: string) => {
    if (nick === OWNER_NICKNAME) return OWNER_CODE;
    return profileMap[nick] || null;
  };

  const myBadge = getBadge(nickname);

  return (
    <div className="bg-card border border-border rounded-lg flex flex-col" style={{ height: "380px" }}>
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
          <span className="text-sm font-semibold text-foreground">Live Chat</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-mono">{messages.length} pesan</span>
          {canModerate && (
            <button onClick={handleClearAll} title="Hapus semua komentar"
              className="text-destructive hover:text-destructive/80 p-1 rounded hover:bg-destructive/10">
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>

      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        {messages.map((msg) => {
          const badge = getBadge(msg.nickname);
          const isMsgOwner = msg.nickname === OWNER_NICKNAME;
          const code = getUserCode(msg.nickname);
          return (
            <div key={msg.id}
              className={`group/msg relative flex items-start gap-2 py-1.5 px-2 rounded-xl transition-colors ${isMsgOwner ? "bg-gradient-to-r from-yellow-400/15 to-orange-500/10 border border-yellow-400/30" : (PREMIUM_BG[badge.name] || "hover:bg-secondary/30")}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5 ring-2 ${badge.ring}`}
                style={{ backgroundColor: msg.color, color: "hsl(var(--background))" }}>
                {msg.nickname.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`inline-flex items-center gap-1 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full ${badge.pill}`}>
                    <img src={badge.image} alt={badge.name} loading="lazy" width={16} height={16} className="w-4 h-4 object-contain drop-shadow" />
                    {badge.name}
                  </span>
                  <span className={`font-semibold text-xs ${isMsgOwner ? "text-yellow-500" : ""}`} style={isMsgOwner ? {} : { color: msg.color }}>
                    {msg.nickname}
                  </span>
                  {code && (<span className="text-[9px] font-mono text-muted-foreground bg-secondary px-1 py-0.5 rounded">#{code}</span>)}
                </div>
                <p className="text-sm text-foreground/90 break-words leading-snug">{msg.text}</p>
              </div>
              {canModerate && (
                <div className="relative">
                  <button onClick={() => setOpenMenu(openMenu === msg.id ? null : msg.id)}
                    className="opacity-0 group-hover/msg:opacity-100 p-1 rounded hover:bg-secondary text-muted-foreground transition-opacity">
                    <MoreVertical size={12} />
                  </button>
                  {openMenu === msg.id && (
                    <div className="absolute right-0 top-full mt-1 z-10 bg-card border border-border rounded-md shadow-lg overflow-hidden">
                      <button onClick={() => handleDeleteMsg(msg.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10 whitespace-nowrap">
                        <Trash2 size={10} /> Hapus
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground/50 text-sm">Belum ada pesan. Jadilah yang pertama!</p>
          </div>
        )}
      </div>

      {isBanned ? (
        <div className="p-3 border-t border-destructive/30 bg-destructive/10 text-center">
          <p className="text-xs text-destructive font-semibold">🚫 Anda diblokir dari chat selama 24 jam</p>
          <p className="text-[10px] text-muted-foreground mt-1">{banReason || "Mengandung kata tidak pantas"}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Akses chat akan otomatis kembali setelah 24 jam.</p>
        </div>
      ) : (
        <form onSubmit={handleSend} className="p-3 border-t border-border flex gap-2 items-center">
          <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-1 rounded-full flex-shrink-0 ${myBadge.pill}`}>
            <img src={myBadge.image} alt={myBadge.name} loading="lazy" width={16} height={16} className="w-4 h-4 object-contain drop-shadow" />
            {myBadge.name}
          </span>
          <input type="text" value={message} onChange={(e) => setMessage(e.target.value)}
            placeholder={`Chat sebagai ${nickname}...`} maxLength={200}
            className="flex-1 bg-input border border-border rounded-full px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors" />
          <button type="submit" disabled={!message.trim()}
            className="bg-primary text-primary-foreground p-2.5 rounded-full transition-all hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed">
            <Send size={14} />
          </button>
        </form>
      )}
    </div>
  );
};

export default CommentSection;
