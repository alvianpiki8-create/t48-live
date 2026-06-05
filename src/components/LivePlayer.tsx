import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Maximize2, Minimize2, Settings2, Volume2, VolumeX, Play, Youtube, Tv } from "lucide-react";
import Hls from "hls.js";
import Artplayer from "artplayer";
import artplayerPluginHlsQuality from "artplayer-plugin-hls-quality";
import { extractYouTubeVideoId } from "@/lib/youtube";
import { supabase } from "@/integrations/supabase/client";

interface LivePlayerProps {
  videoId: string;
  watermarkText?: string;
  sourceType?: "youtube" | "m3u8" | "auto";
  sourceUrl?: string;
  sourceUrl2?: string;
}

const WM_POSITIONS = [
  { top: "6%", left: "4%" },
  { top: "6%", right: "4%" },
  { top: "50%", left: "4%" },
  { top: "50%", right: "4%" },
  { bottom: "12%", left: "4%" },
  { bottom: "12%", right: "4%" },
  { top: "30%", left: "40%" },
  { bottom: "30%", right: "30%" },
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
  src: string;
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
      list.push({ id: `idn-${list.length}`, kind: "m3u8", src: url, label: m3uCount > 1 ? `IDN ${m3uCount}` : "IDN" });
    } else {
      const id = extractYouTubeVideoId(url);
      if (id) {
        ytCount += 1;
        list.push({ id: `yt-${list.length}`, kind: "youtube", src: id, label: ytCount > 1 ? `YouTube ${ytCount}` : "YouTube" });
      }
    }
  };

  const ytId = extractYouTubeVideoId((videoId || "").trim());
  if (ytId) {
    ytCount += 1;
    list.push({ id: `yt-main`, kind: "youtube", src: ytId, label: "YouTube" });
  }

  addUrl(sourceUrl);
  addUrl(sourceUrl2);

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
  const [wmPos, setWmPos] = useState(WM_POSITIONS[0]);
  const [wmVisible, setWmVisible] = useState(false);
  const [showQuality, setShowQuality] = useState(false);
  const [ytQuality, setYtQuality] = useState("");
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(0.7);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [activeServerId, setActiveServerId] = useState<string>("");
  const hideTimerRef = useRef<number | null>(null);
  const artContainerRef = useRef<HTMLDivElement>(null);
  const artRef = useRef<Artplayer | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const servers = useMemo(() => buildServers(videoId, sourceUrl, sourceUrl2), [videoId, sourceUrl, sourceUrl2]);

  useEffect(() => {
    if (!servers.length) { setActiveServerId(""); return; }
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

  useEffect(() => {
    let cancelled = false;
    const showOnce = () => {
      if (cancelled) return;
      const next = WM_POSITIONS[Math.floor(Math.random() * WM_POSITIONS.length)];
      setWmPos(next);
      setWmVisible(true);
      window.setTimeout(() => { if (!cancelled) setWmVisible(false); }, 2000);
    };
    showOnce();
    const interval = window.setInterval(showOnce, 20000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, []);

  useEffect(() => {
    const handler = () => {
      const fs = document.fullscreenElement || (document as any).webkitFullscreenElement;
      setIsFullscreen(Boolean(fs));
    };
    document.addEventListener("fullscreenchange", handler);
    document.addEventListener("webkitfullscreenchange", handler as any);
    return () => {
      document.removeEventListener("fullscreenchange", handler);
      document.removeEventListener("webkitfullscreenchange", handler as any);
    };
  }, []);

  // ArtPlayer for m3u8 server
  useEffect(() => {
    if (!activeServer || activeServer.kind !== "m3u8" || !artContainerRef.current) {
      if (artRef.current) { artRef.current.destroy(false); artRef.current = null; }
      return;
    }
    let cancelled = false;
    const container = artContainerRef.current;

    (async () => {
      // Direct stream — no proxy. IDN server accepts M3U8 / HLS links as-is.
      const playUrl = activeServer.src;
      if (cancelled) return;

      if (artRef.current) { artRef.current.destroy(false); artRef.current = null; }

      const art = new Artplayer({
        container,
        url: playUrl,
        type: "m3u8",
        volume,
        muted,
        autoplay: true,
        playsInline: true,
        autoSize: false,
        autoMini: false,
        setting: true,
        pip: true,
        fullscreen: true,
        fullscreenWeb: true,
        miniProgressBar: true,
        mutex: true,
        backdrop: true,
        playbackRate: false,
        aspectRatio: false,
        screenshot: false,
        airplay: false,
        theme: "hsl(var(--primary))",
        moreVideoAttr: {
          crossOrigin: "anonymous",
          playsInline: true,
          controlsList: "nodownload noremoteplayback",
          disablePictureInPicture: false,
        } as any,
        customType: {
          m3u8: (video: HTMLVideoElement, url: string) => {
            if (Hls.isSupported()) {
              const hls = new Hls({
                enableWorker: true,
                lowLatencyMode: false,
                backBufferLength: 30,
                maxBufferLength: 30,
                maxMaxBufferLength: 60,
                maxBufferSize: 60 * 1000 * 1000,
                maxBufferHole: 0.5,
                liveSyncDurationCount: 4,
                liveMaxLatencyDurationCount: 10,
                liveDurationInfinity: true,
                highBufferWatchdogPeriod: 2,
                nudgeMaxRetry: 10,
                nudgeOffset: 0.2,
                manifestLoadingTimeOut: 10000,
                manifestLoadingMaxRetry: 6,
                manifestLoadingRetryDelay: 500,
                levelLoadingTimeOut: 10000,
                levelLoadingMaxRetry: 6,
                levelLoadingRetryDelay: 500,
                fragLoadingTimeOut: 20000,
                fragLoadingMaxRetry: 8,
                fragLoadingRetryDelay: 500,
                startFragPrefetch: true,
                progressive: false,
                testBandwidth: true,
                startLevel: -1,
                abrEwmaDefaultEstimate: 1_000_000,
                abrBandWidthFactor: 0.8,
                abrBandWidthUpFactor: 0.7,
                abrMaxWithRealBitrate: true,
              });
              hls.loadSource(url);
              hls.attachMedia(video);
              (art as any).hls = hls;
              art.on("destroy", () => hls.destroy());

              const seekToLive = () => {
                try {
                  if (hls.liveSyncPosition && Number.isFinite(hls.liveSyncPosition)) {
                    if (Math.abs(video.currentTime - hls.liveSyncPosition) > 10) {
                      video.currentTime = hls.liveSyncPosition;
                    }
                  } else if (video.seekable.length) {
                    const end = video.seekable.end(video.seekable.length - 1);
                    if (end - video.currentTime > 10) video.currentTime = Math.max(0, end - 4);
                  }
                } catch {}
              };

              // Stall watchdog: hanya lompat ke live jika jauh tertinggal (>20s)
              const stallTimer = window.setInterval(() => {
                if (video.paused || !video.duration) return;
                const live = hls.liveSyncPosition;
                if (live && Number.isFinite(live) && live - video.currentTime > 20) seekToLive();
              }, 5000);
              art.on("destroy", () => {
                window.clearInterval(stallTimer);
              });

              let recoverAttempts = 0;
              hls.on(Hls.Events.ERROR, (_e, data) => {
                if (!data.fatal) return;
                if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                  hls.startLoad();
                  setTimeout(seekToLive, 800);
                } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                  recoverAttempts += 1;
                  if (recoverAttempts <= 2) {
                    hls.recoverMediaError();
                  } else {
                    hls.destroy();
                    const fresh = new Hls({ enableWorker: true, lowLatencyMode: true });
                    fresh.loadSource(url);
                    fresh.attachMedia(video);
                    (art as any).hls = fresh;
                  }
                }
              });
              hls.on(Hls.Events.MANIFEST_PARSED, () => { try { video.play().catch(() => {}); } catch {} });
            } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
              video.src = url;
            }
          },
        },
        plugins: [
          artplayerPluginHlsQuality({
            control: true,
            setting: true,
            getResolution: (level: any) => (level.height ? level.height + "P" : "Auto"),
            title: "Kualitas",
            auto: "Auto",
          }),
        ],
        lang: "id",
      });

      artRef.current = art;
      art.on("ready", () => { try { art.play(); } catch {} });
    })();

    return () => {
      cancelled = true;
      if (artRef.current) { artRef.current.destroy(false); artRef.current = null; }
    };
  }, [activeServer]);

  // Sync mute/volume to artplayer
  useEffect(() => {
    const a = artRef.current;
    if (a && activeServer?.kind === "m3u8") {
      try { a.muted = muted; a.volume = volume; } catch {}
    }
  }, [muted, volume, activeServer?.kind]);

  const sendYT = useCallback((func: string, args: any[] = []) => {
    iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args }), "*");
  }, []);

  useEffect(() => {
    if (!activeServer || activeServer.kind !== "youtube") return;
    const t = setTimeout(() => {
      if (muted) sendYT("mute");
      else { sendYT("unMute"); sendYT("setVolume", [Math.round(volume * 100)]); }
    }, 800);
    return () => clearTimeout(t);
  }, [muted, volume, activeServer, sendYT]);

  useEffect(() => {
    const keepAlive = () => {
      const a = artRef.current;
      if (a && activeServer?.kind === "m3u8") { try { if ((a as any).video?.paused) a.play(); } catch {} }
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
    const anyDoc = document as any;
    const anyEl = container as any;
    const isFs = document.fullscreenElement || anyDoc.webkitFullscreenElement;
    if (!isFs) {
      const req = container.requestFullscreen || anyEl.webkitRequestFullscreen || anyEl.webkitEnterFullscreen;
      if (req) req.call(container);
      else {
        const v = container.querySelector("video") as any;
        if (v?.webkitEnterFullscreen) v.webkitEnterFullscreen();
      }
    } else {
      const exit = document.exitFullscreen || anyDoc.webkitExitFullscreen;
      if (exit) exit.call(document);
    }
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
  };

  const VolIcon = muted || volume === 0 ? VolumeX : Volume2;
  const hasVideo = Boolean(activeServer);
  const isYT = activeServer?.kind === "youtube";

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
                if (artRef.current && activeServer?.kind === "m3u8") {
                  try { artRef.current.muted = false; artRef.current.play(); } catch {}
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
          {isYT ? (
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
            <div ref={artContainerRef} className="absolute inset-0 h-full w-full bg-black" />
          )}

          {/* Overlay only on YouTube — ArtPlayer has its own controls */}
          {isYT && (
            <div
              className="absolute inset-0 z-20"
              onContextMenu={(e) => e.preventDefault()}
              onClick={(e) => { e.preventDefault(); showControls(); }}
              onDoubleClick={(e) => e.preventDefault()}
              style={{ cursor: "pointer" }}
            />
          )}

          {isYT && controlsVisible && (
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
          {isYT && (
          <div className={`absolute bottom-3 right-3 z-30 flex gap-2 transition-opacity duration-300 ${controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setShowQuality((v) => !v); showControls(); }}
                className="px-3 h-10 min-w-[44px] rounded-lg bg-background/70 hover:bg-background/90 backdrop-blur-md border border-foreground/20 text-foreground transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5 shadow-lg"
                type="button"
                title="Resolusi"
              >
                <Settings2 size={16} />
                <span className="text-[11px] font-bold tracking-wide">
                  {(YT_QUALITY.find((q) => q.value === ytQuality)?.label || "AUTO").toUpperCase()}
                </span>
              </button>
              {showQuality && (
                <div className="absolute bottom-full right-0 mb-2 bg-card/95 backdrop-blur-md border border-border rounded-lg shadow-xl overflow-hidden min-w-[120px]">
                  {YT_QUALITY.map((q) => (
                    <button key={q.value} onClick={(e) => { e.stopPropagation(); setYtQuality(q.value); setShowQuality(false); showControls(); }}
                      className={`w-full px-3 py-2 text-xs text-left transition-colors ${ytQuality === q.value ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-secondary"}`}>
                      {q.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); toggleFullscreen(); showControls(); }}
              className="h-10 w-10 rounded-lg bg-background/70 hover:bg-background/90 backdrop-blur-md border border-foreground/20 text-foreground transition-all hover:scale-105 active:scale-95 flex items-center justify-center shadow-lg"
              type="button"
              title={isFullscreen ? "Keluar layar penuh" : "Layar penuh"}
            >
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
          </div>
          )}

          <div
            className="absolute z-30 pointer-events-none select-none transition-opacity duration-500"
            style={{
              top: wmPos.top,
              left: wmPos.left,
              right: wmPos.right,
              bottom: wmPos.bottom,
              opacity: wmVisible ? 0.45 : 0,
              fontSize: "9px",
              fontFamily: "JetBrains Mono, monospace",
              color: "hsl(var(--foreground))",
              textShadow: "0 0 4px rgba(0,0,0,0.8)",
              letterSpacing: "0.05em",
            }}
          >
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
