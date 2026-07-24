import { useState } from "react";
import { Plus, Ban, Copy, RefreshCw, Trash2, Check, Clock, Link } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Show } from "./ShowManager";

interface AccessToken {
  id: string;
  token_code: string;
  device_id: string | null;
  is_blocked: boolean;
  created_at: string;
  used_at: string | null;
  blocked_reason: string | null;
  expires_at: string | null;
  show_name: string | null;
  access_hour: string | null;
  duration_days: number | null;
  valid_until: string | null;
  max_uses?: number | null;
  uses_count?: number | null;
}

interface TokenManagerProps {
  tokens: AccessToken[];
  shows: Show[];
  loadingTokens: boolean;
  onRefresh: () => void;
  streamSettings: {
    replay_url: string;
  } | null;
}

const generateTokenCode = () => {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
};

const DURATION_OPTIONS = [1, 7, 15, 20, 30, 60];

const TokenManager = ({ tokens, shows, loadingTokens, onRefresh, streamSettings }: TokenManagerProps) => {
  const [tokenCount, setTokenCount] = useState(1);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [copiedLinkOnly, setCopiedLinkOnly] = useState<string | null>(null);
  const [blockReason, setBlockReason] = useState("");
  const [blockingTokenId, setBlockingTokenId] = useState<string | null>(null);

  const [selectedShow, setSelectedShow] = useState("");
  const [selectedHour, setSelectedHour] = useState("");
  const [durationDays, setDurationDays] = useState<number>(1);
  const [maxUses, setMaxUses] = useState<number>(1);

  const activeTokens = tokens.filter((t) => !t.is_blocked);
  const blockedTokens = tokens.filter((t) => t.is_blocked);

  const handleGenerateTokens = async () => {
    const newTokens = [];
    for (let i = 0; i < tokenCount; i++) {
      newTokens.push({
        token_code: generateTokenCode(),
        show_name: selectedShow || null,
        access_hour: selectedHour || null,
        duration_days: durationDays,
        max_uses: Math.max(1, Math.min(500, maxUses)),
      });
    }
    await supabase.from("access_tokens").insert(newTokens as any);
    onRefresh();
  };

  const handleUpdateMaxUses = async (tokenId: string, value: number) => {
    await supabase.from("access_tokens").update({ max_uses: Math.max(1, Math.min(500, value)) } as any).eq("id", tokenId);
    onRefresh();
  };

  const buildShareText = (token: AccessToken) => {
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/watch/${token.token_code}`;
    const replayUrl = streamSettings?.replay_url || "t48.lovable.app/replay";
    // Sandi replay = kode token yang sama
    const replayPassword = token.token_code;
    const showName = token.show_name || "(pilih show)";
    const accessHour = token.access_hour || "(atur jam)";
    const showDate = token.expires_at ? new Date(token.expires_at).toLocaleDateString("id-ID") : "(tanggal show)";

    return `*🚨Terimakasih telah membeli livestreaming dari kita.*

> selamat menonton show ${showName}

> ⏳akses jam: ${accessHour}



📢 *AKSES LIVE STREAMING & REPLAY* :



* 1️⃣ *Link Utama*: 🔗 ${link}



🔗Replay ${showDate} :

1. ${replayUrl}



🗝️ Sandi Replay : ${replayPassword}
(sandi replay = kode token link di atas)



⚠️ *PENTING UNTUK DIPERHATIKAN*:

1 Akun = 1 Device/browser : Jangan login di dua perangkat bersamaan.

Waktu Akses: Disarankan masuk website saat live sudah dimulai (Cek info terbaru di saluran).

Browser: Gunakan Chrome atau Opera untuk pengalaman terbaik.

Kendala Akses: Jika tombol masuk tidak berfungsi, mohon matikan AdBlock/DNS AdGuard.



Jika ada kendala, segera hubungi Admin. Selamat menonton! 🥰`;
  };

  const handleCopyLink = (token: AccessToken) => {
    navigator.clipboard.writeText(buildShareText(token));
    setCopiedToken(token.token_code);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const handleCopyLinkOnly = (token: AccessToken) => {
    const link = `${window.location.origin}/watch/${token.token_code}`;
    navigator.clipboard.writeText(link);
    setCopiedLinkOnly(token.token_code);
    setTimeout(() => setCopiedLinkOnly(null), 2000);
  };

  const handleBlockToken = async (tokenId: string) => {
    await supabase.from("access_tokens").update({ is_blocked: true, blocked_reason: blockReason || "Diblokir oleh admin" }).eq("id", tokenId);
    setBlockingTokenId(null); setBlockReason(""); onRefresh();
  };
  const handleUnblockToken = async (tokenId: string) => {
    await supabase.from("access_tokens").update({ is_blocked: false, blocked_reason: null }).eq("id", tokenId);
    onRefresh();
  };
  const handleDeleteToken = async (tokenId: string) => {
    await supabase.from("access_tokens").delete().eq("id", tokenId); onRefresh();
  };
  const handleResetDevice = async (tokenId: string) => {
    await supabase.from("access_tokens").update({ device_id: null, used_at: null, valid_until: null } as any).eq("id", tokenId);
    onRefresh();
  };

  const hours = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, "0")}:00`);

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-foreground">Manajemen Token Akses</h2>
        <button onClick={onRefresh} className="p-1.5 rounded-md bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw size={14} className={loadingTokens ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="text-sm text-muted-foreground">
        Total: {tokens.length} · Aktif: {activeTokens.length} · Diblokir: {blockedTokens.length}
      </div>

      <div className="space-y-3 bg-secondary/20 rounded-lg p-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Buat Token Baru</p>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Show</label>
            <select value={selectedShow} onChange={(e) => setSelectedShow(e.target.value)}
              className="w-full bg-input border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring">
              <option value="">-- Pilih Show --</option>
              {shows.map((s) => (<option key={s.id} value={s.name}>{s.name}</option>))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Jam Akses</label>
            <select value={selectedHour} onChange={(e) => setSelectedHour(e.target.value)}
              className="w-full bg-input border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring">
              <option value="">-- Pilih Jam --</option>
              {hours.map((h) => (<option key={h} value={h}>{h}</option>))}
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Durasi Token (mulai saat dipakai)</label>
          <div className="grid grid-cols-6 gap-1">
            {DURATION_OPTIONS.map((d) => (
              <button key={d} onClick={() => setDurationDays(d)} type="button"
                className={`py-1.5 rounded-lg text-xs font-medium transition-all ${
                  durationDays === d ? "bg-primary text-primary-foreground" : "bg-input border border-border text-foreground hover:bg-secondary"
                }`}>
                {d} hr
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">
            Kapasitas token (perangkat) — 1 = pribadi, s/d 500 = link bersama
          </label>
          <div className="flex items-center gap-2">
            <input type="number" min={1} max={500} value={maxUses}
              onChange={(e) => setMaxUses(Math.max(1, Math.min(500, parseInt(e.target.value) || 1)))}
              className="w-24 bg-input border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
            <div className="flex gap-1 flex-wrap">
              {[1, 10, 50, 100, 250, 500].map((n) => (
                <button key={n} type="button" onClick={() => setMaxUses(n)}
                  className={`px-2 py-1 rounded-md text-xs font-medium transition ${maxUses === n ? "bg-primary text-primary-foreground" : "bg-input border border-border text-foreground hover:bg-secondary"}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input type="number" min={1} max={50} value={tokenCount}
            onChange={(e) => setTokenCount(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
            className="w-20 bg-input border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
          <button onClick={handleGenerateTokens}
            className="flex-1 bg-primary text-primary-foreground py-2 rounded-lg font-medium text-sm hover:opacity-90 flex items-center justify-center gap-2">
            <Plus size={14} /> Buat {tokenCount} Token ({maxUses} perangkat/token)
          </button>
        </div>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {tokens.map((token) => (
          <div key={token.id} className={`border rounded-lg p-3 space-y-2 ${
            token.is_blocked ? "border-destructive/30 bg-destructive/5"
              : token.device_id ? "border-border bg-secondary/20" : "border-border"
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm font-bold text-foreground">T4-{token.token_code}</span>
                {token.is_blocked && (<span className="text-[10px] bg-destructive/20 text-destructive px-1.5 py-0.5 rounded font-medium">BLOCKED</span>)}
                {!token.is_blocked && (token.max_uses || 1) > 1 && (<span className="text-[10px] bg-blue-500/20 text-blue-500 px-1.5 py-0.5 rounded font-medium">BERSAMA</span>)}
                {!token.is_blocked && (token.max_uses || 1) <= 1 && token.device_id && (<span className="text-[10px] bg-accent text-muted-foreground px-1.5 py-0.5 rounded">TERIKAT</span>)}
                {!token.is_blocked && (token.max_uses || 1) <= 1 && !token.device_id && (<span className="text-[10px] bg-accent text-muted-foreground px-1.5 py-0.5 rounded">BELUM DIPAKAI</span>)}
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => handleCopyLinkOnly(token)} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground" title="Salin link saja">
                  {copiedLinkOnly === token.token_code ? <Check size={12} className="text-green-500" /> : <Link size={12} />}
                </button>
                <button onClick={() => handleCopyLink(token)} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground" title="Salin link + teks">
                  {copiedToken === token.token_code ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                </button>
                {token.device_id && !token.is_blocked && (
                  <button onClick={() => handleResetDevice(token.id)} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground" title="Reset perangkat">
                    <RefreshCw size={12} />
                  </button>
                )}
                {token.is_blocked ? (
                  <button onClick={() => handleUnblockToken(token.id)} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-green-500" title="Buka blokir">
                    <Check size={12} />
                  </button>
                ) : (
                  <button onClick={() => setBlockingTokenId(blockingTokenId === token.id ? null : token.id)} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-destructive" title="Blokir">
                    <Ban size={12} />
                  </button>
                )}
                <button onClick={() => handleDeleteToken(token.id)} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-destructive" title="Hapus">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {token.show_name && (<span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">{token.show_name}</span>)}
              {token.access_hour && (
                <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded flex items-center gap-0.5">
                  <Clock size={8} /> {token.access_hour}
                </span>
              )}
              {token.duration_days && (
                <span className="text-[10px] bg-accent text-muted-foreground px-1.5 py-0.5 rounded">{token.duration_days} hari</span>
              )}
              {(token.max_uses || 1) > 1 && (
                <span className="text-[10px] bg-blue-500/15 text-blue-500 px-1.5 py-0.5 rounded font-semibold">
                  👥 Bersama · maks {token.max_uses}
                </span>
              )}
              {token.valid_until && (
                <span className="text-[10px] bg-accent text-muted-foreground px-1.5 py-0.5 rounded">
                  s/d {new Date(token.valid_until).toLocaleDateString("id-ID")}
                </span>
              )}
              <label className="text-[10px] text-muted-foreground flex items-center gap-1">
                Kapasitas:
                <input type="number" min={1} max={500} defaultValue={token.max_uses || 1}
                  onBlur={(e) => {
                    const v = parseInt(e.target.value) || 1;
                    if (v !== (token.max_uses || 1)) handleUpdateMaxUses(token.id, v);
                  }}
                  className="w-14 bg-input border border-border rounded px-1.5 py-0.5 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
              </label>
            </div>


            {blockingTokenId === token.id && (
              <div className="flex items-center gap-2">
                <input type="text" placeholder="Alasan blokir (opsional)" value={blockReason} onChange={(e) => setBlockReason(e.target.value)}
                  className="flex-1 bg-input border border-border rounded-lg px-3 py-1.5 text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-ring" />
                <button onClick={() => handleBlockToken(token.id)} className="bg-destructive text-destructive-foreground px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-90">
                  Blokir
                </button>
              </div>
            )}

            <div className="text-[10px] text-muted-foreground font-mono">
              Dibuat: {new Date(token.created_at).toLocaleString("id-ID")}
              {token.used_at && ` · Dipakai: ${new Date(token.used_at).toLocaleString("id-ID")}`}
              {token.blocked_reason && ` · Alasan: ${token.blocked_reason}`}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TokenManager;
