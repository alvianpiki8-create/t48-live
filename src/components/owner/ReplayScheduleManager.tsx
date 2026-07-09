import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Calendar, Lock, Youtube } from "lucide-react";

interface ReplaySchedule {
  id: string;
  show_date: string;
  replay_password: string;
  description: string | null;
  youtube_url: string | null;
}

const ReplayScheduleManager = () => {
  const [schedules, setSchedules] = useState<ReplaySchedule[]>([]);
  const [date, setDate] = useState("");
  const [password, setPassword] = useState("");
  const [desc, setDesc] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");

  const fetch = useCallback(async () => {
    const { data } = await supabase.from("replay_schedules").select("*").order("show_date", { ascending: false });
    if (data) setSchedules(data as any);
  }, []);

  useEffect(() => {
    fetch();
    const ch = supabase.channel("replay_sched_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "replay_schedules" }, () => fetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetch]);

  const handleAdd = async () => {
    if (!date || !password.trim() || !youtubeUrl.trim()) return;
    await supabase.from("replay_schedules").insert({
      show_date: date,
      replay_password: password.trim(),
      description: desc.trim() || null,
      youtube_url: youtubeUrl.trim(),
    } as any);
    setDate(""); setPassword(""); setDesc(""); setYoutubeUrl("");
    fetch();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("replay_schedules").delete().eq("id", id);
    fetch();
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Calendar size={18} className="text-primary" />
        <h2 className="font-semibold text-foreground">Replay Video (1 video = 1 token)</h2>
      </div>

      <div className="space-y-3 bg-secondary/20 rounded-lg p-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tambah Video Replay</p>
        <div className="grid grid-cols-2 gap-2">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="bg-input border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
          <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Token/Sandi"
            className="bg-input border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <input type="url" value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} placeholder="Link YouTube video replay"
          className="w-full bg-input border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
        <input type="text" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Keterangan show (opsional)"
          className="w-full bg-input border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
        <button onClick={handleAdd} disabled={!date || !password.trim() || !youtubeUrl.trim()}
          className="w-full bg-primary text-primary-foreground py-2 rounded-lg font-medium text-sm hover:opacity-90 flex items-center justify-center gap-2 disabled:opacity-50">
          <Plus size={14} /> Tambah
        </button>
      </div>

      <div className="space-y-2">
        {schedules.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Belum ada video replay.</p>}
        {schedules.map((s) => (
          <div key={s.id} className="bg-secondary/20 border border-border rounded-lg p-3 flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-foreground">{new Date(s.show_date + 'T00:00:00').toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span>
                <span className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-mono">
                  <Lock size={10} /> {s.replay_password}
                </span>
              </div>
              {s.description && <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>}
              {s.youtube_url && (
                <a href={s.youtube_url} target="_blank" rel="noreferrer" className="text-[11px] text-muted-foreground hover:text-primary flex items-center gap-1 mt-1 truncate">
                  <Youtube size={10} /> <span className="truncate">{s.youtube_url}</span>
                </a>
              )}
            </div>
            <button onClick={() => handleDelete(s.id)} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-destructive transition-colors shrink-0">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ReplayScheduleManager;
