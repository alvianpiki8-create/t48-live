import { useState, useEffect } from "react";

interface CountdownOverlayProps {
  targetDatetime: string;
  onComplete: () => void;
  backgroundImage?: string;
}

const CountdownOverlay = ({ targetDatetime, onComplete, backgroundImage }: CountdownOverlayProps) => {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const target = new Date(targetDatetime).getTime();

    const update = () => {
      const now = Date.now();
      const diff = target - now;

      if (diff <= 0) {
        setIsExpired(true);
        onComplete();
        return;
      }

      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
        seconds: Math.floor((diff / 1000) % 60),
      });
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [targetDatetime, onComplete]);

  if (isExpired) return null;

  const pad = (n: number) => n.toString().padStart(2, "0");

  return (
    <div className="absolute inset-0 flex items-center justify-center z-40 rounded-lg overflow-hidden">
      {/* Background image */}
      {backgroundImage ? (
        <>
          <img src={backgroundImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/60" />
        </>
      ) : (
        <div className="absolute inset-0 bg-background/95" />
      )}

      <div className="relative text-center space-y-4">
        <div className="text-white/70 text-sm uppercase tracking-widest font-medium">
          Siaran dimulai dalam
        </div>
        <div className="flex items-center justify-center gap-3">
          {timeLeft.days > 0 && (
            <div className="text-center">
              <div className="text-3xl md:text-5xl font-bold text-white font-mono drop-shadow-lg">{pad(timeLeft.days)}</div>
              <div className="text-[10px] text-white/60 uppercase mt-1">Hari</div>
            </div>
          )}
          {timeLeft.days > 0 && <span className="text-2xl text-white/40 font-mono">:</span>}
          <div className="text-center">
            <div className="text-3xl md:text-5xl font-bold text-white font-mono drop-shadow-lg">{pad(timeLeft.hours)}</div>
            <div className="text-[10px] text-white/60 uppercase mt-1">Jam</div>
          </div>
          <span className="text-2xl text-white/40 font-mono">:</span>
          <div className="text-center">
            <div className="text-3xl md:text-5xl font-bold text-white font-mono drop-shadow-lg">{pad(timeLeft.minutes)}</div>
            <div className="text-[10px] text-white/60 uppercase mt-1">Menit</div>
          </div>
          <span className="text-2xl text-white/40 font-mono">:</span>
          <div className="text-center">
            <div className="text-3xl md:text-5xl font-bold text-white font-mono animate-pulse drop-shadow-lg">{pad(timeLeft.seconds)}</div>
            <div className="text-[10px] text-white/60 uppercase mt-1">Detik</div>
          </div>
        </div>
        <div className="flex items-center justify-center gap-1.5">
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
          <span className="text-primary text-xs font-semibold tracking-wider">COMING SOON</span>
        </div>
      </div>
    </div>
  );
};

export default CountdownOverlay;
