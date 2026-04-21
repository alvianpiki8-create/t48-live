import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getDeviceId } from "@/lib/deviceId";
import { toast } from "@/hooks/use-toast";

export interface ChatMessage {
  id: string;
  nickname: string;
  text: string;
  color: string;
  device_id: string | null;
  created_at: string;
}

const NICKNAME_COLORS = [
  "hsl(0, 0%, 100%)",
  "hsl(340, 70%, 65%)",
  "hsl(200, 70%, 65%)",
  "hsl(50, 80%, 65%)",
  "hsl(120, 50%, 60%)",
  "hsl(280, 60%, 70%)",
  "hsl(30, 80%, 65%)",
  "hsl(170, 60%, 55%)",
];

export const getColorForNickname = (nickname: string) => {
  let hash = 0;
  for (let i = 0; i < nickname.length; i++) hash = nickname.charCodeAt(i) + ((hash << 5) - hash);
  return NICKNAME_COLORS[Math.abs(hash) % NICKNAME_COLORS.length];
};

export const useRealtimeChat = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isBanned, setIsBanned] = useState(false);
  const [banReason, setBanReason] = useState<string>("");
  const seenIds = useRef<Set<string>>(new Set());

  // Check ban status on mount + subscribe to changes
  useEffect(() => {
    const deviceId = getDeviceId();

    const checkBan = async () => {
      // Ban hanya berlaku 24 jam
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("chat_banned_devices" as any)
        .select("reason, created_at")
        .eq("device_id", deviceId)
        .gte("created_at", cutoff)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        setIsBanned(true);
        setBanReason((data as any).reason || "Diblokir karena pelanggaran (24 jam)");
      } else {
        setIsBanned(false);
        setBanReason("");
        // Bersihkan ban lama (>24 jam)
        await supabase.from("chat_banned_devices" as any).delete().eq("device_id", deviceId).lt("created_at", cutoff);
      }
    };
    checkBan();
    // Auto re-check every 5 minutes for ban expiry
    const banInterval = setInterval(checkBan, 5 * 60 * 1000);

    const banCh = supabase
      .channel("chat_bans_rt")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_banned_devices", filter: `device_id=eq.${deviceId}` },
        (payload) => {
          setIsBanned(true);
          setBanReason((payload.new as any).reason || "Diblokir karena pelanggaran");
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "chat_banned_devices" },
        () => checkBan()
      )
      .subscribe();

    return () => { supabase.removeChannel(banCh); clearInterval(banInterval); };
  }, []);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(200);
      if (data) {
        (data as ChatMessage[]).forEach((m) => seenIds.current.add(m.id));
        setMessages(data as ChatMessage[]);
      }
    };
    load();

    const channel = supabase
      .channel("realtime_chat")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload) => {
          const msg = payload.new as ChatMessage;
          if (seenIds.current.has(msg.id)) return;
          seenIds.current.add(msg.id);
          setMessages((prev) => {
            const tempIdx = prev.findIndex(
              (p) => p.id.startsWith("tmp-") && p.nickname === msg.nickname && p.text === msg.text
            );
            if (tempIdx >= 0) {
              const next = [...prev];
              next[tempIdx] = msg;
              return next;
            }
            const updated = [...prev, msg];
            return updated.length > 300 ? updated.slice(-200) : updated;
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "chat_messages" },
        (payload) => {
          const id = (payload.old as any).id;
          seenIds.current.delete(id);
          setMessages((prev) => prev.filter((m) => m.id !== id));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const sendMessage = useCallback(async (nickname: string, text: string) => {
    if (isBanned) {
      toast({
        title: "Anda diblokir dari chat",
        description: banReason,
        variant: "destructive",
      });
      return;
    }

    const color = getColorForNickname(nickname);
    const deviceId = getDeviceId();

    // Optimistic insert — appears instantly
    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const optimistic: ChatMessage = {
      id: tempId,
      nickname,
      text,
      color,
      device_id: deviceId,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    // Moderate in parallel — don't block UI
    try {
      const { data: modData } = await supabase.functions.invoke("moderate-chat", {
        body: { text },
      });

      if (modData && modData.allow === false) {
        // Remove optimistic message
        setMessages((prev) => prev.filter((m) => m.id !== tempId));

        // Ban this device
        await supabase.from("chat_banned_devices" as any).insert({
          device_id: deviceId,
          reason: modData.reason || "Mengandung kata tidak pantas",
          banned_word: modData.word || null,
        } as any);

        setIsBanned(true);
        setBanReason(modData.reason || "Mengandung kata tidak pantas");

        toast({
          title: "🚫 Pesan diblokir",
          description: `${modData.reason || "Kata tidak pantas terdeteksi"}. Anda tidak bisa chat lagi.`,
          variant: "destructive",
        });
        return;
      }
    } catch (e) {
      // Moderation failed → fall through to insert (don't block legitimate users)
      console.warn("Moderation skipped:", e);
    }

    const { error } = await supabase.from("chat_messages").insert({
      nickname, text, color, device_id: deviceId,
    } as any);

    if (error) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      toast({ title: "Gagal mengirim", description: error.message, variant: "destructive" });
    }
  }, [isBanned, banReason]);

  return { messages, sendMessage, isBanned, banReason };
};
