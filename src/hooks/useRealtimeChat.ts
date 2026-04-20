import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getDeviceId } from "@/lib/deviceId";

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
  const seenIds = useRef<Set<string>>(new Set());

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
            // Replace optimistic temp message with real one if same nickname+text in last 5s
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
    const color = getColorForNickname(nickname);
    const deviceId = getDeviceId();
    // Optimistic insert — appears instantly, no delay
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

    const { error } = await supabase.from("chat_messages").insert({
      nickname, text, color, device_id: deviceId,
    } as any);

    if (error) {
      // Roll back optimistic on failure
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    }
  }, []);

  return { messages, sendMessage };
};
