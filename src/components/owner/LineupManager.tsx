import { useState, useMemo } from "react";
import { Users, Check, Search, Save } from "lucide-react";
import { JKT48_MEMBERS, JKT48Member } from "@/lib/jkt48Members";
import { supabase } from "@/integrations/supabase/client";

interface LineupManagerProps {
  selectedNames: string[];
  streamSettingsId: string | null;
  onRefresh: () => void;
}

const LineupManager = ({ selectedNames, streamSettingsId, onRefresh }: LineupManagerProps) => {
  const [selected, setSelected] = useState<string[]>(selectedNames);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const gens = useMemo(() => {
    const map = new Map<string, JKT48Member[]>();
    JKT48_MEMBERS.forEach((m) => {
      if (!map.has(m.gen)) map.set(m.gen, []);
      map.get(m.gen)!.push(m);
    });
    return Array.from(map.entries());
  }, []);

  const filteredGens = useMemo(() => {
    if (!search.trim()) return gens;
    const q = search.toLowerCase();
    return gens
      .map(([gen, members]) => [gen, members.filter((m) => m.name.toLowerCase().includes(q))] as [string, JKT48Member[]])
      .filter(([, members]) => members.length > 0);
  }, [gens, search]);

  const toggle = (name: string) => {
    setSelected((prev) => prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]);
    setSaved(false);
  };

  const handleSave = async () => {
    if (!streamSettingsId) return;
    setSaving(true);
    const lineup = selected.map((name) => {
      const member = JKT48_MEMBERS.find((m) => m.name === name);
      return member ? { name: member.name, gen: member.gen, photo: member.photo } : null;
    }).filter(Boolean);
    await supabase.from("stream_settings").update({ lineup, updated_at: new Date().toISOString() } as any).eq("id", streamSettingsId);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onRefresh();
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-primary" />
          <h2 className="font-semibold text-foreground">Line Up</h2>
        </div>
        <span className="text-xs text-muted-foreground font-mono">{selected.length} dipilih</span>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari member..."
          className="w-full bg-input border border-border rounded-lg pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      <div className="max-h-[400px] overflow-y-auto space-y-4 pr-1">
        {filteredGens.map(([gen, members]) => (
          <div key={gen}>
            <div className="text-xs text-muted-foreground font-semibold mb-2 sticky top-0 bg-card py-1">{gen}</div>
            <div className="grid grid-cols-4 gap-2">
              {members.map((member) => {
                const isSelected = selected.includes(member.name);
                return (
                  <button
                    key={member.name}
                    onClick={() => toggle(member.name)}
                    className={`relative rounded-lg overflow-hidden border-2 transition-all ${isSelected ? "border-primary ring-1 ring-primary" : "border-transparent hover:border-border"}`}
                  >
                    <img src={member.photo} alt={member.name} className="w-full aspect-[3/4] object-cover" loading="lazy" />
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-1">
                      <span className="text-[10px] text-white font-medium leading-tight block truncate">{member.name}</span>
                    </div>
                    {isSelected && (
                      <div className="absolute top-1 right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                        <Check size={12} className="text-primary-foreground" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg font-semibold hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
      >
        <Save size={16} />
        {saving ? "Menyimpan..." : saved ? "Tersimpan ✓" : "Simpan Line Up"}
      </button>
    </div>
  );
};

export default LineupManager;
