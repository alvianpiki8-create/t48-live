import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Coins, Copy, Crown, ExternalLink, Play, Sparkles, Zap } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { celebrateShowPurchase } from "@/lib/celebration";

interface Profile {
  user_code: string;
  nickname: string;
  coins: number;
}

interface MembershipPlan {
  id: string;
  name: string;
  type: "weekly" | "monthly" | string;
  price: number;
  description: string | null;
  is_active: boolean;
}

interface ActiveMembership {
  id: string;
  membership_name: string;
  membership_type: string;
  expires_at: string;
  replay_url: string | null;
  replay_password: string | null;
}

interface CatalogMembershipSectionProps {
  user: User | null;
  profile: Profile | null;
  onCoinsChange: (coins: number) => void;
}

const getBenefits = (type: string) => {
  const isMonthly = type === "monthly";
  return [
    `Akses livestreaming ${isMonthly ? "30" : "7"} hari`,
    `Hemat uang hingga ${isMonthly ? "70" : "78"}% daripada beli satuan`,
    "Mendapatkan akses replay",
  ];
};

const CatalogMembershipSection = ({ user, profile, onCoinsChange }: CatalogMembershipSectionProps) => {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [activeMembership, setActiveMembership] = useState<ActiveMembership | null>(null);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchPlans = useCallback(async () => {
    const { data } = await supabase.from("memberships").select("*").eq("is_active", true).order("price", { ascending: true });
    setPlans((data || []) as MembershipPlan[]);
  }, []);

  const fetchActiveMembership = useCallback(async () => {
    if (!user) return;
    const { data } = await (supabase as any)
      .from("user_memberships")
      .select("id,membership_name,membership_type,expires_at,replay_url,replay_password")
      .eq("user_id", user.id)
      .gt("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setActiveMembership((data as ActiveMembership) || null);
  }, [user]);

  useEffect(() => {
    fetchPlans();
    fetchActiveMembership();
    const channel = supabase.channel("catalog_membership_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "memberships" }, () => fetchPlans())
      .on("postgres_changes", { event: "*", schema: "public", table: "user_memberships" }, () => fetchActiveMembership())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchPlans, fetchActiveMembership]);

  const buyMembership = async (plan: MembershipPlan) => {
    if (!user || !profile) { navigate("/auth"); return; }
    if (profile.coins < plan.price) return;
    setBuyingId(plan.id);
    const { data, error } = await supabase.functions.invoke("purchase-membership", { body: { membershipId: plan.id } });
    setBuyingId(null);
    if (error || !(data as any)?.ok) {
      alert((data as any)?.error || error?.message || "Gagal membeli membership");
      return;
    }
    onCoinsChange((data as any).coins);
    await fetchActiveMembership();
    celebrateShowPurchase();
  };

  const copyReplayCode = async () => {
    if (!activeMembership?.replay_password) return;
    await navigator.clipboard.writeText(activeMembership.replay_password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="rounded-2xl border border-border bg-card/95 p-4 shadow-sm space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Crown size={14} /> Membership
          </div>
          <h2 className="mt-2 text-xl font-bold text-card-foreground">Akses live lebih hemat</h2>
          <p className="text-sm text-muted-foreground">Pilih paket, bayar pakai koin, langsung buka livestreaming.</p>
        </div>
        <button onClick={() => navigate("/trial-live")} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground hover:bg-accent transition-colors">
          <Play size={14} /> Tester 3 menit
        </button>
      </div>

      {activeMembership && (
        <div className="rounded-xl border border-primary/30 bg-primary/10 p-3 space-y-3 animate-fade-in">
          <div className="flex items-center gap-2 text-primary font-bold text-sm"><Sparkles size={16} /> Membership aktif</div>
          <p className="text-xs text-muted-foreground">Berlaku sampai {new Date(activeMembership.expires_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>
          <button onClick={() => navigate("/membership-live")} className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground hover:opacity-90 transition-opacity">▶️ Masuk Livestreaming</button>
          <div className="rounded-xl bg-background/60 border border-border p-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Kode Replay Membership</p>
            <div className="flex gap-2">
              <code className="flex-1 rounded-lg bg-input px-3 py-2 text-sm font-mono text-foreground">{activeMembership.replay_password || "Belum diatur"}</code>
              <button onClick={copyReplayCode} disabled={!activeMembership.replay_password} className="rounded-lg bg-secondary px-3 text-secondary-foreground disabled:opacity-50">
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
            <a href={activeMembership.replay_url || "https://t48.lovable.app/replay"} target="_blank" rel="noreferrer" className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border py-2 text-xs font-semibold text-foreground hover:bg-accent transition-colors">
              Buka Website Replay <ExternalLink size={13} />
            </a>
          </div>
        </div>
      )}

      <div className="grid gap-3">
        {plans.map((plan) => {
          const insufficient = Boolean(profile && profile.coins < plan.price);
          return (
            <article key={plan.id} className="rounded-xl border border-border bg-background/60 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-foreground">{plan.name}</h3>
                  <p className="text-xs text-muted-foreground">{plan.type === "monthly" ? "Bulanan" : "Mingguan"}</p>
                </div>
                <div className="text-right">
                  <div className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-sm font-bold text-primary"><Coins size={14} /> {plan.price}</div>
                  <p className="mt-1 text-[10px] text-muted-foreground">koin</p>
                </div>
              </div>
              <ul className="grid gap-2">
                {getBenefits(plan.type).map((benefit) => <li key={benefit} className="flex items-center gap-2 text-xs text-muted-foreground"><Check size={14} className="text-primary" /> {benefit}</li>)}
              </ul>
              {plan.description && <p className="text-xs text-muted-foreground">{plan.description}</p>}
              <button onClick={() => buyMembership(plan)} disabled={buyingId === plan.id || insufficient} className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                <Zap size={15} /> {buyingId === plan.id ? "Memproses..." : insufficient ? "Koin tidak cukup" : "Beli & Tonton Sekarang"}
              </button>
            </article>
          );
        })}
        {plans.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">Paket membership belum tersedia.</p>}
      </div>
    </section>
  );
};

export default CatalogMembershipSection;