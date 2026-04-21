import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, LogOut, Plus, Trash2, ToggleLeft, ToggleRight, CreditCard, Link2, Calendar, Copy, Check, Link, Ticket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const ADMINS = [
  { email: "owner@teamlive.com", password: "teamlive2024" },
  { email: "admin2@teamlive.com", password: "teamlive2024" },
];
const AUTH_KEY = "teamlive_owner_auth";

interface Membership {
  id: string;
  name: string;
  type: string;
  price: number;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

const MembershipPanel = () => {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(() => sessionStorage.getItem(AUTH_KEY) === "true");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"weekly" | "monthly">("weekly");
  const [newPrice, setNewPrice] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const [publicLinkEnabled, setPublicLinkEnabled] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [membershipLink, setMembershipLink] = useState("");
  const [accessDays, setAccessDays] = useState(7);
  const [savedLink, setSavedLink] = useState(false);
  const [replayUrl, setReplayUrl] = useState("");
  const [replayPassword, setReplayPassword] = useState("");

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);

  const fetchMemberships = useCallback(async () => {
    const { data } = await supabase.from("memberships").select("*").order("created_at", { ascending: true });
    setMemberships((data as Membership[]) || []);
  }, []);

  const fetchSettings = useCallback(async () => {
    const { data } = await supabase.from("stream_settings").select("*").limit(1).maybeSingle();
    if (data) {
      setSettingsId(data.id);
      setPublicLinkEnabled((data as any).public_link_enabled ?? false);
      setMembershipLink((data as any).membership_link || "");
      setAccessDays((data as any).access_days || 7);
      setReplayUrl((data as any).replay_url || "t48.lovable.app/replay");
      setReplayPassword((data as any).replay_password || "");
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchMemberships();
      fetchSettings();

      const ch = supabase
        .channel("membership_realtime")
        .on("postgres_changes", { event: "*", schema: "public", table: "memberships" }, () => fetchMemberships())
        .on("postgres_changes", { event: "*", schema: "public", table: "stream_settings" }, () => fetchSettings())
        .subscribe();
      return () => { supabase.removeChannel(ch); };
    }
  }, [isAuthenticated, fetchMemberships, fetchSettings]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (ADMINS.some((a) => a.email === email && a.password === password)) {
      setIsAuthenticated(true);
      sessionStorage.setItem(AUTH_KEY, "true");
      setLoginError("");
    } else {
      setLoginError("Email atau password salah");
    }
  };

  const handleAdd = async () => {
    if (!newName.trim()) return;
    await supabase.from("memberships").insert({
      name: newName.trim(),
      type: newType,
      price: parseInt(newPrice) || 0,
      description: newDesc.trim() || null,
    });
    setNewName("");
    setNewPrice("");
    setNewDesc("");
    fetchMemberships();
  };

  const handleToggle = async (m: Membership) => {
    await supabase.from("memberships").update({ is_active: !m.is_active }).eq("id", m.id);
    fetchMemberships();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("memberships").delete().eq("id", id);
    fetchMemberships();
  };

  const togglePublicLink = async () => {
    const newVal = !publicLinkEnabled;
    // Optimistic UI
    setPublicLinkEnabled(newVal);
    try {
      if (settingsId) {
        const { error } = await supabase
          .from("stream_settings")
          .update({ public_link_enabled: newVal, updated_at: new Date().toISOString() } as any)
          .eq("id", settingsId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("stream_settings")
          .insert({ public_link_enabled: newVal } as any)
          .select("id")
          .single();
        if (error) throw error;
        if (data?.id) setSettingsId(data.id);
      }
      // Re-sync from DB to confirm persistence
      await fetchSettings();
    } catch (e: any) {
      // Roll back on failure
      setPublicLinkEnabled(!newVal);
      alert("Gagal menyimpan: " + (e?.message || "Coba lagi"));
    }
  };

  const saveMembershipSettings = async () => {
    const updateData: any = {
      membership_link: membershipLink.trim(),
      access_days: accessDays,
      updated_at: new Date().toISOString(),
    };
    if (settingsId) {
      await supabase.from("stream_settings").update(updateData).eq("id", settingsId);
    }
    setSavedLink(true);
    setTimeout(() => setSavedLink(false), 2000);
  };

  const generateTokenCode = () => {
    const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    return code;
  };

  const createMembershipToken = async (m: Membership): Promise<string | null> => {
    const days = m.type === "weekly" ? 7 : 30;
    const token_code = generateTokenCode();
    const { error } = await supabase.from("access_tokens").insert({
      token_code,
      duration_days: days,
      show_name: `Membership ${m.type === "weekly" ? "Mingguan" : "Bulanan"}`,
    } as any);
    if (error) {
      alert("Gagal membuat token membership: " + error.message);
      return null;
    }
    return token_code;
  };

  const handleCopyMembershipText = async (m: Membership) => {
    const code = await createMembershipToken(m);
    if (!code) return;
    const typeLabel = m.type === "weekly" ? "mingguan" : "bulanan";
    const duration = m.type === "weekly" ? "7 hari" : "30 hari";
    const link = `${window.location.origin}/watch/${code}`;

    const text = `🤩TERIMAKASIH TELAH MELAKUKAN PEMBELIAN MEMBERSHIP (${typeLabel})

⏳Durasi membership: ${duration} (mulai dihitung saat link pertama kali dibuka)

🔗Link akses: ${link}

📥Link grup: https://chat.whatsapp.com/JyEx1WM1rxnFz7qFM08V9L?mode=gi_t

Replay: ${replayUrl || "t48.lovable.app/replay"} SANDI: ${replayPassword || "-"}

⚠️ PENTING:
• 1 link = 1 perangkat (terikat otomatis saat dibuka)
• Hitungan ${duration} dimulai saat Anda pertama kali membuka link
• Jangan dibagikan ke orang lain

Jika ada kendala bisa chat admin, jangan malu malu yaa🥰`;

    navigator.clipboard.writeText(text);
    setCopiedId(m.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleCopyMembershipLink = async (m: Membership) => {
    const code = await createMembershipToken(m);
    if (!code) return;
    const link = `${window.location.origin}/watch/${code}`;
    navigator.clipboard.writeText(link);
    setCopiedLinkId(m.id);
    setTimeout(() => setCopiedLinkId(null), 2500);
  };

  const handleLogout = () => {
    sessionStorage.removeItem(AUTH_KEY);
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="bg-card border border-border rounded-xl p-8 w-full max-w-sm" style={{ animation: "fade-in 0.3s ease-out" }}>
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold text-foreground">Membership Panel</h1>
            <p className="text-muted-foreground text-sm mt-1">TEAM Live</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-input border border-border rounded-lg px-4 py-2.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring" placeholder="owner@teamlive.com" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-input border border-border rounded-lg px-4 py-2.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
            {loginError && <p className="text-destructive text-sm">{loginError}</p>}
            <button type="submit" className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg font-semibold hover:opacity-90 transition-all">Login</button>
          </form>
        </div>
      </div>
    );
  }

  const publicLink = `${window.location.origin}/live`;

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/owner")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-lg font-bold text-foreground">Membership & Public Link</h1>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <LogOut size={16} /> Logout
        </button>
      </header>

      <main className="max-w-lg mx-auto px-4 py-8 space-y-6">
        {/* Public Link Section */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">🌐</span>
            <h2 className="font-semibold text-foreground">Link Publik (Tanpa Token)</h2>
          </div>
          <p className="text-xs text-muted-foreground">Aktifkan agar siapa saja bisa menonton tanpa token akses.</p>

          <div className="flex items-center justify-between bg-secondary/20 rounded-lg p-3">
            <span className="text-sm text-foreground font-medium">{publicLinkEnabled ? "Aktif" : "Nonaktif"}</span>
            <button onClick={togglePublicLink} className="text-primary">
              {publicLinkEnabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} className="text-muted-foreground" />}
            </button>
          </div>

          {publicLinkEnabled && (
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Link untuk disebarkan:</label>
              <div className="flex gap-2">
                <input type="text" readOnly value={publicLink} className="flex-1 bg-input border border-border rounded-lg px-3 py-2 text-foreground text-sm font-mono" />
                <button
                  onClick={() => navigator.clipboard.writeText(publicLink)}
                  className="bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm font-medium hover:opacity-90"
                >
                  Salin
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Membership Link & Access Days */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Link2 size={18} className="text-primary" />
            <h2 className="font-semibold text-foreground">Pengaturan Membership</h2>
          </div>

          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Link Membership (untuk pembeli)</label>
            <input
              type="text"
              value={membershipLink}
              onChange={(e) => setMembershipLink(e.target.value)}
              placeholder="https://wa.me/628xxx atau link lainnya"
              className="w-full bg-input border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div>
            <label className="text-sm text-muted-foreground mb-1 block flex items-center gap-1">
              <Calendar size={12} /> Masa Berlaku Akses (hari)
            </label>
            <input
              type="number"
              value={accessDays}
              onChange={(e) => setAccessDays(parseInt(e.target.value) || 1)}
              min={1}
              max={365}
              className="w-full bg-input border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <p className="text-xs text-muted-foreground mt-1">Token akses akan berakhir setelah {accessDays} hari.</p>
          </div>

          <button
            onClick={saveMembershipSettings}
            className="w-full bg-primary text-primary-foreground py-2 rounded-lg font-medium text-sm hover:opacity-90 transition-all"
          >
            {savedLink ? "Tersimpan ✓" : "Simpan Pengaturan Membership"}
          </button>
        </div>

        {/* Memberships */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-5">
          <div className="flex items-center gap-2">
            <CreditCard size={18} className="text-primary" />
            <h2 className="font-semibold text-foreground">Paket Membership</h2>
          </div>

          {/* Add form */}
          <div className="space-y-3 bg-secondary/20 rounded-lg p-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tambah Paket Baru</p>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nama paket"
              className="w-full bg-input border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as "weekly" | "monthly")}
                className="bg-input border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="weekly">Mingguan</option>
                <option value="monthly">Bulanan</option>
              </select>
              <input
                type="number"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                placeholder="Harga (Rp)"
                className="bg-input border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <input
              type="text"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Deskripsi (opsional)"
              className="w-full bg-input border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <button
              onClick={handleAdd}
              className="w-full bg-primary text-primary-foreground py-2 rounded-lg font-medium text-sm hover:opacity-90 transition-all flex items-center justify-center gap-2"
            >
              <Plus size={14} /> Tambah Paket
            </button>
          </div>

          {/* List */}
          <div className="space-y-2">
            {memberships.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Belum ada paket membership.</p>
            )}
            {memberships.map((m) => (
              <div key={m.id} className={`border rounded-lg p-3 ${m.is_active ? "border-primary/30 bg-primary/5" : "border-border bg-secondary/10 opacity-60"}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-foreground text-sm">{m.name}</span>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-[10px] bg-accent text-muted-foreground px-1.5 py-0.5 rounded">
                        {m.type === "weekly" ? "Mingguan" : "Bulanan"}
                      </span>
                      <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded flex items-center gap-0.5">
                        <Ticket size={9} /> {m.type === "weekly" ? "7 hari" : "30 hari"} sejak link dibuka
                      </span>
                      <span className="text-xs text-primary font-medium">
                        Rp {m.price.toLocaleString("id-ID")}
                      </span>
                    </div>
                    {m.description && <p className="text-xs text-muted-foreground mt-1">{m.description}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    {/* Copy link only — generates a fresh access token */}
                    <button
                      onClick={() => handleCopyMembershipLink(m)}
                      className="p-1.5 rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                      title="Buat & salin link akses (token otomatis)"
                    >
                      {copiedLinkId === m.id ? <Check size={14} className="text-green-500" /> : <Link size={14} />}
                    </button>
                    {/* Copy link + text */}
                    <button
                      onClick={() => handleCopyMembershipText(m)}
                      className="p-1.5 rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                      title="Buat token + salin teks lengkap"
                    >
                      {copiedId === m.id ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                    </button>
                    <button onClick={() => handleToggle(m)} className="p-1.5 rounded-md hover:bg-secondary transition-colors">
                      {m.is_active ? <ToggleRight size={18} className="text-primary" /> : <ToggleLeft size={18} className="text-muted-foreground" />}
                    </button>
                    <button onClick={() => handleDelete(m.id)} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-muted-foreground/30 text-xs font-mono">@t48id</p>
      </main>
    </div>
  );
};

export default MembershipPanel;
