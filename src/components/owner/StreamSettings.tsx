import { useState, useEffect } from "react";
import { Save, Timer, Link2, Image as ImageIcon, Radio, Upload, QrCode } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface StreamSettingsProps {
  settings: {
    id: string;
    countdown_datetime: string | null;
    backup_video_url: string;
    replay_url: string;
    replay_password?: string;
    countdown_background?: string;
    stream_source_type?: string;
    stream_source_url?: string;
    stream_source_url_2?: string;
    logo_url?: string;
  } | null;
  onRefresh: () => void;
}

const StreamSettings = ({ settings, onRefresh }: StreamSettingsProps) => {
  const [countdownDate, setCountdownDate] = useState("");
  const [countdownTime, setCountdownTime] = useState("");
  const [backupUrl, setBackupUrl] = useState("");
  const [replayUrl, setReplayUrl] = useState("");
  const [replayYoutubeUrl, setReplayYoutubeUrl] = useState("");
  const [replayPassword, setReplayPassword] = useState("");
  const [countdownBackground, setCountdownBackground] = useState("");
  const [streamSourceUrl, setStreamSourceUrl] = useState("");
  const [streamSourceUrl2, setStreamSourceUrl2] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [catalogBgUrl, setCatalogBgUrl] = useState("");
  const [catalogBgType, setCatalogBgType] = useState<"image" | "video">("image");
  const [qrisUrl, setQrisUrl] = useState("");
  const [paymentReminder, setPaymentReminder] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBg, setUploadingBg] = useState(false);
  const [uploadingCatBg, setUploadingCatBg] = useState(false);
  const [uploadingQris, setUploadingQris] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settings) {
      if (settings.countdown_datetime) {
        const dt = new Date(settings.countdown_datetime);
        setCountdownDate(dt.toISOString().split("T")[0]);
        setCountdownTime(dt.toTimeString().slice(0, 5));
      }
      setBackupUrl(settings.backup_video_url || "");
      setReplayUrl(settings.replay_url || "t48-live.lovable.app/replay");
      setReplayYoutubeUrl((settings as any).replay_youtube_url || "");
      setReplayPassword(settings.replay_password || "");
      setCountdownBackground(settings.countdown_background || "");
      setStreamSourceUrl(settings.stream_source_url || "");
      setStreamSourceUrl2((settings as any).stream_source_url_2 || "");
      setLogoUrl(settings.logo_url || "");
      setCatalogBgUrl((settings as any).catalog_background_url || "");
      setCatalogBgType(((settings as any).catalog_background_type as "image" | "video") || "image");
      setQrisUrl((settings as any).qris_image_url || "");
      setPaymentReminder((settings as any).payment_reminder_text || "");
    }
  }, [settings]);

  const detectedType = (() => {
    if (!streamSourceUrl) return "youtube";
    if (/m3u8/i.test(streamSourceUrl)) return "m3u8";
    if (/youtube|youtu\.be/i.test(streamSourceUrl)) return "youtube";
    return "m3u8";
  })();

  const uploadFile = async (file: File): Promise<string | null> => {
    if (file.size > 5 * 1024 * 1024) { alert("Maksimal 5MB"); return null; }
    const ext = file.name.split(".").pop() || "png";
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { data, error } = await supabase.storage.from("catalog-images").upload(fileName, file);
    if (error) { alert("Gagal upload: " + error.message); return null; }
    const { data: pub } = supabase.storage.from("catalog-images").getPublicUrl(data.path);
    return pub.publicUrl;
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploadingLogo(true);
    const url = await uploadFile(file);
    if (url) setLogoUrl(url);
    setUploadingLogo(false);
  };

  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploadingBg(true);
    const url = await uploadFile(file);
    if (url) setCountdownBackground(url);
    setUploadingBg(false);
  };

  const handleCatBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (file.size > 10 * 1024 * 1024) { alert("Maksimal 10MB"); return; }
    setUploadingCatBg(true);
    const ext = file.name.split(".").pop() || "jpg";
    const isVideo = file.type.startsWith("video/");
    const fileName = `catbg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { data, error } = await supabase.storage.from("catalog-images").upload(fileName, file);
    if (error) { alert("Gagal upload: " + error.message); setUploadingCatBg(false); return; }
    const { data: pub } = supabase.storage.from("catalog-images").getPublicUrl(data.path);
    setCatalogBgUrl(pub.publicUrl);
    setCatalogBgType(isVideo ? "video" : "image");
    setUploadingCatBg(false);
  };

  const handleQrisUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploadingQris(true);
    const url = await uploadFile(file);
    if (url) setQrisUrl(url);
    setUploadingQris(false);
  };

  const handleSave = async () => {
    let countdown_datetime: string | null = null;
    if (countdownDate && countdownTime) {
      countdown_datetime = new Date(`${countdownDate}T${countdownTime}:00`).toISOString();
    }
    const payload: any = {
      countdown_datetime,
      backup_video_url: backupUrl,
      replay_url: replayUrl,
      replay_password: replayPassword,
      countdown_background: countdownBackground,
      stream_source_url: streamSourceUrl,
      stream_source_url_2: streamSourceUrl2,
      stream_source_type: detectedType,
      logo_url: logoUrl,
      catalog_background_url: catalogBgUrl,
      catalog_background_type: catalogBgType,
      qris_image_url: qrisUrl,
      payment_reminder_text: paymentReminder,
      updated_at: new Date().toISOString(),
    };
    let error: any = null;
    if (settings?.id) {
      const res = await supabase.from("stream_settings").update(payload).eq("id", settings.id);
      error = res.error;
    } else {
      const res = await supabase.from("stream_settings").insert({ ...payload, is_singleton: true });
      error = res.error;
    }
    if (error) { alert("Gagal simpan: " + error.message); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onRefresh();
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-5">
      <div className="flex items-center gap-2">
        <Timer size={18} className="text-primary" />
        <h2 className="font-semibold text-foreground">Pengaturan Livestream</h2>
      </div>

      {/* Logo Website */}
      <div>
        <label className="text-sm text-muted-foreground mb-2 block">Logo Website (Header)</label>
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-lg overflow-hidden bg-secondary flex items-center justify-center flex-shrink-0 border border-border">
            {logoUrl ? <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" /> : <Upload size={20} className="text-muted-foreground" />}
          </div>
          <label className="flex-1 cursor-pointer bg-secondary hover:bg-accent text-foreground text-sm text-center py-2 rounded-lg transition-colors">
            {uploadingLogo ? "Mengupload..." : "Pilih dari Galeri"}
            <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploadingLogo} />
          </label>
        </div>
      </div>

      {/* Stream Source 1 */}
      <div>
        <label className="text-sm text-muted-foreground mb-1 block flex items-center gap-1">
          <Radio size={12} /> Sumber Stream Utama (YouTube / M3U8)
        </label>
        <input type="text" value={streamSourceUrl} onChange={(e) => setStreamSourceUrl(e.target.value)}
          placeholder="https://...m3u8 atau https://youtube.com/..."
          className="w-full bg-input border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
        {streamSourceUrl && (
          <p className="text-xs mt-1 text-muted-foreground">
            Terdeteksi: <span className="font-bold text-primary">{detectedType.toUpperCase()}</span>
          </p>
        )}
      </div>

      {/* Stream Source 2 - Optional Fallback */}
      <div>
        <label className="text-sm text-muted-foreground mb-1 block flex items-center gap-1">
          <Radio size={12} /> Sumber Stream Cadangan (M3U8 — Opsional)
        </label>
        <input type="text" value={streamSourceUrl2} onChange={(e) => setStreamSourceUrl2(e.target.value)}
          placeholder="https://...m3u8 (kosongkan jika tidak ada)"
          className="w-full bg-input border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
        <p className="text-xs text-muted-foreground mt-1">Otomatis dipakai jika link utama gagal/kosong.</p>
      </div>

      {/* Countdown */}
      <div>
        <label className="text-sm text-muted-foreground mb-1 block">Waktu Countdown</label>
        <div className="flex gap-2">
          <input type="date" value={countdownDate} onChange={(e) => setCountdownDate(e.target.value)}
            className="flex-1 bg-input border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
          <input type="time" value={countdownTime} onChange={(e) => setCountdownTime(e.target.value)}
            className="w-28 bg-input border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
      </div>

      {/* Background Countdown - Upload from Gallery */}
      <div>
        <label className="text-sm text-muted-foreground mb-2 block flex items-center gap-1">
          <ImageIcon size={12} /> Background Countdown
        </label>
        <div className="flex items-center gap-3">
          <div className="w-20 h-14 rounded-lg overflow-hidden bg-secondary flex items-center justify-center flex-shrink-0 border border-border">
            {countdownBackground ? <img src={countdownBackground} alt="BG" className="w-full h-full object-cover" /> : <ImageIcon size={20} className="text-muted-foreground" />}
          </div>
          <label className="flex-1 cursor-pointer bg-secondary hover:bg-accent text-foreground text-sm text-center py-2 rounded-lg transition-colors">
            {uploadingBg ? "Mengupload..." : "Pilih dari Galeri"}
            <input type="file" accept="image/*" className="hidden" onChange={handleBgUpload} disabled={uploadingBg} />
          </label>
          {countdownBackground && (
            <button type="button" onClick={() => setCountdownBackground("")} className="text-xs text-destructive hover:underline">Hapus</button>
          )}
        </div>
      </div>

      <div>
        <label className="text-sm text-muted-foreground mb-1 block flex items-center gap-1"><Link2 size={12} /> Link Cadangan (Lama)</label>
        <input type="text" value={backupUrl} onChange={(e) => setBackupUrl(e.target.value)}
          placeholder="https://youtu.be/... atau .m3u8"
          className="w-full bg-input border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
      </div>

      <div>
        <label className="text-sm text-muted-foreground mb-1 block">Link Replay</label>
        <input type="text" value={replayUrl} onChange={(e) => setReplayUrl(e.target.value)}
          className="w-full bg-input border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
      </div>

      {/* Catalog Background — image or video */}
      <div>
        <label className="text-sm text-muted-foreground mb-2 block flex items-center gap-1">
          <ImageIcon size={12} /> Background Halaman Katalog (foto / video)
        </label>
        <div className="flex items-center gap-3">
          <div className="w-20 h-14 rounded-lg overflow-hidden bg-secondary flex items-center justify-center flex-shrink-0 border border-border">
            {catalogBgUrl ? (
              catalogBgType === "video"
                ? <video src={catalogBgUrl} muted className="w-full h-full object-cover" />
                : <img src={catalogBgUrl} alt="BG" className="w-full h-full object-cover" />
            ) : <ImageIcon size={20} className="text-muted-foreground" />}
          </div>
          <label className="flex-1 cursor-pointer bg-secondary hover:bg-accent text-foreground text-sm text-center py-2 rounded-lg transition-colors">
            {uploadingCatBg ? "Mengupload..." : "Pilih Foto/Video dari Galeri"}
            <input type="file" accept="image/*,video/*" className="hidden" onChange={handleCatBgUpload} disabled={uploadingCatBg} />
          </label>
          {catalogBgUrl && (
            <button type="button" onClick={() => setCatalogBgUrl("")} className="text-xs text-destructive hover:underline">Hapus</button>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">Tampil sebagai background halaman katalog (max 10MB).</p>
      </div>

      <div>
        <label className="text-sm text-muted-foreground mb-1 block">🔑 Sandi Replay</label>
        <input type="text" value={replayPassword} onChange={(e) => setReplayPassword(e.target.value)}
          className="w-full bg-input border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
      </div>

      {/* QRIS untuk setoran admin */}
      <div className="border-t border-border pt-4 space-y-3">
        <label className="text-sm text-muted-foreground mb-1 block flex items-center gap-1">
          <QrCode size={14} /> QRIS Setoran (tampil di panel admin)
        </label>
        <div className="flex items-center gap-3">
          <div className="w-20 h-20 rounded-lg overflow-hidden bg-secondary flex items-center justify-center flex-shrink-0 border border-border">
            {qrisUrl ? <img src={qrisUrl} alt="QRIS" className="w-full h-full object-contain" /> : <QrCode size={24} className="text-muted-foreground" />}
          </div>
          <label className="flex-1 cursor-pointer bg-secondary hover:bg-accent text-foreground text-sm text-center py-2 rounded-lg transition-colors">
            {uploadingQris ? "Mengupload..." : "Upload QRIS"}
            <input type="file" accept="image/*" className="hidden" onChange={handleQrisUpload} disabled={uploadingQris} />
          </label>
          {qrisUrl && (
            <button type="button" onClick={() => setQrisUrl("")} className="text-xs text-destructive hover:underline">Hapus</button>
          )}
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Pesan pengingat setoran (opsional)</label>
          <textarea value={paymentReminder} onChange={(e) => setPaymentReminder(e.target.value)}
            rows={2} placeholder="Contoh: Jangan lupa setor tiap 5 hari sekali ya!"
            className="w-full bg-input border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
        </div>
      </div>

      <button onClick={handleSave}
        className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg font-semibold hover:opacity-90 flex items-center justify-center gap-2">
        <Save size={16} /> {saved ? "Tersimpan ✓" : "Simpan Pengaturan Stream"}
      </button>
    </div>
  );
};

export default StreamSettings;
