import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Jumlah penonton tambahan (fake) yang diatur owner. 0 = murni real-time. */
export const useFakeViewers = () => {
  const [fake, setFake] = useState(0);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data } = await supabase
        .from("stream_settings")
        .select("fake_viewers")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (active) setFake(Math.max(0, (data as any)?.fake_viewers || 0));
    };
    load();

    const channel = supabase
      .channel("fake_viewers_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "stream_settings" },
        (payload) => {
          const v = (payload.new as any)?.fake_viewers;
          if (active && typeof v === "number") setFake(Math.max(0, v));
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return fake;
};
