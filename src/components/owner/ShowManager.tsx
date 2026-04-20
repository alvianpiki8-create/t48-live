import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Film } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export interface Show {
  id: string;
  name: string;
  created_at: string;
}

interface ShowManagerProps {
  shows: Show[];
  onRefresh: () => void;
}

const ShowManager = ({ shows, onRefresh }: ShowManagerProps) => {
  const [newShowName, setNewShowName] = useState("");

  const handleAddShow = async () => {
    if (!newShowName.trim()) return;
    await supabase.from("shows").insert({ name: newShowName.trim() });
    setNewShowName("");
    onRefresh();
  };

  const handleDeleteShow = async (id: string) => {
    await supabase.from("shows").delete().eq("id", id);
    onRefresh();
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Film size={18} className="text-primary" />
        <h2 className="font-semibold text-foreground">Manajemen Show</h2>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newShowName}
          onChange={(e) => setNewShowName(e.target.value)}
          placeholder="Nama show baru..."
          className="flex-1 bg-input border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          onKeyDown={(e) => e.key === "Enter" && handleAddShow()}
        />
        <button
          onClick={handleAddShow}
          className="bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-all flex items-center gap-1"
        >
          <Plus size={14} />
          Tambah
        </button>
      </div>

      <div className="space-y-1.5">
        {shows.map((show) => (
          <div key={show.id} className="flex items-center justify-between bg-secondary/30 rounded-lg px-3 py-2">
            <span className="text-sm text-foreground">{show.name}</span>
            <button
              onClick={() => handleDeleteShow(show.id)}
              className="p-1 rounded-md hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
        {shows.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2">Belum ada show</p>
        )}
      </div>
    </div>
  );
};

export default ShowManager;
