import { supabase } from "@/integrations/supabase/client";

const KEY = "teamlive_idn_sync_at";
const THROTTLE_MS = 5 * 60 * 1000;

/** Sinkronkan jadwal show resmi (IDN+) ke katalog & daftar ID show. */
export const syncIdnShows = async (force = false): Promise<number> => {
  try {
    if (!force) {
      const last = Number(localStorage.getItem(KEY) || 0);
      if (Date.now() - last < THROTTLE_MS) return 0;
    }
    localStorage.setItem(KEY, String(Date.now()));
    const { data } = await supabase.functions.invoke("sync-idn-shows", { body: {} });
    return Number((data as any)?.synced || 0);
  } catch {
    return 0;
  }
};
