import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Save, LogOut, ArrowLeft, Upload, X, CreditCard, Play, KeyRound } from "lucide-react";
import { extractYouTubeVideoId } from "@/lib/youtube";
import { supabase } from "@/integrations/supabase/client";
import ShowManager, { Show } from "@/components/owner/ShowManager";
import StreamSettings from "@/components/owner/StreamSettings";
import TokenManager from "@/components/owner/TokenManager";
import LineupManager from "@/components/owner/LineupManager";
import CoinApproval from "@/components/owner/CoinApproval";
import ShowCatalogManager from "@/components/owner/ShowCatalogManager";
import ReplayScheduleManager from "@/components/owner/ReplayScheduleManager";
import ModeratorManager from "@/components/owner/ModeratorManager";
import CatalogSlideManager from "@/components/owner/CatalogSlideManager";
import AdminManager from "@/components/owner/AdminManager";
import ChatReportsManager from "@/components/owner/ChatReportsManager";
import ViewerFilter from "@/components/owner/ViewerFilter";

const AUTH_KEY = "teamlive_owner_auth";
const OWNER_TOKEN_KEY = "teamlive_owner_token";

const OwnerPanel = () => {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem(AUTH_KEY) === "true";
  });
  const [ownerToken, setOwnerToken] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [saved, setSaved] = useState(false);
  const [videoError, setVideoError] = useState("");

  const [channelName, setChannelName] = useState("TEAM Live");
  const [siteName, setSiteName] = useState("TEAM Live");
  const [channelAvatar, setChannelAvatar] = useState("");
  const [channelAvatar2, setChannelAvatar2] = useState("");
  const [videoId, setVideoId] = useState("");
  const [streamTitle, setStreamTitle] = useState("Siaran Langsung");
  const [m3u8Url1, setM3u8Url1] = useState("");
  const [m3u8Url2, setM3u8Url2] = useState("");
  const [bgEffect, setBgEffect] = useState<string>("rain");

  // Data from DB
  const [tokens, setTokens] = useState<any[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [shows, setShows] = useState<Show[]>([]);
  const [streamSettings, setStreamSettings] = useState<any>(null);

  // Realtime subscription for stream settings
  useEffect(() => {
    if (!isAuthenticated) return;
    const ch = supabase.channel("owner_stream_settings_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "stream_settings" }, () => {
        fetchStreamSettings();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const fetchTokens = useCallback(async () => {
    setLoadingTokens(true);
    const { data } = await supabase
      .from("access_tokens")
      .select("*")
      .order("created_at", { ascending: false });
    setTokens(data || []);
    setLoadingTokens(false);
  }, []);

  const fetchShows = useCallback(async () => {
    const { data } = await supabase.from("shows").select("*").order("created_at", { ascending: true });
    setShows((data as Show[]) || []);
  }, []);

  const fetchStreamSettings = useCallback(async () => {
    const { data } = await supabase
      .from("stream_settings")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setStreamSettings(data);
    if (data) {
      setChannelName((data as any).channel_name || "TEAM Live");
      setChannelAvatar((data as any).channel_avatar || "");
      setChannelAvatar2((data as any).channel_avatar_2 || "");
      setVideoId((data as any).video_id || "");
      setStreamTitle((data as any).stream_title || "Siaran Langsung");
      setM3u8Url1((data as any).stream_source_url || "");
      setM3u8Url2((data as any).stream_source_url_2 || "");
      setBgEffect((data as any).background_effect || "rain");
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchTokens();
      fetchShows();
      fetchStreamSettings();
    }
  }, [isAuthenticated, fetchTokens, fetchShows, fetchStreamSettings]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError("");
    const { data, error } = await supabase.functions.invoke("validate-owner-token", { body: { token: ownerToken } });
    setLoginLoading(false);
    if (!error && (data as any)?.valid) {
      setIsAuthenticated(true);
      sessionStorage.setItem(AUTH_KEY, "true");
      sessionStorage.setItem(OWNER_TOKEN_KEY, ownerToken.trim());
    } else {
      setLoginError("Token owner salah");
    }
  };

  const handleSave = async () => {
    if (videoId.trim() && !extractYouTubeVideoId(videoId)) {
      setVideoError("Link YouTube tidak valid. Coba paste ulang URL atau Video ID.");
      return;
    }
    setVideoError("");
    const normalizedVideoId = extractYouTubeVideoId(videoId) || "";

    const detectType = (u: string) => (/m3u8/i.test(u) ? "m3u8" : "youtube");
    const updateData: any = {
      video_id: normalizedVideoId,
      channel_name: channelName,
      stream_title: streamTitle,
      channel_avatar: channelAvatar,
      channel_avatar_2: channelAvatar2,
      stream_source_url: m3u8Url1.trim(),
      stream_source_url_2: m3u8Url2.trim(),
      stream_source_type: detectType(m3u8Url1.trim() || normalizedVideoId),
      background_effect: bgEffect,
      updated_at: new Date().toISOString(),
    };

    let error: any = null;
    if (streamSettings?.id) {
      const res = await supabase.from("stream_settings").update(updateData).eq("id", streamSettings.id);
      error = res.error;
    } else {
      const res = await supabase.from("stream_settings").insert({ ...updateData, is_singleton: true } as any);
      error = res.error;
    }
    if (error) {
      setVideoError("Gagal menyimpan: " + error.message);
      return;
    }

    setVideoId(normalizedVideoId);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    fetchStreamSettings();
  };

  const handleLogout = () => {
    sessionStorage.removeItem(AUTH_KEY);
    sessionStorage.removeItem(OWNER_TOKEN_KEY);
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="bg-card border border-border rounded-xl p-8 w-full max-w-sm" style={{ animation: "fade-in 0.3s ease-out" }}>
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold text-foreground">Owner Panel</h1>
            <p className="text-muted-foreground text-sm mt-1">TEAM Live</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block flex items-center gap-1.5"><KeyRound size={14} /> Token Owner</label>
              <input
                type="password"
                inputMode="numeric"
                value={ownerToken}
                onChange={(e) => setOwnerToken(e.target.value)}
                className="w-full bg-input border border-border rounded-lg px-4 py-2.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring text-center font-mono tracking-[0.25em]"
                placeholder="•••••"
              />
            </div>
            {loginError && <p className="text-destructive text-sm">{loginError}</p>}
            <button
              type="submit"
              disabled={loginLoading || !ownerToken.trim()}
              className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg font-semibold hover:opacity-90 transition-all disabled:opacity-50"
            >
              {loginLoading ? "Memeriksa..." : "Masuk Owner"}
            </button>
          </form>
          <p className="text-center text-muted-foreground/40 text-xs mt-4 font-mono">@t48id</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-lg font-bold text-foreground">Owner Panel</h1>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <LogOut size={16} />
          Logout
        </button>
      </header>

      <main className="max-w-lg mx-auto px-4 py-8 space-y-6">
        {/* Owner Watch Button */}
        <button
          onClick={() => navigate("/owner-watch")}
          className="w-full bg-gradient-to-r from-primary to-accent border border-primary/50 rounded-xl p-4 hover:opacity-90 transition-all flex items-center gap-3"
        >
          <div className="p-2 rounded-lg bg-primary-foreground/20">
            <Play size={20} className="text-primary-foreground" />
          </div>
          <div className="text-left">
            <div className="text-primary-foreground font-bold text-sm">▶️ Tonton Langsung (Owner)</div>
            <div className="text-primary-foreground/70 text-xs">Nonton stream langsung dengan mode Owner</div>
          </div>
        </button>

        {/* Channel Settings */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-5">
          <h2 className="font-semibold text-foreground">Pengaturan Channel</h2>

          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Nama Channel</label>
            <input
              type="text"
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
              maxLength={30}
              className="w-full bg-input border border-border rounded-lg px-4 py-2.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div>
            <label className="text-sm text-muted-foreground mb-2 block">Logo Channel</label>
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-full overflow-hidden bg-secondary flex items-center justify-center flex-shrink-0 border border-border">
                {channelAvatar ? (
                  <img src={channelAvatar} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <Upload size={20} className="text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 space-y-2">
                <label className="block w-full cursor-pointer bg-secondary hover:bg-accent text-foreground text-sm text-center py-2 rounded-lg transition-colors">
                  Pilih dari Galeri
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 2 * 1024 * 1024) {
                        alert("Ukuran file maksimal 2MB");
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = (ev) => setChannelAvatar(ev.target?.result as string);
                      reader.readAsDataURL(file);
                    }}
                  />
                </label>
                {channelAvatar && (
                  <button
                    onClick={() => setChannelAvatar("")}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <X size={12} /> Hapus foto
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Logo Channel 2 */}
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">Logo Channel 2 (Opsional)</label>
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-full overflow-hidden bg-secondary flex items-center justify-center flex-shrink-0 border border-border">
                {channelAvatar2 ? (
                  <img src={channelAvatar2} alt="Logo 2" className="w-full h-full object-cover" />
                ) : (
                  <Upload size={20} className="text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 space-y-2">
                <label className="block w-full cursor-pointer bg-secondary hover:bg-accent text-foreground text-sm text-center py-2 rounded-lg transition-colors">
                  Pilih dari Galeri
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 2 * 1024 * 1024) { alert("Ukuran file maksimal 2MB"); return; }
                      const reader = new FileReader();
                      reader.onload = (ev) => setChannelAvatar2(ev.target?.result as string);
                      reader.readAsDataURL(file);
                    }}
                  />
                </label>
                {channelAvatar2 && (
                  <button onClick={() => setChannelAvatar2("")} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors">
                    <X size={12} /> Hapus foto
                  </button>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Logo kedua akan tampil di samping logo utama. Kosongkan jika tidak diperlukan.</p>
          </div>

          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Judul Stream</label>
            <input
              type="text"
              value={streamTitle}
              onChange={(e) => setStreamTitle(e.target.value)}
              maxLength={100}
              className="w-full bg-input border border-border rounded-lg px-4 py-2.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div>
            <label className="text-sm text-muted-foreground mb-1 block">YouTube URL atau Video ID</label>
            <input
              type="text"
              value={videoId}
              onChange={(e) => { setVideoId(e.target.value); setVideoError(""); }}
              placeholder="contoh: https://youtu.be/dQw4w9WgXcQ"
              className={`w-full bg-input border rounded-lg px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring ${videoError ? "border-destructive" : "border-border"}`}
            />
            {videoError ? (
              <p className="text-xs text-destructive mt-1">{videoError}</p>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">
                Bisa paste link YouTube biasa, youtu.be, shorts, live, atau langsung Video ID.
              </p>
            )}
            {(() => {
              const previewId = extractYouTubeVideoId(videoId);
              if (!previewId) return null;
              return (
                <div className="mt-3 rounded-lg overflow-hidden border border-border">
                  <img
                    src={`https://i.ytimg.com/vi/${previewId}/hqdefault.jpg`}
                    alt="Preview thumbnail"
                    className="w-full aspect-video object-cover"
                  />
                  <div className="px-3 py-2 bg-secondary/50 text-xs text-muted-foreground font-mono">
                    ID: {previewId}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* M3U8 Stream Source 1 */}
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">🔴 Link M3U8 Utama (Live)</label>
            <input
              type="text"
              value={m3u8Url1}
              onChange={(e) => setM3u8Url1(e.target.value)}
              placeholder="https://...playlist.m3u8"
              className="w-full bg-input border border-border rounded-lg px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">Jika diisi, link M3U8 akan dipakai sebagai sumber live utama (mengganti YouTube).</p>
          </div>

          {/* M3U8 Stream Source 2 - Fallback */}
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">🟡 Link M3U8 Cadangan (Opsional)</label>
            <input
              type="text"
              value={m3u8Url2}
              onChange={(e) => setM3u8Url2(e.target.value)}
              placeholder="https://...backup.m3u8 (kosongkan jika tidak ada)"
              className="w-full bg-input border border-border rounded-lg px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">Otomatis dipakai jika link utama gagal/kosong. Boleh dikosongkan.</p>
          </div>

          {/* Background Effect Picker */}
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">🎨 Efek Animasi Background</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { v: "rain", l: "🌧️ Hujan" },
                { v: "snow", l: "❄️ Salju" },
                { v: "leaves", l: "🍃 Daun" },
                { v: "money", l: "💵 Uang" },
                { v: "emoji", l: "✨ Emoji" },
                { v: "none", l: "🚫 Tidak ada" },
              ].map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setBgEffect(opt.v)}
                  className={`px-2 py-2 rounded-lg text-xs font-medium border transition-all ${
                    bgEffect === opt.v
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary/40 border-border text-foreground hover:bg-secondary"
                  }`}
                >
                  {opt.l}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Pilih efek animasi yang tampil di seluruh website. Berubah real-time untuk semua penonton.</p>
          </div>

          <button
            onClick={handleSave}
            className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg font-semibold hover:opacity-90 transition-all flex items-center justify-center gap-2"
          >
            <Save size={16} />
            {saved ? "Tersimpan ✓" : "Simpan Pengaturan"}
          </button>
        </div>

        {/* Show Manager */}
        <ShowManager shows={shows} onRefresh={fetchShows} />

        {/* Lineup Manager */}
        <LineupManager
          selectedNames={((streamSettings as any)?.lineup || []).map((m: any) => m.name)}
          streamSettingsId={streamSettings?.id || null}
          onRefresh={fetchStreamSettings}
        />

        {/* Stream Settings (Countdown, Backup, Replay) */}
        <StreamSettings settings={streamSettings} onRefresh={fetchStreamSettings} />

        {/* Replay Schedule Manager */}
        <ReplayScheduleManager />

        {/* Show Catalog Manager */}
        <ShowCatalogManager />

        {/* Catalog Slider Manager */}
        <CatalogSlideManager />

        {/* Coin Approval */}
        <CoinApproval />

        {/* Moderator Manager */}
        <ModeratorManager />

        {/* Admin Manager (login by name + code) */}
        <AdminManager />

        {/* Chat Reports (real-time) */}
        <ChatReportsManager />

        {/* Token Manager */}
        <TokenManager
          tokens={tokens}
          shows={shows}
          loadingTokens={loadingTokens}
          onRefresh={fetchTokens}
          streamSettings={streamSettings}
        />

        {/* Link to Membership Panel */}
        <button
          onClick={() => navigate("/membership")}
          className="w-full bg-gradient-to-r from-primary/20 to-accent/30 border border-primary/30 rounded-xl p-4 hover:border-primary/50 transition-all flex items-center gap-3"
        >
          <div className="p-2 rounded-lg bg-primary/20 text-primary">
            <CreditCard size={20} />
          </div>
          <div className="text-left">
            <div className="text-foreground font-semibold text-sm">Membership & Public Link</div>
            <div className="text-muted-foreground text-xs">Kelola paket membership & link publik</div>
          </div>
        </button>

        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="font-semibold text-foreground mb-2">Login Owner</h2>
          <p className="text-xs text-muted-foreground">Owner panel sekarang memakai token khusus agar lebih cepat dan aman.</p>
        </div>

        <p className="text-center text-muted-foreground/30 text-xs font-mono">@t48id</p>
      </main>
    </div>
  );
};

export default OwnerPanel;
