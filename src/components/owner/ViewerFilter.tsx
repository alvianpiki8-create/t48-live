import { useEffect, useState } from "react";
import { Users, Save } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  settings: any;
  onRefresh: () => void;
}

const ViewerFilter = ({ settings, onRefresh }: Props) => {
  const [token, setToken] = useState(true);
  const [weekly, setWeekly] = useState(true);
  const [monthly, setMonthly] = useState(true);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setToken(settings.allow_token_viewers ?? true);
    setWeekly(settings.allow_weekly_members ?? true);
    setMonthly(settings.allow_monthly_members ?? true);
  }, [settings]);

  const save = async (next: { token: boolean; weekly: boolean; monthly: boolean }) => {
    if (!settings?.id) return;
    setSaving(true);
    const { error } = await supabase
      .from("stream_settings")
      .update({
        allow_token_viewers: next.token,
        allow_weekly_members: next.weekly,
        allow_monthly_members: next.monthly,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", settings.id);
    setSaving(false);
    if (error) { alert("Gagal simpan: " + error.message); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
    onRefresh();
  };

  const Toggle = ({ label, desc, value, onChange }: any) => (
    <div className="flex items-start justify-between gap-3 py-2.5">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <Switch checked={value} onCheckedChange={(v) => onChange(v)} />
    </div>
  );

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-2">
      <div className="flex items-center gap-2 mb-2">
        <Users size={18} className="text-primary" />
        <h2 className="font-semibold text-foreground">Filter Penonton Livestream</h2>
        {saving && <span className="text-xs text-muted-foreground ml-auto">menyimpan…</span>}
        {saved && <span className="text-xs text-primary ml-auto flex items-center gap-1"><Save size={12} /> Tersimpan</span>}
      </div>
      <p className="text-xs text-muted-foreground -mt-1 mb-1">
        Matikan untuk memblokir kategori penonton tertentu dari menonton live. Bisa dinyalakan kembali kapan saja.
      </p>

      <Toggle label="Penonton Satuan (Token)" desc="Akses via link token unik (per show / harian)."
        value={token} onChange={(v: boolean) => { setToken(v); save({ token: v, weekly, monthly }); }} />
      <div className="border-t border-border" />
      <Toggle label="Membership Mingguan" desc="Member dengan paket 7 hari."
        value={weekly} onChange={(v: boolean) => { setWeekly(v); save({ token, weekly: v, monthly }); }} />
      <div className="border-t border-border" />
      <Toggle label="Membership Bulanan" desc="Member dengan paket 30 hari."
        value={monthly} onChange={(v: boolean) => { setMonthly(v); save({ token, weekly, monthly: v }); }} />
    </div>
  );
};

export default ViewerFilter;
