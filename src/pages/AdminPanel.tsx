import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Plus, Copy, Check, Link as LinkIcon, KeyRound, Crown, ShieldAlert, RefreshCw, FileText, QrCode, Wallet, PlayCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { tallyLogs, formatIDR, priceOf, PRICE_NORMAL, PRICE_MEMBERSHIP_WEEKLY, PRICE_MEMBERSHIP_MONTHLY } from "@/lib/adminPricing";

const STORAGE_KEY = "teamlive_admin_session";
const DURATION_OPTIONS = [1, 7, 15, 20, 30, 60];

interface AdminSession { id: string; name: string; }

const generateTokenCode = () => {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
};

interface Show { id: string; name: string; }
interface Membership { id: string; name: string; type: string; }
interface StreamSettings { backup_video_url?: string; replay_url?: string; replay_password?: string; qris_image_url?: string; payment_reminder_text?: string; }

const buildShareText = (opts: {
  origin: string;
  tokenCode: string;
  showName?: string | null;
  accessHour?: string | null;
  showDate?: string | null;
  settings: StreamSettings | null;
}) => {
  const link = `${opts.origin}/watch/${opts.tokenCode}`;
  const backupUrl = opts.settings?.backup_video_url || "";
  const replayUrl = opts.settings?.replay_url || "t48.lovable.app/replay";
  const replayPassword = opts.settings?.replay_password || "(admin yang atur)";
  const showName = opts.showName || "(pilih show)";
  const accessHour = opts.accessHour || "(atur jam)";
  const showDate = opts.showDate || "(tanggal show)";
  return `*🚨Terimakasih telah membeli livestreaming dari kita.*

> selamat menonton show ${showName}

> ⏳akses jam: ${accessHour}



📢 *AKSES LIVE STREAMING pada LINK UTAMA,LINK CADANGAN Dan REPLAY* :



* 1️⃣ *Link Utama*: 🔗 ${link}

                

* 2⃣ *Link Cadangan* : 🔗 ${backupUrl || "(kalo ada)"}



🔗Replay ${showDate} 2026 :

1. ${replayUrl}



🗝️ Sandi : ${replayPassword}



⚠️ *PENTING UNTUK DIPERHATIKAN*:

1 Akun = 1 Device/browser : Jangan login di dua perangkat bersamaan.

Waktu Akses: Disarankan masuk website saat live sudah dimulai (Cek info terbaru di saluran).

Browser: Gunakan Chrome atau Opera untuk pengalaman terbaik.

Kendala Akses: Jika tombol masuk tidak berfungsi, mohon matikan AdBlock/DNS AdGuard.



Jika ada kendala, segera hubungi Admin. Selamat menonton! 🥰`;
};

const AdminPanel = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState<AdminSession | null>(() => {
    try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null"); }
    catch { return null; }
  });
  const [loginName, setLoginName] = useState("");
  const [loginCode, setLoginCode] = useState("");
  const [loginErr, setLoginErr] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [shows, setShows] = useState<Show[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [myLogs, setMyLogs] = useState<any[]>([]);
  const [streamSettings, setStreamSettings] = useState<StreamSettings | null>(null);

  const [tabKind, setTabKind] = useState<"normal" | "membership">("normal");
  const [selectedShow, setSelectedShow] = useState("");
  const [selectedHour, setSelectedHour] = useState("");
  const [duration, setDuration] = useState(1);
  const [generated, setGenerated] = useState<{ link: string; text: string } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [creating, setCreating] = useState(false);

  const [selMembership, setSelMembership] = useState("");

  // Per-row copy feedback
  const [rowCopy, setRowCopy] = useState<{ id: string; kind: "link" | "text" } | null>(null);

  useEffect(() => {
    if (!session) return;
    const check = async () => {
      const { data } = await supabase.from("admins").select("is_blocked, blocked_reason").eq("id", session.id).maybeSingle();
      if (!data) {
        sessionStorage.removeItem(STORAGE_KEY); setSession(null);
        setLoginErr("Akun admin sudah dihapus oleh owner");
        return;
      }
      if ((data as any).is_blocked) {
        sessionStorage.removeItem(STORAGE_KEY); setSession(null);
        setLoginErr((data as any).blocked_reason || "Akses Anda telah ditutup oleh owner");
      }
    };
    check();
    const ch = supabase.channel(`admin_self_${session.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "admins", filter: `id=eq.${session.id}` }, check)
      .subscribe();
    const t = setInterval(check, 30000);
    return () => { supabase.removeChannel(ch); clearInterval(t); };
  }, [session]);

  const fetchData = useCallback(async () => {
    if (!session) return;
    const [s, m, l, ss] = await Promise.all([
      supabase.from("shows").select("id,name").order("created_at", { ascending: true }),
      supabase.from("memberships").select("id,name,type").eq("is_active", true).order("created_at", { ascending: true }),
      supabase.from("admin_link_logs").select("*").eq("admin_id", session.id).order("created_at", { ascending: false }).limit(50),
      supabase.from("stream_settings").select("backup_video_url, replay_url, replay_password, qris_image_url, payment_reminder_text").maybeSingle(),
    ]);
    setShows((s.data as any) || []);
    setMemberships((m.data as any) || []);
    setMyLogs((l.data as any) || []);
    setStreamSettings((ss.data as any) || null);
  }, [session]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!session) return;
    const ch = supabase.channel(`admin_logs_${session.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_link_logs", filter: `admin_id=eq.${session.id}` }, fetchData)
      .on("postgres_changes", { event: "*", schema: "public", table: "stream_settings" }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [session, fetchData]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true); setLoginErr("");
    try {
      const { data, error } = await supabase.functions.invoke("admin-auth", {
        body: { name: loginName.trim(), code: loginCode.trim() },
      });
      if (error) { setLoginErr("Gagal terhubung ke server"); return; }
      const r = data as any;
      if (!r?.ok) { setLoginErr(r?.error || "Login gagal"); return; }
      const sess: AdminSession = r.admin;
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(sess));
      setSession(sess);
    } finally { setLoginLoading(false); }
  };

  const handleLogout = () => { sessionStorage.removeItem(STORAGE_KEY); setSession(null); };

  const [openingLive, setOpeningLive] = useState(false);
  const handleOpenLive = async () => {
    if (!session || openingLive) return;
    setOpeningLive(true);
    try {
      const cacheKey = `teamlive_admin_watch_${session.id}`;
      // Try cached private token
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const { code, exp } = JSON.parse(cached);
        if (code && exp && exp > Date.now()) {
          navigate(`/watch/${code}`);
          return;
        }
      }
      // Provision a NEW private admin token (not logged as setoran)
      const token_code = generateTokenCode();
      const days = 30;
      const { error } = await supabase.from("access_tokens").insert({
        token_code,
        show_name: `🔒 Admin · ${session.name}`,
        duration_days: days,
      } as any);
      if (error) { alert("Gagal membuat akses: " + error.message); return; }
      localStorage.setItem(cacheKey, JSON.stringify({
        code: token_code,
        exp: Date.now() + days * 24 * 60 * 60 * 1000 - 60 * 60 * 1000,
      }));
      navigate(`/watch/${token_code}`);
    } finally {
      setOpeningLive(false);
    }
  };

  const finalizeGenerated = (token_code: string, showName: string | null, accessHour: string | null) => {
    const link = `${window.location.origin}/watch/${token_code}`;
    const text = buildShareText({
      origin: window.location.origin,
      tokenCode: token_code,
      showName, accessHour, showDate: null,
      settings: streamSettings,
    });
    setGenerated({ link, text });
    setCopiedLink(false); setCopiedText(false);
  };

  const createNormal = async () => {
    if (!session) return;
    setCreating(true); setGenerated(null);
    const token_code = generateTokenCode();
    const { error } = await supabase.from("access_tokens").insert({
      token_code,
      show_name: selectedShow || null,
      access_hour: selectedHour || null,
      duration_days: duration,
    } as any);
    if (error) { alert("Gagal: " + error.message); setCreating(false); return; }
    await supabase.from("admin_link_logs").insert({
      admin_id: session.id, admin_name: session.name, link_type: "normal",
      token_code, show_name: selectedShow || null, duration_days: duration, access_hour: selectedHour || null,
    } as any);
    finalizeGenerated(token_code, selectedShow || null, selectedHour || null);
    setCreating(false);
  };

  const createMembership = async () => {
    if (!session || !selMembership) { alert("Pilih paket membership dulu"); return; }
    const m = memberships.find((x) => x.id === selMembership);
    if (!m) return;
    setCreating(true); setGenerated(null);
    const days = m.type === "weekly" ? 7 : 30;
    const token_code = generateTokenCode();
    const showName = `Membership ${m.type === "weekly" ? "Mingguan" : "Bulanan"}`;
    // Membership uses TOKEN-BASED link (not public membership link)
    const { error } = await supabase.from("access_tokens").insert({
      token_code, duration_days: days, show_name: showName,
    } as any);
    if (error) { alert("Gagal: " + error.message); setCreating(false); return; }
    await supabase.from("admin_link_logs").insert({
      admin_id: session.id, admin_name: session.name, link_type: "membership",
      token_code, show_name: m.name, duration_days: days,
    } as any);
    finalizeGenerated(token_code, m.name, null);
    setCreating(false);
  };

  const copyText = async (val: string) => {
    try { await navigator.clipboard.writeText(val); } catch {}
  };

  const copyRow = (log: any, kind: "link" | "text") => {
    const link = `${window.location.origin}/watch/${log.token_code}`;
    if (kind === "link") copyText(link);
    else copyText(buildShareText({
      origin: window.location.origin,
      tokenCode: log.token_code,
      showName: log.show_name, accessHour: log.access_hour, showDate: null,
      settings: streamSettings,
    }));
    setRowCopy({ id: log.id, kind });
    setTimeout(() => setRowCopy(null), 1500);
  };

  const hours = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, "0")}:00`);

  if (!session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="bg-card border border-border rounded-xl p-8 w-full max-w-sm" style={{ animation: "fade-in 0.3s ease-out" }}>
          <div className="text-center mb-6">
            <div className="inline-flex p-3 rounded-full bg-primary/10 mb-3"><ShieldAlert size={24} className="text-primary" /></div>
            <h1 className="text-xl font-bold text-foreground">Admin Panel</h1>
            <p className="text-muted-foreground text-sm mt-1">Login untuk membuat link akses</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block flex items-center gap-1.5"><Crown size={14} /> Nama Admin</label>
              <input type="text" value={loginName} onChange={(e) => setLoginName(e.target.value)} autoComplete="off"
                className="w-full bg-input border border-border rounded-lg px-4 py-2.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block flex items-center gap-1.5"><KeyRound size={14} /> Kode Admin</label>
              <input type="password" value={loginCode} onChange={(e) => setLoginCode(e.target.value)} autoComplete="off"
                className="w-full bg-input border border-border rounded-lg px-4 py-2.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring text-center font-mono tracking-[0.25em]"
                placeholder="••••••" />
            </div>
            {loginErr && <p className="text-destructive text-sm">{loginErr}</p>}
            <button type="submit" disabled={loginLoading || !loginName.trim() || !loginCode.trim()}
              className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg font-semibold hover:opacity-90 transition-all disabled:opacity-50">
              {loginLoading ? "Memeriksa..." : "Masuk"}
            </button>
          </form>
          <button onClick={() => navigate("/")} className="w-full mt-3 text-xs text-muted-foreground hover:text-foreground">← Kembali</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50">
        <div className="flex items-center gap-2">
          <ShieldAlert size={18} className="text-primary" />
          <div>
            <h1 className="text-sm font-bold text-foreground">Admin · {session.name}</h1>
            <p className="text-[10px] text-muted-foreground">Akses terbatas: pembuatan link saja</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate("/live")} className="flex items-center gap-1.5 text-xs text-primary hover:opacity-80" title="Tonton livestream">
            <PlayCircle size={14} /> Live
          </button>
          <button onClick={handleLogout} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive">
            <LogOut size={14} /> Logout
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <button onClick={() => { setTabKind("normal"); setGenerated(null); }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${tabKind === "normal" ? "bg-primary text-primary-foreground" : "bg-secondary/50 text-muted-foreground hover:bg-secondary"}`}>
              Link Biasa
            </button>
            <button onClick={() => { setTabKind("membership"); setGenerated(null); }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${tabKind === "membership" ? "bg-primary text-primary-foreground" : "bg-secondary/50 text-muted-foreground hover:bg-secondary"}`}>
              Link Membership
            </button>
          </div>

          {tabKind === "normal" ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Show</label>
                  <select value={selectedShow} onChange={(e) => setSelectedShow(e.target.value)}
                    className="w-full bg-input border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                    <option value="">-- Pilih --</option>
                    {shows.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Jam Akses</label>
                  <select value={selectedHour} onChange={(e) => setSelectedHour(e.target.value)}
                    className="w-full bg-input border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                    <option value="">-- Pilih --</option>
                    {hours.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Durasi</label>
                <div className="grid grid-cols-6 gap-1">
                  {DURATION_OPTIONS.map((d) => (
                    <button key={d} onClick={() => setDuration(d)} type="button"
                      className={`py-1.5 rounded-lg text-xs font-medium transition-all ${duration === d ? "bg-primary text-primary-foreground" : "bg-input border border-border text-foreground hover:bg-secondary"}`}>
                      {d} hr
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={createNormal} disabled={creating}
                className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
                <Plus size={16} /> {creating ? "Membuat..." : "Buat Link"}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Paket Membership</label>
                <select value={selMembership} onChange={(e) => setSelMembership(e.target.value)}
                  className="w-full bg-input border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                  <option value="">-- Pilih Paket --</option>
                  {memberships.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.type === "weekly" ? "7 hari" : "30 hari"})</option>)}
                </select>
                <p className="text-[10px] text-muted-foreground mt-1">Membership memakai link bertoken (bukan link publik).</p>
              </div>
              <button onClick={createMembership} disabled={creating || !selMembership}
                className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
                <Plus size={16} /> {creating ? "Membuat..." : "Buat Link Membership"}
              </button>
            </div>
          )}

          {generated && (
            <div className="mt-3 p-3 rounded-lg bg-primary/10 border border-primary/30 space-y-2">
              <div className="text-xs text-muted-foreground flex items-center gap-1.5"><LinkIcon size={12} /> Link berhasil dibuat:</div>
              <div className="font-mono text-xs break-all text-foreground bg-background/50 rounded p-2">{generated.link}</div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => { copyText(generated.link); setCopiedLink(true); setTimeout(() => setCopiedLink(false), 1500); }}
                  className="bg-secondary text-foreground py-2 rounded-lg text-xs font-semibold hover:bg-secondary/80 flex items-center justify-center gap-1.5">
                  {copiedLink ? <><Check size={14} /> Tersalin</> : <><LinkIcon size={14} /> Salin Link</>}
                </button>
                <button onClick={() => { copyText(generated.text); setCopiedText(true); setTimeout(() => setCopiedText(false), 1500); }}
                  className="bg-primary text-primary-foreground py-2 rounded-lg text-xs font-semibold hover:opacity-90 flex items-center justify-center gap-1.5">
                  {copiedText ? <><Check size={14} /> Tersalin</> : <><FileText size={14} /> Salin Teks</>}
                </button>
              </div>
            </div>
          )}
        </div>

        <AdminLogsPanel logs={myLogs} onRefresh={fetchData} copyRow={copyRow} rowCopy={rowCopy} />
        <QrisSetoranCard tally={tallyLogs(myLogs)} settings={streamSettings} />
      </main>
    </div>
  );
};

interface RowCopyState { id: string; kind: "link" | "text" }

const AdminLogsPanel = ({
  logs, onRefresh, copyRow, rowCopy,
}: {
  logs: any[];
  onRefresh: () => void;
  copyRow: (l: any, k: "link" | "text") => void;
  rowCopy: RowCopyState | null;
}) => {
  const groups = useMemo(() => {
    const normal = logs.filter((l) => l.link_type !== "membership");
    const membership = logs.filter((l) => l.link_type === "membership");
    return [
      { key: "normal" as const, title: "🎬 Show", items: normal },
      { key: "membership" as const, title: "🎫 Membership", items: membership },
    ];
  }, [logs]);

  const renderItem = (l: any) => (
    <div key={l.id} className="text-[11px] bg-secondary/20 rounded px-2 py-1.5 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-mono font-bold text-foreground">T4-{l.token_code}</div>
          <div className="text-muted-foreground truncate">
            {l.show_name || "—"} · {l.duration_days}hr {l.access_hour ? `· ${l.access_hour}` : ""}
            <span className="text-primary font-semibold"> · {formatIDR(priceOf(l))}</span>
          </div>
        </div>
        <div className="text-[9px] text-muted-foreground whitespace-nowrap">{new Date(l.created_at).toLocaleString("id-ID", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })}</div>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <button onClick={() => copyRow(l, "link")} className="bg-secondary hover:bg-secondary/70 text-foreground py-1 rounded text-[10px] font-semibold flex items-center justify-center gap-1">
          {rowCopy?.id === l.id && rowCopy.kind === "link" ? <><Check size={10} /> Tersalin</> : <><LinkIcon size={10} /> Link</>}
        </button>
        <button onClick={() => copyRow(l, "text")} className="bg-primary/80 hover:bg-primary text-primary-foreground py-1 rounded text-[10px] font-semibold flex items-center justify-center gap-1">
          {rowCopy?.id === l.id && rowCopy.kind === "text" ? <><Check size={10} /> Tersalin</> : <><FileText size={10} /> Teks</>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Link saya ({logs.length})</h2>
        <button onClick={onRefresh} className="p-1 rounded hover:bg-secondary text-muted-foreground"><RefreshCw size={12} /></button>
      </div>
      {logs.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">Belum ada link dibuat.</p>}
      {groups.map((g) => (
        g.items.length === 0 ? null : (
          <div key={g.key} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold text-foreground uppercase tracking-wider">{g.title} ({g.items.length})</p>
            </div>
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {g.items.map(renderItem)}
            </div>
          </div>
        )
      ))}
    </div>
  );
};

const QrisSetoranCard = ({
  tally, settings,
}: {
  tally: ReturnType<typeof tallyLogs>;
  settings: StreamSettings | null;
}) => {
  const qris = settings?.qris_image_url;
  const reminder = settings?.payment_reminder_text || "Jangan lupa lakukan setoran ya! Terima kasih 🙏";
  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Wallet size={16} className="text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Setoran Saya</h2>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-secondary/30 rounded-lg py-2">
          <div className="text-[10px] text-muted-foreground">🎬 Show</div>
          <div className="text-sm font-bold text-foreground">{tally.normal}</div>
          <div className="text-[9px] text-muted-foreground">×{formatIDR(PRICE_NORMAL)}</div>
        </div>
        <div className="bg-secondary/30 rounded-lg py-2">
          <div className="text-[10px] text-muted-foreground">🎫 Mingguan</div>
          <div className="text-sm font-bold text-foreground">{tally.weekly}</div>
          <div className="text-[9px] text-muted-foreground">×{formatIDR(PRICE_MEMBERSHIP_WEEKLY)}</div>
        </div>
        <div className="bg-secondary/30 rounded-lg py-2">
          <div className="text-[10px] text-muted-foreground">🎫 Bulanan</div>
          <div className="text-sm font-bold text-foreground">{tally.monthly}</div>
          <div className="text-[9px] text-muted-foreground">×{formatIDR(PRICE_MEMBERSHIP_MONTHLY)}</div>
        </div>
      </div>

      <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 text-center space-y-0.5">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Setoran</div>
        <div className="text-2xl font-black text-primary">{formatIDR(tally.amount)}</div>
        <div className="text-[10px] text-muted-foreground">dari {tally.total} link yang diambil</div>
      </div>

      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <QrCode size={12} /> Scan QRIS untuk setoran
        </div>
        <div className="w-56 h-56 rounded-lg overflow-hidden bg-white flex items-center justify-center border-2 border-border">
          {qris ? (
            <img src={qris} alt="QRIS Setoran" className="w-full h-full object-contain" />
          ) : (
            <div className="text-center text-muted-foreground text-xs px-4">
              <QrCode size={40} className="mx-auto mb-2 opacity-50" />
              QRIS belum di-upload oleh owner
            </div>
          )}
        </div>
      </div>

      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 text-[11px] text-amber-600 dark:text-amber-400 text-center whitespace-pre-line">
        ⚠ {reminder}
      </div>

      <p className="text-[10px] text-muted-foreground text-center">
        Perhitungan otomatis akan di-reset tiap 5 hari sekali.
      </p>
    </div>
  );
};

export default AdminPanel;
