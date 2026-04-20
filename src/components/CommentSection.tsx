import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Crown, Trash2, MoreVertical } from "lucide-react";
import type { ChatMessage } from "@/hooks/useRealtimeChat";
import { supabase } from "@/integrations/supabase/client";
import { getDeviceId } from "@/lib/deviceId";

const OWNER_NICKNAME = "TEAM Live";
const OWNER_CODE = "123323";

// IDN-Live style badge tiers (assigned deterministically per nickname → no flicker, no delay)
type BadgeTier = {
  name: string;
  emoji: string;
  // Tailwind classes for the pill background (gradient) + text color
  pill: string;
  // Ring color around the avatar
  ring: string;
};

const BADGES: BadgeTier[] = [
  { name: "Netizen",   emoji: "🪙", pill: "bg-gradient-to-r from-slate-400 to-slate-500 text-white",       ring: "ring-slate-400" },
  { name: "Pentolan",  emoji: "😤", pill: "bg-gradient-to-r from-red-500 to-rose-600 text-white",          ring: "ring-red-500" },
  { name: "Kuncen",    emoji: "🥸", pill: "bg-gradient-to-r from-orange-500 to-amber-600 text-white",      ring: "ring-orange-500" },
  { name: "Tuan Muda", emoji: "🎩", pill: "bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white",    ring: "ring-fuchsia-500" },
  { name: "Bos Besar", emoji: "💎", pill: "bg-gradient-to-r from-blue-500 to-indigo-600 text-white",       ring: "ring-blue-500" },
];

const OWNER_BADGE: BadgeTier = {
  name: "OWNER",
  emoji: "👑",
  pill: "bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-500 text-black shadow-[0_0_12px_rgba(251,191,36,0.6)]",
  ring: "ring-yellow-400",
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
}

const CommentSection = ({ nickname, messages, onSendMessage, isOwner }: CommentSectionProps) => {
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

  const getTitle = (nick: string) => {
    if (nick === OWNER_NICKNAME) return "Owner";
    const len = nick.length;
    if (len <= 3) return "Newbie";
    if (len <= 5) return "Member";
    if (len <= 8) return "Fans";
    return "Super Fans";
  };

  const getTitleColor = (title: string) => {
    switch (title) {
      case "Owner": return "bg-primary text-primary-foreground";
      case "Super Fans": return "bg-primary/20 text-primary";
      case "Fans": return "bg-accent text-accent-foreground";
      case "Member": return "bg-secondary text-secondary-foreground";
      default: return "bg-muted text-muted-foreground";
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
              className={`group/msg relative flex items-start gap-2 py-1.5 px-2 rounded-xl transition-colors ${isMsgOwner ? "bg-gradient-to-r from-yellow-400/15 to-orange-500/10 border border-yellow-400/30" : "hover:bg-secondary/30"}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5 ring-2 ${badge.ring}`}
                style={{ backgroundColor: msg.color, color: "hsl(var(--background))" }}>
                {msg.nickname.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`inline-flex items-center gap-1 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full ${badge.pill}`}>
                    <span className="text-[10px] leading-none">{badge.emoji}</span>
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

      <form onSubmit={handleSend} className="p-3 border-t border-border flex gap-2 items-center">
        <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-1 rounded-full flex-shrink-0 ${myBadge.pill}`}>
          {isOwner ? <Crown size={10} /> : <span className="leading-none">{myBadge.emoji}</span>}
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
    </div>
  );
};

export default CommentSection;
