import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getDeviceId } from "@/lib/deviceId";

const CHANNEL_NAME = "viewers_presence";

export const useViewerPresence = () => {
  const [viewerCount, setViewerCount] = useState(1);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    const deviceId = getDeviceId();
    let cancelled = false;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;

    const setup = () => {
      if (cancelled) return;

      // Clean any existing channel before creating a new one
      if (channelRef.current) {
        try { supabase.removeChannel(channelRef.current); } catch {}
        channelRef.current = null;
      }

      const channel = supabase.channel(CHANNEL_NAME, {
        config: { presence: { key: deviceId } },
      });
      channelRef.current = channel;

      const updateCount = () => {
        try {
          const state = channel.presenceState();
          const count = Object.keys(state).length;
          setViewerCount(Math.max(1, count));
        } catch {
          // ignore
        }
      };

      channel
        .on("presence", { event: "sync" }, updateCount)
        .on("presence", { event: "join" }, updateCount)
        .on("presence", { event: "leave" }, updateCount)
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            try {
              await channel.track({ device_id: deviceId, joined_at: Date.now() });
            } catch {
              // ignore tracking errors
            }
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            // Auto-reconnect after a short delay
            if (!cancelled && !retryTimeout) {
              retryTimeout = setTimeout(() => {
                retryTimeout = null;
                setup();
              }, 2000);
            }
          }
        });
    };

    setup();

    // Re-track on tab visibility change so counts stay accurate
    const onVisibility = () => {
      if (document.visibilityState === "visible" && channelRef.current) {
        channelRef.current.track({ device_id: deviceId, joined_at: Date.now() }).catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      if (retryTimeout) clearTimeout(retryTimeout);
      document.removeEventListener("visibilitychange", onVisibility);
      if (channelRef.current) {
        try { supabase.removeChannel(channelRef.current); } catch {}
        channelRef.current = null;
      }
    };
  }, []);

  return viewerCount;
};
