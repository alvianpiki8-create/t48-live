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
  is_pinned?: boolean;
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

  // Batch semua event realtime -> 1 render per interval (jauh lebih ringan saat rame)
  const pendingRef = useRef<{ inserts: ChatMessage[]; updates: ChatMessage[]; deletes: string[] }>({
    inserts: [],
    updates: [],
    deletes: [],
  });
  const flushTimerRef = useRef<number | null>(null);

  const flush = useCallback(() => {
    flushTimerRef.current = null;
    const { inserts, updates, deletes } = pendingRef.current;
    if (!inserts.length && !updates.length && !deletes.length) return;
    pendingRef.current = { inserts: [], updates: [], deletes: [] };

    setMessages((prev) => {
      let next = prev;
      if (updates.length) {
        const byId = new Map(updates.map((m) => [m.id, m]));
        next = next.map((m) => (byId.has(m.id) ? { ...m, ...byId.get(m.id)! } : m));
      }
      if (deletes.length) {
        const gone = new Set(deletes);
        next = next.filter((m) => !gone.has(m.id));
      }
      if (inserts.length) {
        if (next === prev) next = [...prev];
        for (const msg of inserts) {
          const tempIdx = next.findIndex(
            (p) => p.id.startsWith("tmp-") && p.nickname === msg.nickname && p.text === msg.text
          );
          if (tempIdx >= 0) next[tempIdx] = msg;
          else next.push(msg);
        }
        if (next.length > 300) next = next.slice(-200);
      }
      return next === prev ? prev : [...next];
    });
  }, []);

  const scheduleFlush = useCallback(() => {
    if (flushTimerRef.current != null) return;
    flushTimerRef.current = window.setTimeout(flush, 200);
  }, [flush]);

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
      .channel("realtime_chat", { config: { broadcast: { ack: false } } })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload) => {
          const msg = payload.new as ChatMessage;
          if (seenIds.current.has(msg.id)) return;
          seenIds.current.add(msg.id);
          pendingRef.current.inserts.push(msg);
          // Jangan biarkan antrian meledak kalau chat sangat ramai
          if (pendingRef.current.inserts.length > 100) pendingRef.current.inserts.splice(0, pendingRef.current.inserts.length - 100);
          scheduleFlush();
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chat_messages" },
        (payload) => {
          pendingRef.current.updates.push(payload.new as ChatMessage);
          scheduleFlush();
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "chat_messages" },
        (payload) => {
          const id = (payload.old as any).id;
          seenIds.current.delete(id);
          pendingRef.current.deletes.push(id);
          scheduleFlush();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (flushTimerRef.current != null) window.clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    };
  }, [scheduleFlush]);


  const lastSentRef = useRef(0);

  const sendMessage = useCallback(async (nickname: string, text: string) => {
    const isOwner = nickname === "TEAM Live";
    if (isBanned && !isOwner) {
      toast({
        title: "Anda diblokir dari chat",
        description: banReason,
        variant: "destructive",
      });
      return;
    }

    // Throttle kirim: cegah spam & antrian insert yang bikin chat delay
    const nowTs = Date.now();
    if (!isOwner && nowTs - lastSentRef.current < 1200) {
      toast({ title: "Tunggu sebentar", description: "Kirim pesan terlalu cepat." });
      return;
    }
    lastSentRef.current = nowTs;


    const color = getColorForNickname(nickname);
    const deviceId = getDeviceId();

    // Optimistic local insert — appears instantly for sender
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

    // Insert + moderate in parallel for instant fan-out to other viewers
    const insertPromise = supabase
      .from("chat_messages")
      .insert({ nickname, text, color, device_id: deviceId } as any)
      .select("id")
      .maybeSingle();

    const modPromise = isOwner
      ? Promise.resolve({ data: null, error: null } as any)
      : supabase.functions
          .invoke("moderate-chat", { body: { text } })
          .catch(() => ({ data: null, error: null } as any));

    const [{ data: inserted, error: insertError }, { data: modData }] = await Promise.all([
      insertPromise,
      modPromise,
    ]) as any;

    if (insertError) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      toast({ title: "Gagal mengirim", description: insertError.message, variant: "destructive" });
      return;
    }

    if (!isOwner && modData && modData.allow === false) {
      // Remove from local state and DB
      setMessages((prev) => prev.filter((m) => m.id !== tempId && m.id !== inserted?.id));
      if (inserted?.id) {
        await supabase.from("chat_messages").delete().eq("id", inserted.id);
      }

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
    }
  }, [isBanned, banReason]);

  return { messages, sendMessage, isBanned, banReason };
};
