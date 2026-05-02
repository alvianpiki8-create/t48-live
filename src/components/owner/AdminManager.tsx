import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ShieldAlert, Plus, Trash2, Ban, Check, RefreshCw, Activity } from "lucide-react";

interface Admin {
  id: string;
  name: string;
  code: string;
  is_blocked: boolean;
  blocked_reason: string | null;
  blocked_at: string | null;
  last_login_at: string | null;
  created_at: string;
}

interface LinkLog {
  id: string;
  admin_id: string;
  admin_name: string;
  link_type: string;
  token_code: string;
  show_name: string | null;
  duration_days: number | null;
  created_at: string;
}

const generateCode = () => {
  let s = "";
  for (let i = 0; i < 6; i++) s += Math.floor(Math.random() * 10).toString();
  return s;
};

const AdminManager = () => {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [logs, setLogs] = useState<LinkLog[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [expandedAdmin, setExpandedAdmin] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState(generateCode());
  const [blockingId, setBlockingId] = useState<string | null>(null);
  const [blockReason, setBlockReason] = useState("");

  const fetchAll = useCallback(async () => {
    const [a, l, c] = await Promise.all([
      supabase.from("admins").select("*").order("created_at", { ascending: false }),
      supabase.from("admin_link_logs").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("admin_link_logs").select("admin_id"),
    ]);
    setAdmins((a.data as any) || []);
    setLogs((l.data as any) || []);
    const tally: Record<string, number> = {};
    ((c.data as any[]) || []).forEach((r) => { tally[r.admin_id] = (tally[r.admin_id] || 0) + 1; });
    setCounts(tally);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Realtime subscription
  useEffect(() => {
    const ch = supabase.channel("owner_admin_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "admins" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_link_logs" }, fetchAll)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchAll]);

  const handleAdd = async () => {
    const name = newName.trim();
    const code = newCode.trim();
    if (!name || !code) { alert("Nama dan kode wajib"); return; }
    const { error } = await supabase.from("admins").insert({ name, code } as any);
    if (error) { alert("Gagal: " + error.message); return; }
    setNewName(""); setNewCode(generateCode());
  };

  const handleBlock = async (id: string) => {
    await supabase.from("admins").update({
      is_blocked: true,
      blocked_reason: blockReason || "Diblokir oleh owner",
      blocked_at: new Date().toISOString(),
    }).eq("id", id);
    setBlockingId(null); setBlockReason("");
  };

  const handleUnblock = async (id: string) => {
    await supabase.from("admins").update({ is_blocked: false, blocked_reason: null, blocked_at: null }).eq("id", id);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus admin ini? Semua log juga ikut terhapus.")) return;
    await supabase.from("admins").delete().eq("id", id);
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert size={18} className="text-primary" />
          <h2 className="font-semibold text-foreground">Manajemen Admin</h2>
        </div>
        <button onClick={fetchAll} className="p-1.5 rounded-md bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground">
          <RefreshCw size={14} />
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        Admin login di <code className="bg-secondary px-1 rounded">/admin</code> dengan nama + kode.
        Mereka HANYA bisa membuat link akses (biasa & membership). Tidak bisa akses pengaturan lain.
      </p>
      <p className="text-[11px] text-amber-500/90 bg-amber-500/10 border border-amber-500/30 rounded-md px-2 py-1.5">
        ⏱ Pantauan jumlah link admin akan otomatis di-reset menjadi 0 setiap 3 hari sekali.
      </p>

      <div className="space-y-2 bg-secondary/20 p-3 rounded-lg">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tambah Admin Baru</p>
        <input type="text" placeholder="Nama admin (unik)" value={newName} onChange={(e) => setNewName(e.target.value)}
          className="w-full bg-input border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
        <div className="flex gap-2">
          <input type="text" placeholder="Kode 6 digit" value={newCode} onChange={(e) => setNewCode(e.target.value)} maxLength={12}
            className="flex-1 bg-input border border-border rounded-lg px-3 py-2 text-foreground text-sm font-mono tracking-widest focus:outline-none focus:ring-1 focus:ring-ring" />
          <button onClick={() => setNewCode(generateCode())} className="px-3 bg-secondary rounded-lg text-xs hover:bg-accent">🎲</button>
        </div>
        <button onClick={handleAdd}
          className="w-full bg-primary text-primary-foreground py-2 rounded-lg text-sm font-medium hover:opacity-90 flex items-center justify-center gap-2">
          <Plus size={14} /> Tambah Admin
        </button>
      </div>

      <div className="space-y-2">
        {admins.length === 0 && <p className="text-sm text-muted-foreground text-center py-3">Belum ada admin.</p>}
        {admins.map((a) => (
          <div key={a.id} className={`border rounded-lg p-3 space-y-2 ${a.is_blocked ? "border-destructive/30 bg-destructive/5" : "border-border bg-secondary/10"}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-foreground">{a.name}</span>
                  {a.is_blocked && <span className="text-[9px] bg-destructive/20 text-destructive px-1.5 py-0.5 rounded font-bold">DIBLOKIR</span>}
                  <span className="text-[10px] font-mono bg-accent text-muted-foreground px-1.5 py-0.5 rounded">#{a.code}</span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-0.5"><Activity size={10} /> {counts[a.id] || 0} link dibuat</span>
                  {a.last_login_at && <span>· Login: {new Date(a.last_login_at).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}</span>}
                </div>
                {a.blocked_reason && <div className="text-[10px] text-destructive mt-1">⚠ {a.blocked_reason}</div>}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {a.is_blocked ? (
                  <button onClick={() => handleUnblock(a.id)} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-green-500" title="Buka blokir">
                    <Check size={14} />
                  </button>
                ) : (
                  <button onClick={() => setBlockingId(blockingId === a.id ? null : a.id)} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-destructive" title="Blokir">
                    <Ban size={14} />
                  </button>
                )}
                <button onClick={() => handleDelete(a.id)} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-destructive" title="Hapus">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            {blockingId === a.id && (
              <div className="flex items-center gap-2">
                <input type="text" placeholder="Alasan menutup akses..." value={blockReason} onChange={(e) => setBlockReason(e.target.value)}
                  className="flex-1 bg-input border border-border rounded-lg px-3 py-1.5 text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-ring" />
                <button onClick={() => handleBlock(a.id)} className="bg-destructive text-destructive-foreground px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-90">
                  Tutup
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Live activity feed */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
          <h3 className="text-sm font-semibold text-foreground">Aktivitas Real-time ({logs.length})</h3>
        </div>
        <div className="space-y-1 max-h-72 overflow-y-auto bg-secondary/10 rounded-lg p-2">
          {logs.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">Belum ada aktivitas.</p>}
          {logs.map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-2 text-[11px] py-1.5 px-2 hover:bg-secondary/30 rounded">
              <div className="min-w-0 flex-1">
                <span className="font-semibold text-foreground">{l.admin_name}</span>
                <span className="text-muted-foreground"> membuat </span>
                <span className="font-mono font-bold text-primary">T4-{l.token_code}</span>
                <span className="text-muted-foreground"> · {l.link_type === "membership" ? "🎫 Membership" : "🎬"} {l.show_name || "—"}</span>
              </div>
              <span className="text-[9px] text-muted-foreground flex-shrink-0">
                {new Date(l.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminManager;
