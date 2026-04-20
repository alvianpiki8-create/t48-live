import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getDeviceId } from "@/lib/deviceId";

const LOG_KEY = "teamlive_last_visit_log";

/**
 * Logs a visit (max once per day per device) and returns the count of
 * unique devices that have visited in the last 7 days.
 * Real-time: subscribes to new viewer_visits inserts so the counter
 * updates instantly without polling delays.
 */
export const useWeeklyViewers = () => {
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    const deviceId = getDeviceId();
    const seen = new Set<string>();

    const logVisit = async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const last = localStorage.getItem(LOG_KEY);
        if (last !== today) {
          await supabase.from("viewer_visits" as any).insert({ device_id: deviceId } as any);
          localStorage.setItem(LOG_KEY, today);
        }
      } catch {
        // best-effort
      }
    };

    const fetchCount = async () => {
      try {
        const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { data, error } = await supabase
          .from("viewer_visits" as any)
          .select("device_id")
          .gte("visited_at", since)
          .limit(20000);
        if (error || cancelled || !data) return;
        seen.clear();
        (data as any[]).forEach((r) => seen.add(r.device_id));
        setCount(seen.size);
      } catch {
        // ignore
      }
    };

    logVisit().then(fetchCount);

    // Real-time: instantly bump counter when a new device visits
    const channel = supabase
      .channel("viewer_visits_rt")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "viewer_visits" },
        (payload) => {
          const id = (payload.new as any)?.device_id;
          if (!id) return;
          if (!seen.has(id)) {
            seen.add(id);
            setCount(seen.size);
          }
        }
      )
      .subscribe();

    // Background safety refresh every 5 min (in case of long sessions)
    const interval = setInterval(fetchCount, 5 * 60_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
      try { supabase.removeChannel(channel); } catch {}
    };
  }, []);

  return count;
};
