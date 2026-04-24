import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type EffectType = "rain" | "snow" | "leaves" | "money" | "emoji" | "none";

const EMOJIS = ["✨", "💖", "⭐", "🎉", "🌸", "💫", "🔥", "🎊"];
const LEAVES = ["🍃", "🍂", "🍁"];
const MONEY = ["💵", "💴", "💶", "💷", "💰"];

interface Particle {
  id: number;
  left: string;
  size: number;
  duration: string;
  delay: string;
  opacity: number;
  drift: number;
  symbol?: string;
  rotate: number;
}

const RainEffect = () => {
  const [effect, setEffect] = useState<EffectType>("rain");

  useEffect(() => {
    const apply = (data: any) => {
      const e = (data?.background_effect as EffectType) || "rain";
      setEffect(e);
    };
    supabase.from("stream_settings").select("background_effect").order("updated_at", { ascending: false }).limit(1).maybeSingle().then(({ data }) => apply(data));
    const ch = supabase.channel("bg_effect_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "stream_settings" }, (p) => apply(p.new))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const count = effect === "rain" ? 80 : effect === "snow" ? 60 : 30;

  const particles = useMemo<Particle[]>(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      size: effect === "rain" ? Math.random() * 15 + 10 : Math.random() * 14 + 14,
      duration: `${Math.random() * (effect === "rain" ? 1.5 : 6) + (effect === "rain" ? 0.8 : 5)}s`,
      delay: `${Math.random() * 5}s`,
      opacity: Math.random() * 0.5 + 0.3,
      drift: (Math.random() - 0.5) * 60,
      rotate: Math.random() * 360,
      symbol:
        effect === "emoji" ? EMOJIS[Math.floor(Math.random() * EMOJIS.length)] :
        effect === "leaves" ? LEAVES[Math.floor(Math.random() * LEAVES.length)] :
        effect === "money" ? MONEY[Math.floor(Math.random() * MONEY.length)] :
        effect === "snow" ? "❄" : undefined,
    }));
  }, [effect, count]);

  if (effect === "none") return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[1] overflow-hidden">
      {particles.map((p) => {
        if (effect === "rain") {
          return (
            <div key={p.id} className="rain-drop"
              style={{ left: p.left, height: `${p.size}px`, animationDuration: p.duration, animationDelay: p.delay, opacity: p.opacity }} />
          );
        }
        return (
          <div key={p.id}
            className="absolute select-none"
            style={{
              left: p.left,
              top: "-10vh",
              fontSize: `${p.size}px`,
              opacity: p.opacity,
              animation: `particle-fall ${p.duration} linear ${p.delay} infinite`,
              ["--drift" as any]: `${p.drift}px`,
              ["--rotate" as any]: `${p.rotate}deg`,
            }}
          >
            {p.symbol}
          </div>
        );
      })}
    </div>
  );
};

export default RainEffect;
