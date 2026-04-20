import { useState } from "react";

interface NicknameModalProps {
  onSubmit: (nickname: string) => void;
}

const NicknameModal = ({ onSubmit }: NicknameModalProps) => {
  const [name, setName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length >= 2 && trimmed.length <= 20) {
      onSubmit(trimmed);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-xl p-8 w-full max-w-sm mx-4" style={{ animation: "fade-in 0.3s ease-out" }}>
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">TEAM Live</h1>
          <p className="text-muted-foreground text-sm mt-2">Masukkan nama panggilan untuk bergabung</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nama panggilan..."
            maxLength={20}
            className="w-full bg-input border border-border rounded-lg px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
            autoFocus
          />
          <button
            type="submit"
            disabled={name.trim().length < 2}
            className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-semibold transition-all hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Masuk
          </button>
        </form>
        <p className="text-center text-muted-foreground/50 text-xs mt-4 font-mono">@t48id</p>
      </div>
    </div>
  );
};

export default NicknameModal;
