import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Search, Coins, LogOut, Eye, Calendar, Sparkles, ChevronLeft, ChevronRight, MessageCircle } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { celebrateShowPurchase } from "@/lib/celebration";
import CatalogMembershipSection from "@/components/CatalogMembershipSection";

interface ShowItem {
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

interface Profile {
  user_code: string;
  nickname: string;
  coins: number;
}

interface CatalogSlide {
  id: string;
  title: string | null;
  image_url: string;
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
  const [justBoughtId, setJustBoughtId] = useState<string | null>(null);
  const [bgUrl, setBgUrl] = useState<string>("");
  const [bgType, setBgType] = useState<string>("image");
  const [slides, setSlides] = useState<CatalogSlide[]>([]);
  const [activeSlide, setActiveSlide] = useState(0);

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

    const fetchBg = async () => {
      const { data } = await supabase.from("stream_settings").select("catalog_background_url, catalog_background_type" as any).limit(1).maybeSingle();
      if (data) {
        setBgUrl((data as any).catalog_background_url || "");
        setBgType((data as any).catalog_background_type || "image");
      }
    };
    fetchBg();

    const fetchSlides = async () => {
      const { data } = await (supabase as any).from("catalog_slides").select("id,title,image_url").eq("is_active", true).order("sort_order", { ascending: true }).order("created_at", { ascending: false });
      setSlides((data || []) as CatalogSlide[]);
      setActiveSlide(0);
    };
    fetchSlides();

    // Realtime — sync shows, profile coins, purchases, settings
    const ch = supabase.channel("catalog_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "show_catalog" }, () => fetchShows())
      .on("postgres_changes", { event: "*", schema: "public", table: "stream_settings" }, () => fetchBg())
      .on("postgres_changes", { event: "*", schema: "public", table: "catalog_slides" }, () => fetchSlides())
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, async () => {
        const { data: { user: u } } = await supabase.auth.getUser();
        if (u) {
          const { data: p } = await supabase.from("profiles").select("*").eq("user_id", u.id).maybeSingle();
          if (p) setProfile(p as any);
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "show_purchases" }, async () => {
        const { data: { user: u } } = await supabase.auth.getUser();
        if (u) {
          const { data: purch } = await supabase.from("show_purchases").select("show_id").eq("user_id", u.id);
          if (purch) setPurchases(purch.map((x: any) => x.show_id));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [navigate]);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(() => setActiveSlide((i) => (i + 1) % slides.length), 4500);
    return () => clearInterval(timer);
  }, [slides.length]);

  const handleBuy = async (show: ShowItem) => {
    if (!user || !profile) return;
    if (profile.coins < show.price_coins) return;
    setBuying(true);

    const { error: updateErr } = await supabase.from("profiles").update({ coins: profile.coins - show.price_coins } as any).eq("user_id", user.id);
    if (updateErr) { setBuying(false); return; }

    await supabase.from("show_purchases").insert({ user_id: user.id, show_id: show.id, coins_spent: show.price_coins } as any);

    setProfile(prev => prev ? { ...prev, coins: prev.coins - show.price_coins } : prev);
    setPurchases(prev => [...prev, show.id]);
    setJustBoughtId(show.id);
    celebrateShowPurchase();
    setTimeout(() => setJustBoughtId(null), 2500);
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

  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Per-show background overlay (used on details modal)
  const detailBg = selectedShow?.background_url || bgUrl;
  const detailBgType = selectedShow?.background_url ? "image" : bgType; // per-show always image for now
  const isShowStarted = (show: ShowItem) => !show.show_date || new Date(show.show_date).getTime() <= Date.now();
  const trialAvailable = shows.some((show) => show.is_active && isShowStarted(show));

  return (
    <div className="min-h-screen relative bg-gradient-to-b from-sky-50 via-white to-blue-50">
      {/* Owner-controlled background (image or video) */}
      {bgUrl && (
        <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
          {bgType === "video" ? (
            <video
              key={bgUrl}
              autoPlay
              loop
              muted
              playsInline
              preload="auto"
              disablePictureInPicture
              controls={false}
              ref={(el) => {
                if (!el) return;
                el.muted = true;
                const tryPlay = () => el.play().catch(() => {});
                tryPlay();
                el.addEventListener("loadeddata", tryPlay, { once: true });
              }}
              className="w-full h-full object-cover opacity-70 saturate-125 brightness-110"
            >
              <source src={bgUrl} type="video/mp4" />
              <source src={bgUrl} type="video/webm" />
            </video>
          ) : (
            <img src={bgUrl} alt="" className="w-full h-full object-cover opacity-50 saturate-125 brightness-110" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-white/45 via-sky-50/35 to-white/55" />
        </div>
      )}

      <div className="relative z-10">
        {/* Header sticky */}
        <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-sky-100">
          <div className="bg-gradient-to-r from-sky-400 to-blue-500 text-white text-center py-2 text-xs font-medium">
            {new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </div>
        </div>

        <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-sky-600 to-blue-600 bg-clip-text text-transparent">Katalog Show</h1>
            <p className="text-slate-500 text-sm">Pilih show JKT48 favoritmu</p>
            <button
              onClick={() => navigate("/topup")}
              className="inline-flex items-center gap-1.5 bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-700 px-4 py-1.5 rounded-full text-sm font-semibold mt-2 hover:shadow-md hover:shadow-amber-200/50 transition-all"
            >
              <Coins size={14} /> Saldo: {profile?.coins?.toLocaleString("id-ID") || 0} Koin
            </button>
          </div>

          {/* User info bar */}
          <div className="flex items-center justify-between bg-white border border-sky-100 rounded-xl px-3 py-2 shadow-sm">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-500">ID:</span>
              <span className="font-mono font-bold text-slate-800">{profile?.user_code || "..."}</span>
              <span className="text-slate-300">|</span>
              <span className="text-slate-700 font-medium">{profile?.nickname}</span>
            </div>
            <button onClick={handleLogout} className="text-slate-400 hover:text-sky-600 p-1">
              <LogOut size={16} />
            </button>
          </div>

          {slides.length > 0 && (
            <div className="relative overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-sm shadow-sky-100/70">
              <div className="relative aspect-[16/8]">
                {slides.map((slide, index) => (
                  <img
                    key={slide.id}
                    src={slide.image_url}
                    alt={slide.title || "Foto katalog"}
                    className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ease-out ${index === activeSlide ? "opacity-100" : "opacity-0"}`}
                  />
                ))}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/35 via-transparent to-transparent" />
                {slides[activeSlide]?.title && <p className="absolute bottom-3 left-3 right-14 text-white text-sm font-semibold drop-shadow">{slides[activeSlide].title}</p>}
                {slides.length > 1 && (
                  <>
                    <button onClick={() => setActiveSlide((activeSlide - 1 + slides.length) % slides.length)} className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/85 text-sky-700 p-1.5 rounded-full shadow">
                      <ChevronLeft size={16} />
                    </button>
                    <button onClick={() => setActiveSlide((activeSlide + 1) % slides.length)} className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/85 text-sky-700 p-1.5 rounded-full shadow">
                      <ChevronRight size={16} />
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="bg-white/95 border border-sky-100 rounded-2xl p-4 shadow-sm shadow-sky-100/70 space-y-3">
            <div className="flex items-center gap-2 text-sky-700 font-bold text-sm">
              <Coins size={16} /> Cara Membeli Koin
            </div>
            <ol className="grid gap-2 text-xs text-slate-600 list-decimal list-inside">
              <li>Tekan tombol saldo koin atau Top Up Koin.</li>
              <li>Pilih paket koin, lalu scan QRIS sesuai nominal.</li>
              <li>Kirim kode top up dan bukti pembayaran ke admin.</li>
              <li>Setelah admin menyetujui, koin otomatis masuk real-time.</li>
            </ol>
            <a href="https://wa.me/6282135963767" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-700 hover:text-blue-700 transition-colors">
              <MessageCircle size={14} /> Bantuan admin
            </a>
          </div>

          <CatalogMembershipSection user={user} profile={profile} trialAvailable={trialAvailable} onCoinsChange={(coins) => setProfile(prev => prev ? { ...prev, coins } : prev)} />

          {/* Search */}
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-sky-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari show..."
              className="w-full bg-white border border-sky-200 rounded-xl pl-10 pr-4 py-3 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent transition-all"
            />
          </div>

          {/* Show cards */}
          <div className="space-y-4">
            {filteredShows.length === 0 && (
              <p className="text-center text-slate-400 py-8">Belum ada show tersedia.</p>
            )}
            {filteredShows.map((show) => {
              const purchased = purchases.includes(show.id);
              const countdown = show.show_date ? getCountdown(show.show_date) : null;
              const flash = justBoughtId === show.id;
              return (
                <div
                  key={show.id}
                  className={`bg-white border border-sky-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-lg hover:shadow-sky-200/40 transition-all ${flash ? "ring-4 ring-blue-400 animate-pulse" : ""}`}
                >
                  {show.image_url && (
                    <div className="relative">
                      <img src={show.image_url} alt={show.title} className="w-full aspect-[2/1] object-cover" />
                      <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm text-sky-700 px-3 py-1 rounded-full text-xs font-semibold shadow">
                        {countdown ? "📅 Terjadwal" : "🔴 Live"}
                      </div>
                      {purchased && (
                        <div className="absolute top-3 left-3 bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg flex items-center gap-1">
                          <Sparkles size={12} /> Dibeli
                        </div>
                      )}
                      {show.lineup && show.lineup.length > 0 && (
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                          <div className="flex items-center gap-1">
                            <Eye size={12} className="text-white/90" />
                            <span className="text-white/90 text-xs">{show.lineup.length}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="p-4 space-y-2">
                    <h3 className="font-bold text-slate-800">{show.title}</h3>
                    {show.show_date && (
                      <p className="text-xs text-slate-500 flex items-center gap-1">
                        <Calendar size={12} /> {formatDate(show.show_date)}
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-blue-600 font-bold text-lg">
                        Rp {(show.price_coins * 2500).toLocaleString("id-ID")}
                      </span>
                      <button
                        onClick={() => setSelectedShow(show)}
                        className="text-sky-600 text-sm font-semibold hover:text-blue-600"
                      >
                        Lihat Detail →
                      </button>
                    </div>
                    {isShowStarted(show) && !purchased && (
                      <button
                        onClick={() => navigate("/trial-live")}
                        className="w-full mt-2 bg-gradient-to-r from-sky-100 to-blue-100 text-sky-700 py-2.5 rounded-xl text-sm font-bold hover:shadow-md hover:shadow-sky-200/50 transition-all"
                      >
                        ▶️ Coba Tester Live 3 Menit
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-center text-slate-300 text-xs font-mono pt-4">@t48id</p>
        </div>
      </div>

      {/* Show Detail Modal */}
      {selectedShow && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={() => setSelectedShow(null)}>
          <div
            className="relative bg-white w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            style={{ animation: "fade-in 0.25s ease-out" }}
          >
            {/* Per-show background (owner-controlled) */}
            {detailBg && (
              <div className="absolute inset-0 z-0 pointer-events-none rounded-3xl overflow-hidden">
                <img src={detailBg} alt="" className="w-full h-full object-cover opacity-20" />
                <div className="absolute inset-0 bg-gradient-to-b from-white/85 to-white/95" />
              </div>
            )}

            <div className="relative z-10">
              {selectedShow.image_url && (
                <div className="relative">
                  <img src={selectedShow.image_url} alt={selectedShow.title} className="w-full aspect-[2/1] object-cover" />
                  <button onClick={() => setSelectedShow(null)} className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm w-8 h-8 rounded-full flex items-center justify-center text-slate-700 shadow">✕</button>
                  <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-semibold text-sky-700 shadow">
                    {selectedShow.show_date && getCountdown(selectedShow.show_date) ? "📅 Terjadwal" : "🔴 Live"}
                  </div>
                  {selectedShow.lineup && (
                    <div className="absolute bottom-3 right-3 bg-blue-500 text-white px-2 py-1 rounded-full text-xs flex items-center gap-1 shadow">
                      <Eye size={12} /> {selectedShow.lineup.length}
                    </div>
                  )}
                </div>
              )}

              <div className="p-5 space-y-4">
                <div className="text-center">
                  <h2 className="text-xl font-bold text-slate-800">{selectedShow.title}</h2>
                  {selectedShow.show_date && (
                    <p className="text-sm text-slate-500 mt-1 flex items-center justify-center gap-1">
                      <Calendar size={14} /> {formatDate(selectedShow.show_date)}
                    </p>
                  )}
                </div>

                {/* Countdown */}
                {selectedShow.show_date && (() => {
                  const cd = getCountdown(selectedShow.show_date);
                  if (!cd) return null;
                  return (
                    <div className="bg-gradient-to-r from-sky-50 to-blue-50 border border-sky-100 rounded-2xl p-4">
                      <p className="text-center text-xs text-sky-600 font-semibold uppercase tracking-wider mb-2">Show dimulai dalam</p>
                      <div className="flex justify-center gap-4 text-center">
                        {[
                          { val: cd.days, label: "HARI" },
                          { val: cd.hrs, label: "JAM" },
                          { val: cd.mins, label: "MENIT" },
                          { val: cd.secs, label: "DETIK" },
                        ].map((item) => (
                          <div key={item.label}>
                            <div className="text-2xl font-bold text-blue-600">{String(item.val).padStart(2, "0")}</div>
                            <div className="text-[10px] text-slate-500 font-medium">{item.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {selectedShow.description && (
                  <div>
                    <h3 className="font-bold text-slate-700 text-sm mb-1">DESKRIPSI</h3>
                    <p className="text-sm text-slate-600">{selectedShow.description}</p>
                  </div>
                )}

                {selectedShow.lineup && selectedShow.lineup.length > 0 && (
                  <div>
                    <h3 className="font-bold text-slate-700 text-sm mb-1">👥 LINE UP</h3>
                    <p className="text-sm text-slate-600">{selectedShow.lineup.join(", ")}</p>
                  </div>
                )}

                {purchases.includes(selectedShow.id) ? (
                  <div className="space-y-3">
                    <div className="bg-gradient-to-r from-blue-50 to-sky-50 border border-blue-200 rounded-2xl p-4 text-center">
                      <p className="text-blue-700 font-bold text-sm">✅ Sudah Dibeli!</p>
                      <p className="text-blue-600/70 text-xs mt-1">
                        {selectedShow.show_date && getCountdown(selectedShow.show_date)
                          ? `Akses akan dibuka pada ${formatDate(selectedShow.show_date)}`
                          : "Kamu sudah memiliki akses ke show ini"}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        sessionStorage.setItem("teamlive_nickname", profile?.nickname || "User");
                        navigate("/live");
                      }}
                      className="w-full bg-gradient-to-r from-sky-500 to-blue-500 text-white py-3 rounded-2xl font-bold text-sm hover:shadow-lg hover:shadow-sky-300/50 transition-all"
                    >
                      ▶️ Tonton Sekarang
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {isShowStarted(selectedShow) && (
                      <button
                        onClick={() => navigate("/trial-live")}
                        className="w-full border border-sky-200 bg-sky-50 text-sky-700 py-2.5 rounded-2xl text-sm font-bold hover:bg-sky-100 transition-all"
                      >
                        ▶️ Tester Live Gratis 3 Menit
                      </button>
                    )}
                    {profile && profile.coins < selectedShow.price_coins && (
                      <p className="text-red-500 text-xs text-center">Koin tidak cukup. Silakan top-up terlebih dahulu.</p>
                    )}
                    <button
                      onClick={() => handleBuy(selectedShow)}
                      disabled={buying || !profile || profile.coins < selectedShow.price_coins}
                      className="w-full bg-gradient-to-r from-blue-500 to-sky-500 text-white py-3 rounded-2xl font-bold text-sm hover:shadow-lg hover:shadow-blue-300/50 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <Coins size={16} /> Beli dengan {selectedShow.price_coins} Koin
                    </button>
                    <button
                      onClick={() => { setSelectedShow(null); navigate("/topup"); }}
                      className="w-full border border-sky-200 text-sky-700 py-2.5 rounded-2xl text-sm font-medium hover:bg-sky-50 transition-all"
                    >
                      Top Up Koin
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CatalogPage;
