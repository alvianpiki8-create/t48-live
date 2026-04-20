import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Plus, Trash2 } from "lucide-react";

interface Moderator {
  id: string;
  device_id: string;
  nickname: string | null;
  created_at: string;
}

const ModeratorManager = () => {
  const [mods, setMods] = useState<Moderator[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [nickname, setNickname] = useState("");

  const fetchMods = useCallback(async () => {
    const { data } = await supabase.from("moderators").select("*").order("created_at", { ascending: false });
    if (data) setMods(data as any);
  }, []);

  useEffect(() => { fetchMods(); }, [fetchMods]);

  const handleAdd = async () => {
    if (!deviceId.trim()) return;
    await supabase.from("moderators").insert({ device_id: deviceId.trim(), nickname: nickname.trim() || null });
    setDeviceId(""); setNickname(""); fetchMods();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("moderators").delete().eq("id", id);
    fetchMods();
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Shield size={18} className="text-primary" />
        <h2 className="font-semibold text-foreground">Moderator Chat</h2>
      </div>
      <p className="text-xs text-muted-foreground">Tambahkan device ID user untuk memberi mereka kemampuan menghapus komentar. User bisa lihat device ID mereka di console browser dengan: <code className="bg-secondary px-1 rounded">localStorage.teamlive_device_id</code></p>

      <div className="space-y-2 bg-secondary/20 p-3 rounded-lg">
        <input type="text" value={deviceId} onChange={(e) => setDeviceId(e.target.value)}
          placeholder="Device ID (32 karakter hex)"
          className="w-full bg-input border border-border rounded-lg px-3 py-2 text-foreground text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring" />
        <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)}
          placeholder="Nickname (opsional)"
          className="w-full bg-input border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
        <button onClick={handleAdd}
          className="w-full bg-primary text-primary-foreground py-2 rounded-lg text-sm font-medium hover:opacity-90 flex items-center justify-center gap-2">
          <Plus size={14} /> Tambah Moderator
        </button>
      </div>

      <div className="space-y-2">
        {mods.length === 0 && <p className="text-sm text-muted-foreground text-center py-2">Belum ada moderator.</p>}
        {mods.map((m) => (
          <div key={m.id} className="flex items-center justify-between bg-secondary/20 rounded-lg p-2">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-foreground">{m.nickname || "(tanpa nama)"}</div>
              <div className="text-[10px] text-muted-foreground font-mono truncate">{m.device_id}</div>
            </div>
            <button onClick={() => handleDelete(m.id)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ModeratorManager;
