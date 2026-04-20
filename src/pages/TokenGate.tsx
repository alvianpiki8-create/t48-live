import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getDeviceId } from "@/lib/deviceId";
import RainEffect from "@/components/RainEffect";
import AntiInspect from "@/components/AntiInspect";

const TokenGate = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "error" | "blocked">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMsg("Token tidak ditemukan.");
      return;
    }

    const validateToken = async () => {
      const deviceId = getDeviceId();

      // Fetch token from database
      const { data, error } = await supabase
        .from("access_tokens")
        .select("*")
        .eq("token_code", token)
        .maybeSingle();

      if (error || !data) {
        setStatus("error");
        setErrorMsg("Token tidak valid atau sudah kadaluarsa.");
        return;
      }

      if (data.is_blocked) {
        setStatus("blocked");
        setErrorMsg(data.blocked_reason || "Token ini telah diblokir oleh admin.");
        return;
      }

      // Check valid_until (set when first used)
      if ((data as any).valid_until) {
        if (new Date() > new Date((data as any).valid_until)) {
          setStatus("error");
          setErrorMsg("Token sudah kadaluarsa.");
          return;
        }
      }

      // Check device binding
      if (data.device_id && data.device_id !== deviceId) {
        setStatus("error");
        setErrorMsg("Token ini sudah digunakan di perangkat lain. Satu token hanya untuk satu perangkat.");
        return;
      }

      // Bind device + set valid_until based on duration_days
      if (!data.device_id) {
        const days = (data as any).duration_days || 1;
        const validUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

        const { error: updateError } = await supabase
          .from("access_tokens")
          .update({ device_id: deviceId, used_at: new Date().toISOString(), valid_until: validUntil } as any)
          .eq("id", data.id);

        if (updateError) {
          setStatus("error");
          setErrorMsg("Gagal menghubungkan perangkat. Coba lagi.");
          return;
        }
      }

      // Store token in session and navigate
      sessionStorage.setItem("teamlive_token", token);
      sessionStorage.setItem("teamlive_device_id", deviceId);
      navigate("/", { replace: true });
    };

    validateToken();
  }, [token, navigate]);

  return (
    <>
      <AntiInspect />
      <RainEffect />
      <div className="min-h-screen flex items-center justify-center px-4 relative z-10">
        <div className="bg-card border border-border rounded-xl p-8 w-full max-w-sm text-center" style={{ animation: "fade-in 0.3s ease-out" }}>
          {status === "loading" && (
            <>
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <h2 className="text-foreground font-semibold">Memverifikasi Token...</h2>
              <p className="text-muted-foreground text-sm mt-2">Mohon tunggu sebentar</p>
            </>
          )}
          {status === "error" && (
            <>
              <div className="text-4xl mb-4">🚫</div>
              <h2 className="text-foreground font-semibold">Akses Ditolak</h2>
              <p className="text-muted-foreground text-sm mt-2">{errorMsg}</p>
            </>
          )}
          {status === "blocked" && (
            <>
              <div className="text-4xl mb-4">⛔</div>
              <h2 className="text-destructive font-semibold">Token Diblokir</h2>
              <p className="text-muted-foreground text-sm mt-2">{errorMsg}</p>
            </>
          )}
          <p className="text-muted-foreground/30 text-xs font-mono mt-6">@t48id</p>
        </div>
      </div>
    </>
  );
};

export default TokenGate;
