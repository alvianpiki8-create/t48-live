import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Maximize2, Minimize2, Settings2, Volume2, VolumeX, Play } from "lucide-react";
import Hls from "hls.js";
import { extractYouTubeVideoId } from "@/lib/youtube";

interface LivePlayerProps {
  videoId: string;
  watermarkText?: string;
  sourceType?: "youtube" | "m3u8" | "auto";
  sourceUrl?: string;
  sourceUrl2?: string;
}

const POSITIONS = [
  { top: "8px", left: "8px", right: "auto", bottom: "auto" },
  { top: "8px", right: "8px", left: "auto", bottom: "auto" },
  { bottom: "60px", left: "8px", top: "auto", right: "auto" },
  { bottom: "60px", right: "8px", top: "auto", left: "auto" },
  { top: "50%", left: "50%", right: "auto", bottom: "auto", transform: "translate(-50%, -50%)" },
  { top: "8px", left: "50%", right: "auto", bottom: "auto", transform: "translateX(-50%)" },
  { top: "50%", left: "8px", right: "auto", bottom: "auto", transform: "translateY(-50%)" },
  { top: "50%", right: "8px", left: "auto", bottom: "auto", transform: "translateY(-50%)" },
];

const QUALITY_OPTIONS = [
  { label: "Auto", value: "" },
  { label: "1080p", value: "hd1080" },
  { label: "720p", value: "hd720" },
  { label: "480p", value: "large" },
  { label: "360p", value: "medium" },
];

const detectSource = (url: string, videoId: string): { type: "youtube" | "m3u8"; src: string } => {
  const target = (url || "").trim();
  if (target && (/\.m3u8(\?|$)/i.test(target) || /m3u8/i.test(target))) return { type: "m3u8", src: target };
  if (target && /^https?:\/\//i.test(target) && !/youtube|youtu\.be/i.test(target)) return { type: "m3u8", src: target };
  return { type: "youtube", src: extractYouTubeVideoId(target) || videoId };
};

const LivePlayer = ({ videoId, watermarkText = "@t48id", sourceUrl = "", sourceUrl2 = "" }: LivePlayerProps) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [wmIndex, setWmIndex] = useState(0);
  const [showQuality, setShowQuality] = useState(false);
  const [quality, setQuality] = useState("");
  const [useFallback, setUseFallback] = useState(false);
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(0.7);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const hideTimerRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => {
      setControlsVisible(false);
      setShowQuality(false);
    }, 3000);
  }, []);

  useEffect(() => () => { if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current); }, []);

  const activeSource = useMemo(() => {
    const primary = (sourceUrl || "").trim();
    const fallback = (sourceUrl2 || "").trim();
    if (useFallback && fallback) return fallback;
    if (primary) return primary;
    return fallback;
  }, [sourceUrl, sourceUrl2, useFallback]);

  useEffect(() => { setUseFallback(false); }, [sourceUrl, sourceUrl2]);

  const detected = useMemo(() => detectSource(activeSource, videoId.trim()), [activeSource, videoId]);
  const hasVideo = Boolean(detected.src);
  const serverOptions = useMemo(() => {
    const primary = (sourceUrl || "").trim();
    const fallback = (sourceUrl2 || "").trim();
    const options = [
      primary && { label: detectSource(primary, videoId.trim()).type === "youtube" ? "Server 1 · YouTube" : "Server 1 · M3U8", fallback: false },
      fallback && { label: detectSource(fallback, videoId.trim()).type === "youtube" ? "Server 2 · YouTube" : "Server 2 · M3U8", fallback: true },
    ].filter(Boolean) as { label: string; fallback: boolean }[];
    return options.length > 1 ? options : [];
  }, [sourceUrl, sourceUrl2, videoId]);

  // Watermark mover
  useEffect(() => {
    const interval = setInterval(() => {
      setWmIndex((prev) => {
        let next: number;
        do { next = Math.floor(Math.random() * POSITIONS.length); } while (next === prev);
        return next;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Fullscreen tracking
  useEffect(() => {
    const handler = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // HLS setup with fallback
  useEffect(() => {
    if (detected.type !== "m3u8" || !videoRef.current || !detected.src) return;
    const video = videoRef.current;
    const fallback = (sourceUrl2 || "").trim();

    const tryFallback = () => {
      if (!useFallback && fallback && fallback !== detected.src) setUseFallback(true);
    };

    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true });
      hls.loadSource(detected.src);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (_e, data) => { if (data.fatal) tryFallback(); });
      return () => { hls.destroy(); };
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = detected.src;
      video.onerror = tryFallback;
    }
  }, [detected, sourceUrl2, useFallback]);

  // Sync volume/mute to video element
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = muted;
      videoRef.current.volume = volume;
    }
  }, [muted, volume, detected.type]);

  // Send YouTube postMessage commands for volume/mute
  const sendYT = useCallback((func: string, args: any[] = []) => {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func, args }),
      "*"
    );
  }, []);

  useEffect(() => {
    if (detected.type !== "youtube") return;
    const t = setTimeout(() => {
      if (muted) sendYT("mute");
      else { sendYT("unMute"); sendYT("setVolume", [Math.round(volume * 100)]); }
    }, 800);
    return () => clearTimeout(t);
  }, [muted, volume, detected, sendYT]);

  // Keep playing when tab hidden / page blur (so audio continues in background)
  useEffect(() => {
    const keepAlive = () => {
      if (videoRef.current && videoRef.current.paused) videoRef.current.play().catch(() => {});
      if (detected.type === "youtube") sendYT("playVideo");
    };
    const onVis = () => keepAlive();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", keepAlive);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", keepAlive);
    };
  }, [detected, sendYT]);

  const toggleFullscreen = useCallback(() => {
    const container = document.getElementById("live-player-container");
    if (!container) return;
    if (!document.fullscreenElement) container.requestFullscreen();
    else document.exitFullscreen();
  }, []);

  const embedUrl = useMemo(() => {
    if (detected.type !== "youtube" || !detected.src) return "";
    const params = new URLSearchParams({
      autoplay: "1", mute: "1", rel: "0", modestbranding: "1", playsinline: "1",
      controls: "0", disablekb: "1", fs: "0", iv_load_policy: "3",
      showinfo: "0", cc_load_policy: "0", enablejsapi: "1",
      origin: window.location.origin,
    });
    if (quality) params.set("vq", quality);
    return `https://www.youtube-nocookie.com/embed/${detected.src}?${params.toString()}`;
  }, [detected, quality]);

  const wmPos = POSITIONS[wmIndex];
  const VolIcon = muted || volume === 0 ? VolumeX : Volume2;

  return (
    <div className="space-y-2">
      <div
        id="live-player-container"
        className="relative w-full bg-primary-foreground rounded-lg overflow-hidden group"
        style={{ aspectRatio: "16/9" }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {hasVideo ? (
        <>
          {!hasStarted && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setHasStarted(true);
                setMuted(false);
                if (videoRef.current) {
                  videoRef.current.muted = false;
                  videoRef.current.play().catch(() => {});
                }
                if (detected.type === "youtube") {
                  sendYT("playVideo");
                  sendYT("unMute");
                  sendYT("setVolume", [Math.round(volume * 100)]);
                }
                showControls();
              }}
              className="absolute inset-0 z-40 flex items-center justify-center bg-background/60 backdrop-blur-sm group/play"
              aria-label="Mulai siaran"
            >
              <div className="w-20 h-20 rounded-full bg-primary/90 flex items-center justify-center shadow-lg transition-transform group-hover/play:scale-110 group-active/play:scale-95">
                <Play size={36} className="text-primary-foreground ml-1" fill="currentColor" />
              </div>
              <span className="absolute bottom-6 text-foreground/80 text-sm font-medium">Tap untuk memulai</span>
            </button>
          )}
          {detected.type === "youtube" ? (
            <iframe
              ref={iframeRef}
              key={embedUrl}
              src={embedUrl}
              title="Live stream"
              className="absolute inset-0 h-full w-full pointer-events-none"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              referrerPolicy="strict-origin-when-cross-origin"
              sandbox="allow-scripts allow-same-origin allow-presentation"
            />
          ) : (
            <video
              ref={videoRef}
              className="absolute inset-0 h-full w-full bg-black pointer-events-none"
              autoPlay
              playsInline
              muted={muted}
              controlsList="nodownload noremoteplayback"
              disablePictureInPicture
            />
          )}

          {/* FULL CLICK BLOCKER + tap-to-show-controls */}
          <div
            className="absolute inset-0 z-20"
            onContextMenu={(e) => e.preventDefault()}
            onClick={(e) => { e.preventDefault(); showControls(); }}
            onDoubleClick={(e) => e.preventDefault()}
            style={{ cursor: "pointer" }}
          />

          {/* Top bar: Volume + LIVE badge — only when controls visible */}
          {controlsVisible && (
          <div
            className="absolute top-0 left-0 right-0 z-30 flex items-center gap-2 p-3 bg-gradient-to-b from-background/70 to-transparent transition-opacity duration-300 animate-fade-in"
            onClick={showControls}
          >
            <button
              onClick={(e) => { e.stopPropagation(); setMuted((m) => !m); showControls(); }}
              className="p-2 rounded-full bg-background/40 hover:bg-background/60 backdrop-blur-sm text-foreground transition-colors"
              type="button"
              title={muted ? "Suara aktif" : "Bisukan"}
            >
              <VolIcon size={16} />
            </button>
            <span className="text-foreground/80 text-xs font-medium">
              {muted ? "Suara mati" : "Suara aktif"}
            </span>
            <div className="ml-auto flex items-center gap-1.5 bg-live px-2.5 py-1 rounded-md">
              <div className="w-2 h-2 bg-primary rounded-full" style={{ animation: "pulse-live 1.5s infinite" }} />
              <span className="text-primary text-xs font-semibold tracking-wider">LIVE</span>
            </div>
          </div>
          )}
          <div className={`absolute bottom-3 right-3 z-30 flex gap-2 transition-opacity duration-300 ${controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
            {detected.type === "youtube" && (
              <div className="relative">
                <button onClick={(e) => { e.stopPropagation(); setShowQuality((v) => !v); showControls(); }} className="p-2 rounded-md bg-secondary/80 hover:bg-secondary text-foreground transition-colors" type="button">
                  <Settings2 size={18} />
                </button>
                {showQuality && (
                  <div className="absolute bottom-full right-0 mb-2 bg-card border border-border rounded-lg shadow-lg overflow-hidden min-w-[120px]">
                    {QUALITY_OPTIONS.map((q) => (
                      <button key={q.value} onClick={(e) => { e.stopPropagation(); setQuality(q.value); setShowQuality(false); showControls(); }}
                        className={`w-full px-3 py-2 text-xs text-left transition-colors ${quality === q.value ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-secondary"}`}>
                        {q.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <button onClick={(e) => { e.stopPropagation(); toggleFullscreen(); showControls(); }} className="p-2 rounded-md bg-secondary/80 hover:bg-secondary text-foreground transition-colors" type="button">
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
          </div>

          {/* Watermark — always visible (anti-restream) */}
          <div className="absolute z-30 text-foreground/30 text-xs font-mono pointer-events-none transition-all duration-700 ease-in-out select-none"
            style={{ top: wmPos.top, left: wmPos.left, right: wmPos.right, bottom: wmPos.bottom, transform: wmPos.transform || "none" }}>
            {watermarkText}
          </div>
        </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-muted-foreground text-lg">Stream Offline</div>
              <div className="text-muted-foreground/50 text-sm mt-1">Menunggu siaran dimulai...</div>
            </div>
          </div>
        )}
      </div>
      {serverOptions.length > 0 && (
        <div className="rounded-xl border border-primary/30 bg-card/60 backdrop-blur-sm p-3 space-y-2 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-xs font-semibold text-foreground">Pilih Server</span>
            </div>
            <span className="text-[10px] text-muted-foreground">Lag? Ganti server di sini</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {serverOptions.map((server) => {
              const active = useFallback === server.fallback;
              return (
                <button
                  key={server.label}
                  type="button"
                  onClick={() => { setUseFallback(server.fallback); setHasStarted(false); }}
                  className={`relative rounded-lg border px-3 py-2.5 text-xs font-bold transition-all ${active ? "border-primary bg-primary text-primary-foreground shadow-md" : "border-border bg-secondary/40 text-foreground hover:bg-secondary hover:border-primary/50"}`}
                >
                  {active && <span className="absolute top-1 right-1 text-[9px] bg-primary-foreground/20 px-1 rounded">AKTIF</span>}
                  {server.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default LivePlayer;
