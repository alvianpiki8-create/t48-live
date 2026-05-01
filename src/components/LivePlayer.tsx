import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Maximize2, Minimize2, Settings2, Volume2, VolumeX, Play, Youtube, Tv } from "lucide-react";
import Hls from "hls.js";
import { extractYouTubeVideoId } from "@/lib/youtube";
import { supabase } from "@/integrations/supabase/client";

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

const YT_QUALITY = [
  { label: "Auto", value: "" },
  { label: "1080p", value: "hd1080" },
  { label: "720p", value: "hd720" },
  { label: "480p", value: "large" },
  { label: "360p", value: "medium" },
];

type ServerKind = "youtube" | "m3u8";
interface ServerOption {
  id: string;
  kind: ServerKind;
  src: string; // youtube id or m3u8 url
  label: string;
}

const isM3u8 = (url: string) => {
  const t = (url || "").trim();
  if (!t) return false;
  if (/\.m3u8(\?|$)/i.test(t)) return true;
  if (/m3u8/i.test(t)) return true;
  if (/^https?:\/\//i.test(t) && !/youtube\.com|youtu\.be/i.test(t)) return true;
  return false;
};

const buildServers = (videoId: string, sourceUrl: string, sourceUrl2: string): ServerOption[] => {
  const list: ServerOption[] = [];
  let ytCount = 0;
  let m3uCount = 0;

  const addUrl = (raw: string) => {
    const url = (raw || "").trim();
    if (!url) return;
    if (isM3u8(url)) {
      m3uCount += 1;
      list.push({
        id: `idn-${list.length}`,
        kind: "m3u8",
        src: url,
        label: m3uCount > 1 ? `IDN ${m3uCount}` : "IDN",
      });
    } else {
      const id = extractYouTubeVideoId(url);
      if (id) {
        ytCount += 1;
        list.push({
          id: `yt-${list.length}`,
          kind: "youtube",
          src: id,
          label: ytCount > 1 ? `YouTube ${ytCount}` : "YouTube",
        });
      }
    }
  };

  // Built-in YouTube videoId first (canonical Server YouTube)
  const ytId = extractYouTubeVideoId((videoId || "").trim());
  if (ytId) {
    ytCount += 1;
    list.push({ id: `yt-main`, kind: "youtube", src: ytId, label: "YouTube" });
  }

  addUrl(sourceUrl);
  addUrl(sourceUrl2);

  // Deduplicate by src
  const seen = new Set<string>();
  return list.filter((s) => {
    const key = `${s.kind}:${s.src}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const LivePlayer = ({ videoId, watermarkText = "@t48id", sourceUrl = "", sourceUrl2 = "" }: LivePlayerProps) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [wmIndex, setWmIndex] = useState(0);
  const [showQuality, setShowQuality] = useState(false);
  const [ytQuality, setYtQuality] = useState("");
  const [hlsLevel, setHlsLevel] = useState<number>(-1); // -1 auto
  const [hlsLevels, setHlsLevels] = useState<{ index: number; height: number }[]>([]);
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(0.7);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [activeServerId, setActiveServerId] = useState<string>("");
  const hideTimerRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const servers = useMemo(() => buildServers(videoId, sourceUrl, sourceUrl2), [videoId, sourceUrl, sourceUrl2]);

  // Pick default server (prefer YouTube if exists, else first)
  useEffect(() => {
    if (!servers.length) {
      setActiveServerId("");
      return;
    }
    if (!servers.some((s) => s.id === activeServerId)) {
      const yt = servers.find((s) => s.kind === "youtube");
      setActiveServerId((yt || servers[0]).id);
    }
  }, [servers, activeServerId]);

  const activeServer = useMemo(() => servers.find((s) => s.id === activeServerId) || null, [servers, activeServerId]);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => {
      setControlsVisible(false);
      setShowQuality(false);
    }, 3000);
  }, []);

  useEffect(() => () => { if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current); }, []);

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

  // HLS setup for active m3u8 server
  useEffect(() => {
    if (!activeServer || activeServer.kind !== "m3u8" || !videoRef.current) {
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
      setHlsLevels([]);
      setHlsLevel(-1);
      return;
    }
    const video = videoRef.current;
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }

    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
      hlsRef.current = hls;
      hls.loadSource(activeServer.src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        const levels = hls.levels.map((l, i) => ({ index: i, height: l.height || 0 }))
          .filter((l) => l.height > 0)
          .sort((a, b) => b.height - a.height);
        setHlsLevels(levels);
        setHlsLevel(-1);
        hls.currentLevel = -1;
      });
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) {
          // try recover
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
          else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
        }
      });
      return () => { hls.destroy(); hlsRef.current = null; };
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = activeServer.src;
      setHlsLevels([]);
    }
  }, [activeServer]);

  // Sync volume/mute to video element
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = muted;
      videoRef.current.volume = volume;
    }
  }, [muted, volume, activeServer?.kind]);

  const sendYT = useCallback((func: string, args: any[] = []) => {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func, args }),
      "*"
    );
  }, []);

  useEffect(() => {
    if (!activeServer || activeServer.kind !== "youtube") return;
    const t = setTimeout(() => {
      if (muted) sendYT("mute");
      else { sendYT("unMute"); sendYT("setVolume", [Math.round(volume * 100)]); }
    }, 800);
    return () => clearTimeout(t);
  }, [muted, volume, activeServer, sendYT]);

  // Keep playing when tab hidden / page blur
  useEffect(() => {
    const keepAlive = () => {
      if (videoRef.current && videoRef.current.paused) videoRef.current.play().catch(() => {});
      if (activeServer?.kind === "youtube") sendYT("playVideo");
    };
    document.addEventListener("visibilitychange", keepAlive);
    window.addEventListener("blur", keepAlive);
    return () => {
      document.removeEventListener("visibilitychange", keepAlive);
      window.removeEventListener("blur", keepAlive);
    };
  }, [activeServer, sendYT]);

  const toggleFullscreen = useCallback(() => {
    const container = document.getElementById("live-player-container");
    if (!container) return;
    if (!document.fullscreenElement) container.requestFullscreen();
    else document.exitFullscreen();
  }, []);

  const embedUrl = useMemo(() => {
    if (!activeServer || activeServer.kind !== "youtube") return "";
    const params = new URLSearchParams({
      autoplay: "1", mute: "1", rel: "0", modestbranding: "1", playsinline: "1",
      controls: "0", disablekb: "1", fs: "0", iv_load_policy: "3",
      showinfo: "0", cc_load_policy: "0", enablejsapi: "1",
      origin: window.location.origin,
    });
    if (ytQuality) params.set("vq", ytQuality);
    return `https://www.youtube-nocookie.com/embed/${activeServer.src}?${params.toString()}`;
  }, [activeServer, ytQuality]);

  const switchServer = (id: string) => {
    if (id === activeServerId) return;
    setActiveServerId(id);
    setShowQuality(false);
    // smooth: keep started state — auto play after switch
  };

  const setHlsQuality = (level: number) => {
    setHlsLevel(level);
    if (hlsRef.current) hlsRef.current.currentLevel = level;
    setShowQuality(false);
    showControls();
  };

  const wmPos = POSITIONS[wmIndex];
  const VolIcon = muted || volume === 0 ? VolumeX : Volume2;
  const hasVideo = Boolean(activeServer);

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
                if (activeServer?.kind === "youtube") {
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
          {activeServer?.kind === "youtube" ? (
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

          <div
            className="absolute inset-0 z-20"
            onContextMenu={(e) => e.preventDefault()}
            onClick={(e) => { e.preventDefault(); showControls(); }}
            onDoubleClick={(e) => e.preventDefault()}
            style={{ cursor: "pointer" }}
          />

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
            {(activeServer?.kind === "youtube" || (activeServer?.kind === "m3u8" && hlsLevels.length > 0)) && (
              <div className="relative">
                <button onClick={(e) => { e.stopPropagation(); setShowQuality((v) => !v); showControls(); }} className="p-2 rounded-md bg-secondary/80 hover:bg-secondary text-foreground transition-colors" type="button">
                  <Settings2 size={18} />
                </button>
                {showQuality && activeServer?.kind === "youtube" && (
                  <div className="absolute bottom-full right-0 mb-2 bg-card border border-border rounded-lg shadow-lg overflow-hidden min-w-[120px]">
                    {YT_QUALITY.map((q) => (
                      <button key={q.value} onClick={(e) => { e.stopPropagation(); setYtQuality(q.value); setShowQuality(false); showControls(); }}
                        className={`w-full px-3 py-2 text-xs text-left transition-colors ${ytQuality === q.value ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-secondary"}`}>
                        {q.label}
                      </button>
                    ))}
                  </div>
                )}
                {showQuality && activeServer?.kind === "m3u8" && hlsLevels.length > 0 && (
                  <div className="absolute bottom-full right-0 mb-2 bg-card border border-border rounded-lg shadow-lg overflow-hidden min-w-[120px]">
                    <button onClick={(e) => { e.stopPropagation(); setHlsQuality(-1); }}
                      className={`w-full px-3 py-2 text-xs text-left transition-colors ${hlsLevel === -1 ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-secondary"}`}>
                      Auto
                    </button>
                    {hlsLevels.map((lv) => (
                      <button key={lv.index} onClick={(e) => { e.stopPropagation(); setHlsQuality(lv.index); }}
                        className={`w-full px-3 py-2 text-xs text-left transition-colors ${hlsLevel === lv.index ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-secondary"}`}>
                        {lv.height}p
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

      {servers.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap px-1">
          <span className="text-[11px] font-bold tracking-widest text-muted-foreground">SERVER:</span>
          {servers.map((s) => {
            const active = s.id === activeServerId;
            const Icon = s.kind === "youtube" ? Youtube : Tv;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => switchServer(s.id)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all border ${
                  active
                    ? "bg-primary text-primary-foreground border-primary shadow-md scale-105"
                    : "bg-card/60 text-foreground border-border hover:border-primary/60 hover:bg-card"
                }`}
              >
                <Icon size={14} />
                {s.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LivePlayer;
