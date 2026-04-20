import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getDeviceId } from "@/lib/deviceId";

const CHANNEL_NAME = "viewers_presence";

export const useViewerPresence = () => {
  const [viewerCount, setViewerCount] = useState(1);

  useEffect(() => {
    const deviceId = getDeviceId();
    const channel = supabase.channel(CHANNEL_NAME, {
      config: { presence: { key: deviceId } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const count = Object.keys(state).length;
        setViewerCount(Math.max(1, count));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ device_id: deviceId, joined_at: Date.now() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return viewerCount;
};
