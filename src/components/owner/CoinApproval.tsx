import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Check, X, Coins, Search } from "lucide-react";

interface TopupRequest {
  id: string;
  user_id: string;
  amount: number;
  total_price: number;
  topup_code: string;
  status: string;
  created_at: string;
}

interface UserInfo { user_code: string; nickname: string; }

const CoinApproval = () => {
  const [requests, setRequests] = useState<TopupRequest[]>([]);
  const [userMap, setUserMap] = useState<Record<string, UserInfo>>({});
  const [search, setSearch] = useState("");

  const fetchRequests = useCallback(async () => {
    const { data } = await supabase.from("coin_topup_requests").select("*").order("created_at", { ascending: false }).limit(100);
    if (data) {
      setRequests(data as any);
      const userIds = Array.from(new Set((data as any[]).map(r => r.user_id)));
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("user_id, user_code, nickname").in("user_id", userIds);
        if (profiles) {
          const map: Record<string, UserInfo> = {};
          (profiles as any[]).forEach(p => { map[p.user_id] = { user_code: p.user_code, nickname: p.nickname }; });
          setUserMap(map);
        }
      }
    }
  }, []);

  useEffect(() => {
    fetchRequests();
    const ch = supabase.channel("coin_approval_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "coin_topup_requests" }, () => fetchRequests())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchRequests]);

  const handleApprove = async (req: TopupRequest) => {
    if (req.status !== "pending") return; // idempotent — never double-credit
    const ownerToken = sessionStorage.getItem("teamlive_owner_token") || "";
    const { error } = await supabase.functions.invoke("approve-topup", { body: { requestId: req.id, ownerToken } });
    if (error) { alert("Gagal menyetujui topup: " + error.message); return; }
    fetchRequests();
  };

  const handleReject = async (req: TopupRequest) => {
    if (!confirm(`Tolak permintaan ${req.topup_code}?`)) return;
    await supabase.from("coin_topup_requests").update({ status: "rejected" } as any).eq("id", req.id);
    fetchRequests();
  };

  const filtered = requests.filter(r => {
    const u = userMap[r.user_id];
    const q = search.toLowerCase();
    return r.topup_code.toLowerCase().includes(q) ||
      (u && (u.user_code.includes(q) || u.nickname.toLowerCase().includes(q)));
  });
  const pending = filtered.filter(r => r.status === "pending");
  const completed = filtered.filter(r => r.status !== "pending");

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Coins size={18} className="text-amber-500" />
        <h2 className="font-semibold text-foreground">Konfirmasi Top Up Koin</h2>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari kode/nickname/ID user..."
          className="w-full bg-input border border-border rounded-lg pl-9 pr-3 py-2 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
      </div>

      {pending.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-amber-600 uppercase tracking-wider">⏳ Menunggu ({pending.length})</p>
          {pending.map((req) => {
            const u = userMap[req.user_id];
            return (
              <div key={req.id} className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="font-mono font-bold text-foreground text-sm">{req.topup_code}</span>
                    {u && (
                      <div className="text-xs text-foreground mt-0.5 font-medium">
                        {u.nickname} <span className="text-muted-foreground font-mono">#{u.user_code}</span>
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">{req.amount} Koin — Rp {req.total_price.toLocaleString("id-ID")}</div>
                    <div className="text-[10px] text-muted-foreground">{new Date(req.created_at).toLocaleString("id-ID")}</div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => handleApprove(req)} className="bg-green-500 text-white p-2 rounded-lg hover:opacity-90" title="Setujui">
                      <Check size={14} />
                    </button>
                    <button onClick={() => handleReject(req)} className="bg-destructive text-destructive-foreground p-2 rounded-lg hover:opacity-90" title="Tolak">
                      <X size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {completed.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Riwayat</p>
          {completed.slice(0, 10).map((req) => {
            const u = userMap[req.user_id];
            return (
              <div key={req.id} className="bg-secondary/20 border border-border rounded-lg p-2 flex items-center justify-between">
                <div className="min-w-0">
                  <span className="font-mono text-xs text-foreground">{req.topup_code}</span>
                  {u && <span className="text-xs text-muted-foreground ml-2">#{u.user_code}</span>}
                  <span className="text-xs text-muted-foreground ml-2">{req.amount} Koin</span>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  req.status === "confirmed" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                }`}>
                  {req.status === "confirmed" ? "✅" : "❌"}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {pending.length === 0 && completed.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">Belum ada permintaan top-up.</p>
      )}
    </div>
  );
};

export default CoinApproval;
