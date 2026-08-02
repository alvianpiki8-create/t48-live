import { useEffect, useState } from "react";
import { Eye, Radio } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const IDN_API = "https://v5.jkt48connect.com/api/jkt48/idnplus?apikey=JKTCONNECT";

interface IdnShow {
  title: string;
  image_url: string;
  view_count: number;
  live_at: number;
  description?: string;
}

const IdnShowInfo = () => {
  const [show, setShow] = useState<IdnShow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (!show) setLoading(true);
      try {
        const res = await fetch(IDN_API);
        const json = await res.json();
        const arr: any[] = Array.isArray(json?.data) ? json.data : [];
        const live = arr.find((s) => s.status === "live");
        if (!alive) return;
        setShow(
          live
            ? {
                title: live.title || "IDN Live",
                image_url: live.image_url || "",
                view_count: live.view_count || 0,
                live_at: live.live_at || 0,
                description: live.idnliveplus?.description || "",
              }
            : null,
        );
      } catch {
        if (alive) setShow(null);
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    const id = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl overflow-hidden flex gap-3 p-3 animate-pulse">
        <Skeleton className="w-20 h-20 rounded-lg flex-shrink-0" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
    );
  }

  if (!show) return null;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden flex gap-3 p-3">
      {show.image_url && (
        <img
          src={show.image_url}
          alt={`Poster show IDN ${show.title}`}
          loading="lazy"
          className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-destructive uppercase tracking-wide">
          <Radio size={11} /> Live di IDN
        </div>
        <h3 className="text-sm font-semibold text-foreground truncate mt-0.5">{show.title}</h3>
        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
          <Eye size={12} /> {show.view_count.toLocaleString("id-ID")} penonton
        </div>
        {show.description && (
          <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 whitespace-pre-line">
            {show.description}
          </p>
        )}
      </div>
    </div>
  );
};

export default IdnShowInfo;
