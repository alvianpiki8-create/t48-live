import { useState, useEffect } from "react";
import { Plus, Trash2, Film, CalendarClock, Save, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatShowSchedule } from "@/lib/showSchedule";
import { syncIdnShows } from "@/lib/syncIdnShows";

export interface Show {
  id: string;
  name: string;
  created_at: string;
  show_code?: string | null;
  show_date?: string | null;
  access_hour?: string | null;
  access_duration_hours?: number | null;
}

interface ShowManagerProps {
  shows: Show[];
  onRefresh: () => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, "0")}:00`);

const ShowManager = ({ shows, onRefresh }: ShowManagerProps) => {
  const [newShowName, setNewShowName] = useState("");
  const [newShowCode, setNewShowCode] = useState("");
  const [newShowDate, setNewShowDate] = useState("");
  const [newShowHour, setNewShowHour] = useState("19:00");
  const [newDuration, setNewDuration] = useState(24);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Record<string, Partial<Show>>>({});
  const [syncing, setSyncing] = useState(false);

  const handleSyncIdn = async (force = true) => {
    setSyncing(true);
    await syncIdnShows(force);
    setSyncing(false);
    onRefresh();
  };

  // Sinkron otomatis saat panel dibuka (throttle 5 menit)
  useEffect(() => {
    (async () => {
      const n = await syncIdnShows();
      if (n > 0) onRefresh();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const handleAddShow = async () => {
    if (!newShowName.trim() || !newShowCode.trim() || !newShowDate) return;
    setSaving(true);
    const { error } = await supabase.from("shows").insert({
      name: newShowName.trim(),
      show_code: newShowCode.trim(),
      show_date: newShowDate,
      access_hour: newShowHour,
      access_duration_hours: newDuration,
    } as any);
    setSaving(false);
    if (error) { alert("Gagal menambah show: " + error.message); return; }
    setNewShowName(""); setNewShowCode(""); setNewShowDate("");
    onRefresh();
  };

  const handleSaveEdit = async (show: Show) => {
    const patch = editing[show.id];
    if (!patch) return;
    const { error } = await supabase.from("shows").update(patch as any).eq("id", show.id);
    if (error) { alert("Gagal menyimpan: " + error.message); return; }
    setEditing((p) => { const n = { ...p }; delete n[show.id]; return n; });
    onRefresh();
  };

  const handleDeleteShow = async (id: string) => {
    if (!confirm("Hapus show ini?")) return;
    await supabase.from("shows").delete().eq("id", id);
    onRefresh();
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Film size={18} className="text-primary" />
        <h2 className="font-semibold text-foreground">Manajemen Show & Jadwal</h2>
        <button
          onClick={() => handleSyncIdn(true)}
          disabled={syncing}
          className="ml-auto flex items-center gap-1.5 text-xs bg-secondary hover:bg-secondary/70 text-foreground px-2.5 py-1.5 rounded-lg disabled:opacity-50"
        >
          <RefreshCw size={12} className={syncing ? "animate-spin" : ""} />
          {syncing ? "Sinkron..." : "Sync Jadwal IDN"}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        Setiap show wajib punya ID, judul, tanggal & jam. Jadwal resmi IDN+ (judul, ID show, jam, poster) tersinkron otomatis. Link/token yang dibuat untuk show ini otomatis aktif tepat pada jadwalnya.
      </p>

      <div className="space-y-2 bg-secondary/20 rounded-lg p-3">
        <input
          type="text"
          value={newShowCode}
          onChange={(e) => setNewShowCode(e.target.value)}
          placeholder="ID Show (wajib, contoh: SHOW-01)"
          className="w-full bg-input border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <input
          type="text"
          value={newShowName}
          onChange={(e) => setNewShowName(e.target.value)}
          placeholder="Judul show (contoh: Pajama Drive)"
          className="w-full bg-input border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <div className="grid grid-cols-3 gap-2">
          <input
            type="date"
            value={newShowDate}
            onChange={(e) => setNewShowDate(e.target.value)}
            className="bg-input border border-border rounded-lg px-2 py-2 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <select
            value={newShowHour}
            onChange={(e) => setNewShowHour(e.target.value)}
            className="bg-input border border-border rounded-lg px-2 py-2 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
          <select
            value={newDuration}
            onChange={(e) => setNewDuration(Number(e.target.value))}
            className="bg-input border border-border rounded-lg px-2 py-2 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {[6, 12, 24, 48, 72].map((d) => <option key={d} value={d}>{d} jam</option>)}
          </select>
        </div>
        <button
          onClick={handleAddShow}
          disabled={saving || !newShowName.trim() || !newShowCode.trim() || !newShowDate}
          className="w-full bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-all flex items-center justify-center gap-1 disabled:opacity-50"
        >
          <Plus size={14} /> Tambah Show
        </button>
      </div>

      <div className="space-y-1.5">
        {shows.map((show) => {
          const patch = editing[show.id] || {};
          const dirty = Object.keys(patch).length > 0;
          return (
            <div key={show.id} className="bg-secondary/30 rounded-lg px-3 py-2 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-foreground flex items-center gap-2 min-w-0">
                  {show.show_code && <span className="text-[10px] font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded shrink-0">{show.show_code}</span>}
                  <span className="truncate">{show.name}</span>
                </span>
                <div className="flex items-center gap-1">
                  {dirty && (
                    <button onClick={() => handleSaveEdit(show)} className="p-1 rounded-md hover:bg-primary/20 text-primary" title="Simpan">
                      <Save size={12} />
                    </button>
                  )}
                  <button onClick={() => handleDeleteShow(show.id)} className="p-1 rounded-md hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <input
                  type="date"
                  value={(patch.show_date ?? show.show_date) || ""}
                  onChange={(e) => setEditing((p) => ({ ...p, [show.id]: { ...patch, show_date: e.target.value } }))}
                  className="bg-input border border-border rounded px-1.5 py-1 text-[11px] text-foreground focus:outline-none"
                />
                <select
                  value={(patch.access_hour ?? show.access_hour) || "19:00"}
                  onChange={(e) => setEditing((p) => ({ ...p, [show.id]: { ...patch, access_hour: e.target.value } }))}
                  className="bg-input border border-border rounded px-1.5 py-1 text-[11px] text-foreground focus:outline-none"
                >
                  {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
                <select
                  value={Number(patch.access_duration_hours ?? show.access_duration_hours ?? 24)}
                  onChange={(e) => setEditing((p) => ({ ...p, [show.id]: { ...patch, access_duration_hours: Number(e.target.value) } }))}
                  className="bg-input border border-border rounded px-1.5 py-1 text-[11px] text-foreground focus:outline-none"
                >
                  {[6, 12, 24, 48, 72].map((d) => <option key={d} value={d}>{d} jam</option>)}
                </select>
              </div>
              <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                <CalendarClock size={10} /> Aktif mulai: {formatShowSchedule({ ...show, ...patch } as any)}
              </div>
            </div>
          );
        })}
        {shows.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2">Belum ada show</p>
        )}
      </div>
    </div>
  );
};

export default ShowManager;
