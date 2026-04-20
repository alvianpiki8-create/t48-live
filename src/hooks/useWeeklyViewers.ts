import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getDeviceId } from "@/lib/deviceId";

const LOG_KEY = "teamlive_last_visit_log";

/**
 * Logs a visit (max once per day per device) and returns the count of
 * unique devices that have visited in the last 7 days.
 */
export const useWeeklyViewers = () => {
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    const deviceId = getDeviceId();

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
          .limit(10000);
        if (error || cancelled || !data) return;
        const unique = new Set((data as any[]).map((r) => r.device_id));
        setCount(unique.size);
      } catch {
        // ignore
      }
    };

    logVisit().then(fetchCount);

    // Refresh every 60s
    const interval = setInterval(fetchCount, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return count;
};
