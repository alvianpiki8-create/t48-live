import { useCallback, useEffect, useState } from "react";
import { Image as ImageIcon, Plus, Trash2, ToggleLeft, ToggleRight, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface CatalogSlide {
  id: string;
  title: string | null;
  image_url: string;
  sort_order: number;
  is_active: boolean;
}

const CatalogSlideManager = () => {
  const [slides, setSlides] = useState<CatalogSlide[]>([]);
  const [title, setTitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [uploading, setUploading] = useState(false);

  const fetchSlides = useCallback(async () => {
    const { data } = await (supabase as any).from("catalog_slides").select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: false });
    setSlides((data || []) as CatalogSlide[]);
  }, []);

  useEffect(() => {
    fetchSlides();
    const ch = supabase.channel("catalog_slides_mgr_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "catalog_slides" }, fetchSlides)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchSlides]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("Maksimal 5MB"); return; }
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const fileName = `slide-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { data, error } = await supabase.storage.from("catalog-images").upload(fileName, file);
    if (error) { alert("Gagal upload: " + error.message); setUploading(false); return; }
    const { data: pub } = supabase.storage.from("catalog-images").getPublicUrl(data.path);
    setImageUrl(pub.publicUrl);
    setUploading(false);
  };

  const handleAdd = async () => {
    if (!imageUrl) return;
    await (supabase as any).from("catalog_slides").insert({
      title: title.trim() || null,
      image_url: imageUrl,
      sort_order: parseInt(sortOrder) || 0,
      is_active: true,
    });
    setTitle(""); setImageUrl(""); setSortOrder("0");
    fetchSlides();
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-5">
      <div className="flex items-center gap-2">
        <ImageIcon size={18} className="text-primary" />
        <h2 className="font-semibold text-foreground">Foto Geser Katalog</h2>
      </div>

      <div className="space-y-3 bg-secondary/20 rounded-lg p-3">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Judul slide (opsional)" className="w-full bg-input border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
        <input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} placeholder="Urutan" className="w-full bg-input border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
        <label className="flex items-center justify-center gap-2 w-full bg-input border border-dashed border-border hover:border-primary cursor-pointer rounded-lg px-3 py-3 text-foreground text-sm transition-colors">
          <Upload size={14} /> {uploading ? "Mengupload..." : imageUrl ? "Ganti foto slide" : "Pilih Foto dari Galeri"}
          <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
        {imageUrl && <img src={imageUrl} alt="Preview slide" className="w-full aspect-[2/1] object-cover rounded-lg border border-border" />}
        <button onClick={handleAdd} disabled={!imageUrl} className="w-full bg-primary text-primary-foreground py-2 rounded-lg font-medium text-sm hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
          <Plus size={14} /> Tambah Slide
        </button>
      </div>

      <div className="space-y-2">
        {slides.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Belum ada foto geser.</p>}
        {slides.map((slide) => (
          <div key={slide.id} className="border border-border bg-secondary/10 rounded-lg p-3 flex items-center gap-3">
            <img src={slide.image_url} alt={slide.title || "Slide katalog"} className="w-16 h-10 object-cover rounded-md border border-border" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-foreground font-medium truncate">{slide.title || "Slide katalog"}</p>
              <p className="text-xs text-muted-foreground">Urutan {slide.sort_order}</p>
            </div>
            <button onClick={() => (supabase as any).from("catalog_slides").update({ is_active: !slide.is_active }).eq("id", slide.id)} className="p-1.5 rounded-md hover:bg-secondary transition-colors">
              {slide.is_active ? <ToggleRight size={18} className="text-primary" /> : <ToggleLeft size={18} className="text-muted-foreground" />}
            </button>
            <button onClick={() => (supabase as any).from("catalog_slides").delete().eq("id", slide.id)} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-destructive transition-colors">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CatalogSlideManager;