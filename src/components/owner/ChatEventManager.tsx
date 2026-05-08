import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Vote, HelpCircle, Plus, Trash2, Eye, EyeOff, Power, X } from "lucide-react";

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

const ChatEventManager = () => {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [type, setType] = useState<"poll" | "quiz">("poll");
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [correct, setCorrect] = useState<number>(0);
  const [busy, setBusy] = useState(false);

  const fetchAll = useCallback(async () => {
    const { data } = await supabase.from("chat_events" as any).select("*").order("created_at", { ascending: false }).limit(20);
    const list = ((data as any[]) || []) as EventRow[];
    setEvents(list);
    if (list.length) {
      const { data: r } = await supabase.from("chat_event_responses" as any).select("event_id").in("event_id", list.map((e) => e.id));
      const c: Record<string, number> = {};
      ((r as any[]) || []).forEach((row) => { c[row.event_id] = (c[row.event_id] || 0) + 1; });
      setCounts(c);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const ch = supabase.channel("owner_chat_events_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_events" }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_event_responses" }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchAll]);

  const addOption = () => setOptions((o) => (o.length >= 6 ? o : [...o, ""]));
  const removeOption = (i: number) => setOptions((o) => o.filter((_, idx) => idx !== i));
  const setOption = (i: number, v: string) => setOptions((o) => o.map((x, idx) => (idx === i ? v : x)));

  const handleCreate = async () => {
    const q = question.trim();
    const opts = options.map((o) => o.trim()).filter(Boolean);
    if (!q || opts.length < 2) { alert("Pertanyaan & minimal 2 pilihan diperlukan"); return; }
    if (type === "quiz" && (correct < 0 || correct >= opts.length)) { alert("Pilih jawaban benar"); return; }
    setBusy(true);
    const payload: any = {
      type,
      question: q,
      options: opts,
      correct_answer: type === "quiz" ? opts[correct] : null,
      is_active: true,
      reveal_answer: false,
    };
    const { error } = await supabase.from("chat_events" as any).insert(payload);
    setBusy(false);
    if (error) { alert("Gagal: " + error.message); return; }
    setQuestion(""); setOptions(["", ""]); setCorrect(0);
  };

  const toggleActive = async (e: EventRow) => {
    await supabase.from("chat_events" as any).update({ is_active: !e.is_active } as any).eq("id", e.id);
  };
  const toggleReveal = async (e: EventRow) => {
    await supabase.from("chat_events" as any).update({ reveal_answer: !e.reveal_answer } as any).eq("id", e.id);
  };
  const remove = async (id: string) => {
    if (!confirm("Hapus event ini? Semua respon ikut terhapus.")) return;
    await supabase.from("chat_events" as any).delete().eq("id", id);
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-5">
      <h2 className="font-semibold text-foreground flex items-center gap-2">
        <Vote size={18} /> Voting & Tebak-tebakan
      </h2>

      <div className="space-y-3 border border-border rounded-lg p-3 bg-secondary/20">
        <div className="flex gap-2">
          <button type="button" onClick={() => setType("poll")}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-all flex items-center justify-center gap-1.5 ${type === "poll" ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-foreground"}`}>
            <Vote size={14} /> Voting
          </button>
          <button type="button" onClick={() => setType("quiz")}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-all flex items-center justify-center gap-1.5 ${type === "quiz" ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-foreground"}`}>
            <HelpCircle size={14} /> Tebak-tebakan
          </button>
        </div>

        <input type="text" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={200}
          placeholder={type === "poll" ? "Pertanyaan voting…" : "Tebak: …"}
          className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />

        <div className="space-y-1.5">
          {options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              {type === "quiz" && (
                <input type="radio" name="correct" checked={correct === i} onChange={() => setCorrect(i)}
                  className="accent-primary" title="Tandai sebagai jawaban benar" />
              )}
              <input type="text" value={o} onChange={(e) => setOption(i, e.target.value)} maxLength={80}
                placeholder={`Pilihan ${i + 1}`}
                className="flex-1 bg-input border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
              {options.length > 2 && (
                <button type="button" onClick={() => removeOption(i)} className="p-1.5 text-muted-foreground hover:text-destructive">
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
          {options.length < 6 && (
            <button type="button" onClick={addOption} className="text-xs text-primary hover:underline flex items-center gap-1">
              <Plus size={12} /> Tambah pilihan
            </button>
          )}
        </div>

        <button onClick={handleCreate} disabled={busy}
          className="w-full bg-primary text-primary-foreground py-2 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50">
          {busy ? "Mengirim…" : "🚀 Kirim ke Live Chat"}
        </button>
      </div>

      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase">Riwayat</h3>
        {events.length === 0 && <p className="text-xs text-muted-foreground">Belum ada event.</p>}
        {events.map((e) => (
          <div key={e.id} className="border border-border rounded-lg p-3 bg-background/40">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${e.type === "poll" ? "bg-blue-500/20 text-blue-400" : "bg-purple-500/20 text-purple-400"}`}>
                    {e.type === "poll" ? "VOTING" : "TEBAKAN"}
                  </span>
                  {e.is_active ? (
                    <span className="text-[10px] text-green-500">● AKTIF</span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">○ ditutup</span>
                  )}
                  <span className="text-[10px] text-muted-foreground ml-auto">{counts[e.id] || 0} respon</span>
                </div>
                <p className="text-sm text-foreground truncate">{e.question}</p>
              </div>
            </div>
            <div className="flex gap-1.5 mt-2">
              <button onClick={() => toggleActive(e)} className="flex-1 text-xs px-2 py-1 rounded bg-secondary hover:bg-accent text-foreground flex items-center justify-center gap-1">
                <Power size={11} /> {e.is_active ? "Tutup" : "Buka"}
              </button>
              {e.type === "quiz" && (
                <button onClick={() => toggleReveal(e)} className="flex-1 text-xs px-2 py-1 rounded bg-secondary hover:bg-accent text-foreground flex items-center justify-center gap-1">
                  {e.reveal_answer ? <><EyeOff size={11} /> Tutup jawaban</> : <><Eye size={11} /> Tampilkan jawaban</>}
                </button>
              )}
              <button onClick={() => remove(e.id)} className="text-xs px-2 py-1 rounded bg-destructive/15 hover:bg-destructive/25 text-destructive flex items-center gap-1">
                <Trash2 size={11} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChatEventManager;
