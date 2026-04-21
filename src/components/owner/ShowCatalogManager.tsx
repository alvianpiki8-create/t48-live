import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, ToggleLeft, ToggleRight, Image as ImageIcon, Upload } from "lucide-react";
import { JKT48_MEMBERS } from "@/lib/jkt48Members";

interface CatalogShow {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  background_url: string | null;
  price_coins: number;
  show_date: string | null;
  access_hour: string | null;
  lineup: string[] | null;
  is_active: boolean;
}

const ShowCatalogManager = () => {
  const [shows, setShows] = useState<CatalogShow[]>([]);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [backgroundUrl, setBackgroundUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadingBg, setUploadingBg] = useState(false);
  const [priceCoins, setPriceCoins] = useState("4");
  const [showDate, setShowDate] = useState("");
  const [showTime, setShowTime] = useState("");
  const [selectedLineup, setSelectedLineup] = useState<string[]>([]);

  const fetchShows = useCallback(async () => {
    const { data } = await supabase.from("show_catalog").select("*").order("created_at", { ascending: false });
    if (data) setShows(data as any);
  }, []);

  useEffect(() => {
    fetchShows();
    const ch = supabase.channel("catalog_mgr_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "show_catalog" }, () => fetchShows())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchShows]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("Maksimal 5MB"); return; }
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { data, error } = await supabase.storage.from("catalog-images").upload(fileName, file);
    if (error) { alert("Gagal upload: " + error.message); setUploading(false); return; }
    const { data: pub } = supabase.storage.from("catalog-images").getPublicUrl(data.path);
    setImageUrl(pub.publicUrl);
    setUploading(false);
  };

  const handleBgFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { alert("Maksimal 8MB"); return; }
    setUploadingBg(true);
    const ext = file.name.split(".").pop() || "jpg";
    const fileName = `bg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { data, error } = await supabase.storage.from("catalog-images").upload(fileName, file);
    if (error) { alert("Gagal upload: " + error.message); setUploadingBg(false); return; }
    const { data: pub } = supabase.storage.from("catalog-images").getPublicUrl(data.path);
    setBackgroundUrl(pub.publicUrl);
    setUploadingBg(false);
  };

  const handleAdd = async () => {
    if (!title.trim()) return;
    let showDatetime: string | null = null;
    if (showDate && showTime) showDatetime = new Date(`${showDate}T${showTime}:00`).toISOString();

    await supabase.from("show_catalog").insert({
      title: title.trim(),
      description: desc.trim() || null,
      image_url: imageUrl.trim() || null,
      background_url: backgroundUrl.trim() || null,
      price_coins: parseInt(priceCoins) || 4,
      show_date: showDatetime,
      access_hour: showTime || null,
      lineup: selectedLineup.length > 0 ? selectedLineup : null,
    } as any);

    setTitle(""); setDesc(""); setImageUrl(""); setBackgroundUrl(""); setPriceCoins("4");
    setShowDate(""); setShowTime(""); setSelectedLineup([]);
    fetchShows();
  };

  const handleToggle = async (s: CatalogShow) => {
    await supabase.from("show_catalog").update({ is_active: !s.is_active } as any).eq("id", s.id);
    fetchShows();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("show_catalog").delete().eq("id", id);
    fetchShows();
  };

  const toggleLineup = (name: string) => {
    setSelectedLineup(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-5">
      <div className="flex items-center gap-2">
        <ImageIcon size={18} className="text-primary" />
        <h2 className="font-semibold text-foreground">Katalog Show</h2>
      </div>

      <div className="space-y-3 bg-secondary/20 rounded-lg p-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tambah Show Baru</p>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Judul show"
          className="w-full bg-input border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
        <input type="text" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Deskripsi (opsional)"
          className="w-full bg-input border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring" />

        {/* Upload from gallery */}
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Gambar Cover</label>
          <label className="flex items-center justify-center gap-2 w-full bg-input border border-dashed border-border hover:border-primary cursor-pointer rounded-lg px-3 py-3 text-foreground text-sm transition-colors">
            <Upload size={14} />
            {uploading ? "Mengupload..." : imageUrl ? "Ganti gambar" : "Pilih dari Galeri"}
            <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} disabled={uploading} />
          </label>
          {imageUrl && (
            <div className="rounded-lg overflow-hidden border border-border aspect-video mt-2">
              <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
            </div>
          )}
        </div>

        {/* Per-show background (optional) */}
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Background Show (opsional — tampil saat user buka detail)</label>
          <label className="flex items-center justify-center gap-2 w-full bg-input border border-dashed border-border hover:border-primary cursor-pointer rounded-lg px-3 py-3 text-foreground text-sm transition-colors">
            <Upload size={14} />
            {uploadingBg ? "Mengupload..." : backgroundUrl ? "Ganti background" : "Pilih Background dari Galeri"}
            <input type="file" accept="image/*" className="hidden" onChange={handleBgFileUpload} disabled={uploadingBg} />
          </label>
          {backgroundUrl && (
            <div className="rounded-lg overflow-hidden border border-border aspect-video mt-2 relative">
              <img src={backgroundUrl} alt="BG Preview" className="w-full h-full object-cover" />
              <button type="button" onClick={() => setBackgroundUrl("")} className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">Hapus</button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Harga (Koin)</label>
            <input type="number" value={priceCoins} onChange={(e) => setPriceCoins(e.target.value)} min={1}
              className="w-full bg-input border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Tanggal</label>
            <input type="date" value={showDate} onChange={(e) => setShowDate(e.target.value)}
              className="w-full bg-input border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
        </div>
        {showDate && (
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Waktu Mulai (otomatis dipakai sebagai jam akses)</label>
            <input type="time" value={showTime} onChange={(e) => setShowTime(e.target.value)}
              className="w-full bg-input border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
        )}

        <div>
          <p className="text-xs text-muted-foreground mb-2">Lineup ({selectedLineup.length} dipilih)</p>
          <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
            {JKT48_MEMBERS.map((m) => (
              <button key={m.name} onClick={() => toggleLineup(m.name)}
                className={`text-[10px] px-2 py-1 rounded-full transition-colors ${
                  selectedLineup.includes(m.name) ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-accent"
                }`}>
                {m.name}
              </button>
            ))}
          </div>
        </div>

        <button onClick={handleAdd}
          className="w-full bg-primary text-primary-foreground py-2 rounded-lg font-medium text-sm hover:opacity-90 flex items-center justify-center gap-2">
          <Plus size={14} /> Tambah Show
        </button>
      </div>

      <div className="space-y-2">
        {shows.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Belum ada show di katalog.</p>}
        {shows.map((s) => (
          <div key={s.id} className={`border rounded-lg p-3 ${s.is_active ? "border-primary/30 bg-primary/5" : "border-border bg-secondary/10 opacity-60"}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-foreground text-sm">{s.title}</span>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-xs text-primary font-medium">{s.price_coins} Koin</span>
                  {s.show_date && <span className="text-[10px] text-muted-foreground">{new Date(s.show_date).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}</span>}
                </div>
                {s.lineup && <p className="text-[10px] text-muted-foreground mt-1 truncate">{s.lineup.join(", ")}</p>}
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => handleToggle(s)} className="p-1.5 rounded-md hover:bg-secondary transition-colors">
                  {s.is_active ? <ToggleRight size={18} className="text-primary" /> : <ToggleLeft size={18} className="text-muted-foreground" />}
                </button>
                <button onClick={() => handleDelete(s.id)} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ShowCatalogManager;
