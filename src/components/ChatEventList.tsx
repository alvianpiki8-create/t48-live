import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getDeviceId } from "@/lib/deviceId";
import { Vote, HelpCircle, CheckCircle2, XCircle, Lock } from "lucide-react";

interface EventRow {
  id: string;
  type: "poll" | "quiz";
  question: string;
  options: string[];
  correct_answer: string | null;
  is_active: boolean;
  reveal_answer: boolean;
  created_at: string;
}

interface Props { nickname: string }

const ChatEventList = ({ nickname }: Props) => {
  const [events, setEvents] = useState<EventRow[]>([]);
  // event_id -> {answer, total, breakdown:{option:count}}
  const [stats, setStats] = useState<Record<string, { mine: string | null; total: number; counts: Record<string, number> }>>({});
  const deviceId = getDeviceId();

  const fetchAll = useCallback(async () => {
    const { data } = await supabase
      .from("chat_events" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5);
    const list = ((data as any[]) || []) as EventRow[];
    setEvents(list);
    if (!list.length) { setStats({}); return; }
    const ids = list.map((e) => e.id);
    const { data: r } = await supabase
      .from("chat_event_responses" as any)
      .select("event_id, answer, device_id")
      .in("event_id", ids);
    const next: typeof stats = {};
    list.forEach((e) => { next[e.id] = { mine: null, total: 0, counts: {} }; });
    ((r as any[]) || []).forEach((row) => {
      const s = next[row.event_id]; if (!s) return;
      s.total += 1;
      s.counts[row.answer] = (s.counts[row.answer] || 0) + 1;
      if (row.device_id === deviceId) s.mine = row.answer;
    });
    setStats(next);
  }, [deviceId]);

  useEffect(() => {
    fetchAll();
    const ch = supabase.channel("chat_events_viewer_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_events" }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_event_responses" }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchAll]);

  const submit = async (e: EventRow, opt: string) => {
    if (!e.is_active) return;
    if (stats[e.id]?.mine) return;
    // Optimistic
    setStats((prev) => {
      const cur = prev[e.id] || { mine: null, total: 0, counts: {} };
      return { ...prev, [e.id]: { mine: opt, total: cur.total + 1, counts: { ...cur.counts, [opt]: (cur.counts[opt] || 0) + 1 } } };
    });
    const isCorrect = e.type === "quiz" && e.correct_answer != null ? opt === e.correct_answer : null;
    const { error } = await supabase.from("chat_event_responses" as any).insert({
      event_id: e.id, device_id: deviceId, nickname, answer: opt, is_correct: isCorrect,
    } as any);
    if (error && !/duplicate/i.test(error.message)) {
      // rollback
      setStats((prev) => {
        const cur = prev[e.id]; if (!cur) return prev;
        const counts = { ...cur.counts };
        counts[opt] = Math.max(0, (counts[opt] || 1) - 1);
        return { ...prev, [e.id]: { mine: null, total: Math.max(0, cur.total - 1), counts } };
      });
    }
  };

  if (!events.length) return null;

  return (
    <div className="space-y-2 mb-2">
      {events.map((e) => {
        const s = stats[e.id] || { mine: null, total: 0, counts: {} };
        const showResults = !!s.mine || !e.is_active || e.reveal_answer;
        return (
          <div key={e.id} className={`rounded-xl border px-3 py-2.5 ${e.type === "poll" ? "bg-blue-500/5 border-blue-500/30" : "bg-purple-500/5 border-purple-500/30"}`}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className={`inline-flex items-center gap-1 text-[9px] font-extrabold px-1.5 py-0.5 rounded ${e.type === "poll" ? "bg-blue-500 text-white" : "bg-purple-500 text-white"}`}>
                {e.type === "poll" ? <><Vote size={10} /> VOTING</> : <><HelpCircle size={10} /> TEBAKAN</>}
              </span>
              {!e.is_active && <span className="text-[9px] text-muted-foreground inline-flex items-center gap-0.5"><Lock size={9} /> ditutup</span>}
              <span className="text-[10px] text-muted-foreground ml-auto">{s.total} respon</span>
            </div>
            <p className="text-sm font-semibold text-foreground mb-2 break-words">{e.question}</p>
            <div className="space-y-1">
              {e.options.map((opt) => {
                const count = s.counts[opt] || 0;
                const pct = s.total ? Math.round((count / s.total) * 100) : 0;
                const isMine = s.mine === opt;
                const isCorrect = e.type === "quiz" && e.correct_answer === opt;
                const showCorrect = e.reveal_answer && isCorrect;
                const showWrong = e.reveal_answer && isMine && !isCorrect;
                return (
                  <button
                    key={opt}
                    onClick={() => submit(e, opt)}
                    disabled={!e.is_active || !!s.mine}
                    className={`relative w-full text-left rounded-lg overflow-hidden border transition-all px-2.5 py-1.5 text-xs font-medium ${
                      isMine ? "border-primary" : "border-border"
                    } ${!e.is_active || s.mine ? "cursor-default" : "hover:border-primary/60"} ${showCorrect ? "border-green-500" : ""} ${showWrong ? "border-red-500" : ""}`}
                  >
                    {showResults && (
                      <span
                        className={`absolute inset-y-0 left-0 transition-all ${isMine ? "bg-primary/25" : "bg-foreground/10"} ${showCorrect ? "bg-green-500/25" : ""} ${showWrong ? "bg-red-500/25" : ""}`}
                        style={{ width: `${pct}%` }}
                      />
                    )}
                    <span className="relative flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 truncate">
                        {showCorrect && <CheckCircle2 size={12} className="text-green-500 flex-shrink-0" />}
                        {showWrong && <XCircle size={12} className="text-red-500 flex-shrink-0" />}
                        <span className="truncate">{opt}</span>
                      </span>
                      {showResults && <span className="text-muted-foreground tabular-nums flex-shrink-0">{pct}% · {count}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ChatEventList;
