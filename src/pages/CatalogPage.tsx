import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Search, Coins, LogOut, Eye, Calendar } from "lucide-react";
import type { User } from "@supabase/supabase-js";

interface ShowItem {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  price_coins: number;
  show_date: string | null;
  access_hour: string | null;
  lineup: string[] | null;
  is_active: boolean;
}

interface Profile {
  user_code: string;
  nickname: string;
  coins: number;
}

const CatalogPage = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [shows, setShows] = useState<ShowItem[]>([]);
  const [search, setSearch] = useState("");
  const [selectedShow, setSelectedShow] = useState<ShowItem | null>(null);
  const [purchases, setPurchases] = useState<string[]>([]);
  const [buying, setBuying] = useState(false);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }
      setUser(user);

      const { data: p } = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
      if (p) setProfile(p as any);

      const { data: purch } = await supabase.from("show_purchases").select("show_id").eq("user_id", user.id);
      if (purch) setPurchases(purch.map((x: any) => x.show_id));
    };
    getUser();

    const fetchShows = async () => {
      const { data } = await supabase.from("show_catalog").select("*").eq("is_active", true).order("show_date", { ascending: true });
      if (data) setShows(data as any);
    };
    fetchShows();

    // Realtime
    const ch = supabase.channel("catalog_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "show_catalog" }, () => fetchShows())
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, async () => {
        const { data: { user: u } } = await supabase.auth.getUser();
        if (u) {
          const { data: p } = await supabase.from("profiles").select("*").eq("user_id", u.id).maybeSingle();
          if (p) setProfile(p as any);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [navigate]);

  const handleBuy = async (show: ShowItem) => {
    if (!user || !profile) return;
    if (profile.coins < show.price_coins) return;
    setBuying(true);

    // Deduct coins
    const { error: updateErr } = await supabase.from("profiles").update({ coins: profile.coins - show.price_coins } as any).eq("user_id", user.id);
    if (updateErr) { setBuying(false); return; }

    // Record purchase
    await supabase.from("show_purchases").insert({ user_id: user.id, show_id: show.id, coins_spent: show.price_coins } as any);

    setProfile(prev => prev ? { ...prev, coins: prev.coins - show.price_coins } : prev);
    setPurchases(prev => [...prev, show.id]);
    setBuying(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const filteredShows = shows.filter(s => s.title.toLowerCase().includes(search.toLowerCase()));

  const formatDate = (d: string | null) => {
    if (!d) return "";
    const date = new Date(d);
    return date.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "short", year: "numeric" }) +
      ", " + date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) + " WIB";
  };

  const getCountdown = (d: string) => {
    const diff = new Date(d).getTime() - Date.now();
    if (diff <= 0) return null;
    const days = Math.floor(diff / 86400000);
    const hrs = Math.floor((diff % 86400000) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return { days, hrs, mins, secs };
  };

  // Countdown timer
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-secondary/20">
      {/* Header sticky */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="bg-gradient-to-r from-primary to-primary/70 text-primary-foreground text-center py-2 text-xs font-medium">
          {new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-foreground">Katalog Show</h1>
          <p className="text-muted-foreground text-sm">Pilih show JKT48 favoritmu</p>
          <button
            onClick={() => navigate("/topup")}
            className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-700 px-4 py-1.5 rounded-full text-sm font-medium mt-2"
          >
            <Coins size={14} /> Saldo: {profile?.coins?.toLocaleString("id-ID") || 0} Koin
          </button>
        </div>

        {/* User info bar */}
        <div className="flex items-center justify-between bg-card border border-border rounded-lg px-3 py-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">ID:</span>
            <span className="font-mono font-bold text-foreground">{profile?.user_code || "..."}</span>
            <span className="text-muted-foreground">|</span>
            <span className="text-foreground font-medium">{profile?.nickname}</span>
          </div>
          <button onClick={handleLogout} className="text-muted-foreground hover:text-foreground p-1">
            <LogOut size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari show..."
            className="w-full bg-card border border-border rounded-xl pl-10 pr-4 py-3 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {/* Show cards */}
        <div className="space-y-4">
          {filteredShows.length === 0 && (
            <p className="text-center text-muted-foreground py-8">Belum ada show tersedia.</p>
          )}
          {filteredShows.map((show) => {
            const purchased = purchases.includes(show.id);
            const countdown = show.show_date ? getCountdown(show.show_date) : null;
            return (
              <div key={show.id} className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                {/* Image */}
                {show.image_url && (
                  <div className="relative">
                    <img src={show.image_url} alt={show.title} className="w-full aspect-[2/1] object-cover" />
                    <div className="absolute top-3 right-3 bg-card/90 backdrop-blur-sm text-foreground px-3 py-1 rounded-full text-xs font-medium">
                      {countdown ? "Terjadwal" : "Live"}
                    </div>
                    {show.lineup && show.lineup.length > 0 && (
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                        <div className="flex items-center gap-1">
                          <Eye size={12} className="text-white/80" />
                          <span className="text-white/80 text-xs">{show.lineup.length}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="p-4 space-y-2">
                  <h3 className="font-bold text-foreground">{show.title}</h3>
                  {show.show_date && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar size={12} /> {formatDate(show.show_date)}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-primary font-bold text-lg">
                      Rp {(show.price_coins * 2500).toLocaleString("id-ID")}
                    </span>
                    <button
                      onClick={() => setSelectedShow(show)}
                      className="text-primary text-sm font-medium hover:underline"
                    >
                      Lihat Detail →
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-center text-muted-foreground/30 text-xs font-mono">@t48id</p>
      </div>

      {/* Show Detail Modal */}
      {selectedShow && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center" onClick={() => setSelectedShow(null)}>
          <div
            className="bg-card w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
            style={{ animation: "fade-in 0.2s ease-out" }}
          >
            {selectedShow.image_url && (
              <div className="relative">
                <img src={selectedShow.image_url} alt={selectedShow.title} className="w-full aspect-[2/1] object-cover" />
                <button onClick={() => setSelectedShow(null)} className="absolute top-3 right-3 bg-card/90 backdrop-blur-sm w-8 h-8 rounded-full flex items-center justify-center text-foreground">✕</button>
                <div className="absolute bottom-3 left-3 bg-card/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-medium">
                  {selectedShow.show_date && getCountdown(selectedShow.show_date) ? "Terjadwal" : "Live"}
                </div>
                {selectedShow.lineup && (
                  <div className="absolute bottom-3 right-3 bg-primary/90 backdrop-blur-sm text-primary-foreground px-2 py-1 rounded-full text-xs flex items-center gap-1">
                    <Eye size={12} /> {selectedShow.lineup.length}
                  </div>
                )}
              </div>
            )}

            <div className="p-5 space-y-4">
              <div className="text-center">
                <h2 className="text-xl font-bold text-foreground">{selectedShow.title}</h2>
                {selectedShow.show_date && (
                  <p className="text-sm text-muted-foreground mt-1 flex items-center justify-center gap-1">
                    <Calendar size={14} /> {formatDate(selectedShow.show_date)}
                  </p>
                )}
              </div>

              {/* Countdown */}
              {selectedShow.show_date && (() => {
                const cd = getCountdown(selectedShow.show_date);
                if (!cd) return null;
                return (
                  <div className="bg-secondary/30 rounded-xl p-4">
                    <div className="flex justify-center gap-4 text-center">
                      {[
                        { val: cd.days, label: "HARI" },
                        { val: cd.hrs, label: "JAM" },
                        { val: cd.mins, label: "MENIT" },
                        { val: cd.secs, label: "DETIK" },
                      ].map((item) => (
                        <div key={item.label}>
                          <div className="text-2xl font-bold text-foreground">{String(item.val).padStart(2, "0")}</div>
                          <div className="text-[10px] text-muted-foreground font-medium">{item.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Description / Lineup */}
              {selectedShow.description && (
                <div>
                  <h3 className="font-bold text-foreground text-sm mb-1">DESKRIPSI</h3>
                  <p className="text-sm text-muted-foreground">{selectedShow.description}</p>
                </div>
              )}

              {selectedShow.lineup && selectedShow.lineup.length > 0 && (
                <div>
                  <h3 className="font-bold text-foreground text-sm mb-1">👥 LINE UP</h3>
                  <p className="text-sm text-muted-foreground">{selectedShow.lineup.join(", ")}</p>
                </div>
              )}

              {/* Buy button */}
              {purchases.includes(selectedShow.id) ? (
                <div className="space-y-3">
                  <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-center">
                    <p className="text-green-600 font-bold text-sm">✅ Sudah Dibeli!</p>
                    <p className="text-green-600/70 text-xs mt-1">Kamu sudah memiliki akses ke show ini</p>
                  </div>
                  <button
                    onClick={() => {
                      sessionStorage.setItem("teamlive_nickname", profile?.nickname || "User");
                      navigate("/live");
                    }}
                    className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-bold text-sm hover:opacity-90 transition-all"
                  >
                    ▶️ Tonton Sekarang
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {profile && profile.coins < selectedShow.price_coins && (
                    <p className="text-destructive text-xs text-center">Koin tidak cukup. Silakan top-up terlebih dahulu.</p>
                  )}
                  <button
                    onClick={() => handleBuy(selectedShow)}
                    disabled={buying || !profile || profile.coins < selectedShow.price_coins}
                    className="w-full bg-destructive text-destructive-foreground py-3 rounded-xl font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Coins size={16} /> Beli dengan {selectedShow.price_coins} Koin
                  </button>
                  <button
                    onClick={() => { setSelectedShow(null); navigate("/topup"); }}
                    className="w-full border border-border text-foreground py-2.5 rounded-xl text-sm font-medium hover:bg-secondary transition-all"
                  >
                    Top Up Koin
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CatalogPage;
