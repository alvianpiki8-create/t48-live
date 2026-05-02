import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Flag, Trash2, Ban, Check, RefreshCw } from "lucide-react";

interface ChatReport {
  id: string;
  message_id: string;
  message_text: string;
  message_nickname: string;
  message_device_id: string | null;
  reporter_nickname: string;
  reporter_device_id: string | null;
  reason: string | null;
  status: string;
  created_at: string;
}

const ChatReportsManager = () => {
  const [reports, setReports] = useState<ChatReport[]>([]);
  const [filter, setFilter] = useState<"pending" | "all">("pending");

  const fetchReports = useCallback(async () => {
    const { data } = await supabase
      .from("chat_reports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    setReports((data as any) || []);
  }, []);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  useEffect(() => {
    const ch = supabase.channel("owner_chat_reports_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_reports" }, fetchReports)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchReports]);

  const handleDeleteMessage = async (report: ChatReport) => {
    // Hapus pesan + tandai laporan resolved
    await supabase.from("chat_messages").delete().eq("id", report.message_id);
    await supabase.from("chat_reports").update({ status: "resolved" }).eq("id", report.id);
  };

  const handleBanDevice = async (report: ChatReport) => {
    if (!report.message_device_id) {
      alert("Device id pelaku tidak tersedia.");
      return;
    }
    const reason = prompt("Alasan blokir 24 jam:", report.reason || "Komentar melanggar") || "Komentar melanggar";
    await supabase.from("chat_banned_devices").insert({
      device_id: report.message_device_id,
      reason,
      banned_word: null,
    } as any);
    await supabase.from("chat_messages").delete().eq("id", report.message_id);
    await supabase.from("chat_reports").update({ status: "resolved" }).eq("id", report.id);
  };

  const handleDismiss = async (id: string) => {
    await supabase.from("chat_reports").update({ status: "dismissed" }).eq("id", id);
  };

  const handleDeleteReport = async (id: string) => {
    await supabase.from("chat_reports").delete().eq("id", id);
  };

  const visible = reports.filter((r) => filter === "all" ? true : r.status === "pending");
  const pendingCount = reports.filter((r) => r.status === "pending").length;

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flag size={18} className="text-destructive" />
          <h2 className="font-semibold text-foreground">Laporan Komentar</h2>
          {pendingCount > 0 && (
            <span className="text-[10px] font-bold bg-destructive text-destructive-foreground px-1.5 py-0.5 rounded-full">
              {pendingCount} BARU
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-secondary/40 rounded-md p-0.5">
            <button onClick={() => setFilter("pending")}
              className={`text-[10px] px-2 py-1 rounded ${filter === "pending" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
              Pending
            </button>
            <button onClick={() => setFilter("all")}
              className={`text-[10px] px-2 py-1 rounded ${filter === "all" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
              Semua
            </button>
          </div>
          <button onClick={fetchReports} className="p-1.5 rounded-md bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Penonton bisa melaporkan komentar. Laporan masuk di sini secara real-time.
      </p>

      <div className="space-y-2 max-h-[480px] overflow-y-auto">
        {visible.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">Tidak ada laporan {filter === "pending" ? "pending" : ""}.</p>
        )}
        {visible.map((r) => (
          <div key={r.id} className={`border rounded-lg p-3 space-y-2 ${
            r.status === "pending" ? "border-destructive/30 bg-destructive/5" :
            r.status === "resolved" ? "border-green-500/20 bg-green-500/5" :
            "border-border bg-secondary/10 opacity-60"
          }`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-destructive/20 text-destructive">
                    {r.status === "resolved" ? "✓ Selesai" : r.status === "dismissed" ? "Diabaikan" : "Pending"}
                  </span>
                  <span className="font-semibold text-sm text-foreground">{r.message_nickname}</span>
                  <span className="text-[10px] text-muted-foreground">menulis:</span>
                </div>
                <blockquote className="text-sm text-foreground/90 bg-secondary/30 border-l-2 border-destructive/40 px-2 py-1 rounded break-words">
                  "{r.message_text}"
                </blockquote>
                <div className="text-[10px] text-muted-foreground flex items-center gap-2 flex-wrap">
                  <span>Dilaporkan oleh <strong className="text-foreground/80">{r.reporter_nickname}</strong></span>
                  <span>· {new Date(r.created_at).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}</span>
                </div>
                {r.reason && <div className="text-[11px] text-foreground/70">Alasan: <em>{r.reason}</em></div>}
              </div>
              <button onClick={() => handleDeleteReport(r.id)} title="Hapus laporan"
                className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-destructive flex-shrink-0">
                <Trash2 size={14} />
              </button>
            </div>
            {r.status === "pending" && (
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => handleDeleteMessage(r)}
                  className="text-[11px] inline-flex items-center gap-1 bg-destructive/20 text-destructive px-2 py-1 rounded hover:bg-destructive/30 font-medium">
                  <Trash2 size={11} /> Hapus Komentar
                </button>
                <button onClick={() => handleBanDevice(r)}
                  className="text-[11px] inline-flex items-center gap-1 bg-destructive text-destructive-foreground px-2 py-1 rounded hover:opacity-90 font-medium">
                  <Ban size={11} /> Blokir Pengguna 24 jam
                </button>
                <button onClick={() => handleDismiss(r.id)}
                  className="text-[11px] inline-flex items-center gap-1 bg-secondary text-foreground px-2 py-1 rounded hover:bg-accent">
                  <Check size={11} /> Abaikan
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChatReportsManager;
