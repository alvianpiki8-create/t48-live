import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Coins, Copy, Check, Clock, MessageCircle } from "lucide-react";
import { celebrateCoinTopup } from "@/lib/celebration";
import { toast } from "@/hooks/use-toast";

const ADMIN_WHATSAPP = "6282135963767"; // Admin TEAM Live
import type { User } from "@supabase/supabase-js";

const COIN_PACKAGES = [
  { coins: 1, price: 2500 },
  { coins: 2, price: 5000 },
  { coins: 4, price: 10000 },
  { coins: 8, price: 20000 },
  { coins: 10, price: 25000 },
  { coins: 14, price: 35000 },
  { coins: 16, price: 40000 },
  { coins: 24, price: 60000 },
  { coins: 28, price: 70000 },
  { coins: 34, price: 85000 },
  { coins: 40, price: 100000 },
];

const generateCode = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let code = "#";
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
};

interface TopupRequest {
  id: string;
  amount: number;
  total_price: number;
  topup_code: string;
  status: string;
  created_at: string;
}

const TopUpPage = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [coins, setCoins] = useState(0);
  const [selected, setSelected] = useState<typeof COIN_PACKAGES[0] | null>(null);
  const [step, setStep] = useState<"select" | "pay" | "done">("select");
  const [topupCode, setTopupCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<TopupRequest[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const prevConfirmedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const init = async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) { navigate("/auth"); return; }
      setUser(u);

      const { data: p } = await supabase.from("profiles").select("coins").eq("user_id", u.id).maybeSingle();
      if (p) setCoins((p as any).coins || 0);

      const { data: h } = await supabase.from("coin_topup_requests").select("*").eq("user_id", u.id).order("created_at", { ascending: false }).limit(20);
      if (h) {
        setHistory(h as any);
        (h as any[]).filter(r => r.status === "confirmed").forEach(r => prevConfirmedRef.current.add(r.id));
      }
    };
    init();

    const ch = supabase.channel("topup_rt")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, async (payload) => {
        const { data: { user: u } } = await supabase.auth.getUser();
        if (u && (payload.new as any).user_id === u.id) {
          setCoins((payload.new as any).coins || 0);
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "coin_topup_requests" }, async (payload) => {
        const { data: { user: u } } = await supabase.auth.getUser();
        if (!u) return;
        const row = (payload.new || payload.old) as any;
        if (row?.user_id !== u.id) return;

        const { data: h } = await supabase.from("coin_topup_requests").select("*").eq("user_id", u.id).order("created_at", { ascending: false }).limit(20);
        if (h) setHistory(h as any);

        if (payload.eventType === "UPDATE" && row.status === "confirmed" && !prevConfirmedRef.current.has(row.id)) {
          prevConfirmedRef.current.add(row.id);
          celebrateCoinTopup();
          toast({
            title: "🎉 Koin berhasil masuk!",
            description: `+${row.amount} Koin telah ditambahkan ke akun kamu.`,
          });
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [navigate]);

  const handleSubmitTopup = async () => {
    if (!user || !selected) return;
    setSubmitting(true);
    const code = generateCode();
    setTopupCode(code);

    await supabase.from("coin_topup_requests").insert({
      user_id: user.id,
      amount: selected.coins,
      total_price: selected.price,
      topup_code: code,
      status: "pending",
    } as any);

    setStep("done");
    setSubmitting(false);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(topupCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card/50">
        <button onClick={() => navigate("/catalog")} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold text-foreground">Top Up Koin</h1>
        <div className="ml-auto flex items-center gap-1.5 bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-sm font-medium">
          <Coins size={14} /> {coins.toLocaleString("id-ID")}
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {step === "select" && (
          <>
            <p className="text-sm text-muted-foreground text-center">Pilih paket koin yang ingin kamu beli. 1 Koin = Rp 2.500</p>
            <div className="grid grid-cols-3 gap-2">
              {COIN_PACKAGES.map((pkg) => (
                <button
                  key={pkg.coins}
                  onClick={() => setSelected(pkg)}
                  className={`border rounded-xl p-3 text-center transition-all ${
                    selected?.coins === pkg.coins
                      ? "border-primary bg-primary/10 ring-2 ring-primary"
                      : "border-border bg-card hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-center justify-center gap-1 text-lg font-bold text-foreground">
                    <Coins size={16} className="text-amber-500" /> {pkg.coins}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Rp {pkg.price.toLocaleString("id-ID")}
                  </div>
                </button>
              ))}
            </div>

            {selected && (
              <button
                onClick={() => setStep("pay")}
                className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-bold hover:opacity-90 transition-all"
              >
                Lanjut Bayar — Rp {selected.price.toLocaleString("id-ID")}
              </button>
            )}

            {/* History */}
            {history.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-semibold text-foreground text-sm">Riwayat Top Up</h3>
                {history.map((h) => (
                  <div key={h.id} className="bg-card border border-border rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-foreground">{h.amount} Koin — Rp {h.total_price.toLocaleString("id-ID")}</div>
                      <div className="text-xs text-muted-foreground font-mono">{h.topup_code}</div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      h.status === "confirmed" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                    }`}>
                      {h.status === "confirmed" ? "✅ Sukses" : "⏳ Pending"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {step === "pay" && selected && (
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-xl p-5 text-center space-y-3">
              <h2 className="font-bold text-foreground">Scan QRIS untuk membayar</h2>
              <p className="text-2xl font-bold text-primary">Rp {selected.price.toLocaleString("id-ID")}</p>
              <p className="text-sm text-muted-foreground">({selected.coins} Koin)</p>
              <div className="bg-white p-4 rounded-xl inline-block mx-auto">
                <img src="/qris.jpg" alt="QRIS" className="w-56 h-56 object-contain" />
              </div>
              <p className="text-xs text-muted-foreground">
                Setelah transfer, tekan tombol di bawah untuk mendapatkan kode konfirmasi.
              </p>
            </div>

            <button
              onClick={handleSubmitTopup}
              disabled={submitting}
              className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-bold hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? "Memproses..." : "Sudah Bayar, Dapatkan Kode"}
            </button>

            <button onClick={() => setStep("select")} className="w-full text-muted-foreground text-sm hover:text-foreground">
              ← Kembali pilih paket
            </button>
          </div>
        )}

        {step === "done" && (
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-xl p-6 text-center space-y-4">
              <div className="text-4xl">✅</div>
              <h2 className="font-bold text-foreground text-lg">Kode Top Up Kamu</h2>
              <div className="bg-secondary rounded-xl p-4 flex items-center justify-center gap-3">
                <span className="text-2xl font-mono font-bold text-foreground">{topupCode}</span>
                <button onClick={handleCopyCode} className="text-primary">
                  {copied ? <Check size={20} /> : <Copy size={20} />}
                </button>
              </div>
              <p className="text-sm text-muted-foreground">
                Kirimkan kode ini ke admin melalui WhatsApp untuk konfirmasi. Setelah dikonfirmasi, koin otomatis masuk ke akun kamu.
              </p>
              <div className="flex items-center justify-center gap-1.5 text-amber-600 text-sm">
                <Clock size={14} /> Menunggu konfirmasi admin...
              </div>

              <a
                href={`https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(`Halo admin, saya sudah top up koin.\nKode: ${topupCode}\nJumlah: ${selected?.coins} Koin (Rp ${selected?.price.toLocaleString("id-ID")})\nMohon konfirmasi 🙏`)}`}
                target="_blank" rel="noreferrer"
                className="w-full bg-green-500 text-white py-3 rounded-xl font-bold hover:opacity-90 flex items-center justify-center gap-2"
              >
                <MessageCircle size={18} /> Hubungi Admin
              </a>
            </div>

            <button
              onClick={() => { setStep("select"); setSelected(null); }}
              className="w-full border border-border text-foreground py-2.5 rounded-xl text-sm font-medium hover:bg-secondary"
            >
              Top Up Lagi
            </button>
            <button
              onClick={() => navigate("/catalog")}
              className="w-full text-muted-foreground text-sm hover:text-foreground"
            >
              ← Kembali ke Katalog
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default TopUpPage;
