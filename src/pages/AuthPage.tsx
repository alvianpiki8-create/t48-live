import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Eye, EyeOff } from "lucide-react";

const AuthPage = () => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) setTimeout(() => navigate("/catalog", { replace: true }), 0);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) navigate("/catalog", { replace: true });
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (isLogin) {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) { setError(err.message); setLoading(false); return; }
    } else {
      if (!nickname.trim()) { setError("Nickname wajib diisi"); setLoading(false); return; }
      if (nickname.trim().length < 2) { setError("Nickname minimal 2 karakter"); setLoading(false); return; }
      const { data, error: err } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { nickname: nickname.trim() }, emailRedirectTo: window.location.origin + "/catalog" },
      });
      if (err) { setError(err.message); setLoading(false); return; }
      if (!data.session) {
        setError("Akun dibuat. Silakan cek email untuk verifikasi, lalu masuk kembali.");
        setLoading(false);
        return;
      }
    }

    setLoading(false);
    navigate("/catalog", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-sky-50 via-blue-50 to-white relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute -top-24 -left-24 w-72 h-72 bg-sky-200/50 rounded-full blur-3xl" />
      <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-blue-200/50 rounded-full blur-3xl" />

      <div
        className="relative bg-white/90 backdrop-blur-xl border border-sky-100 shadow-2xl shadow-sky-200/40 rounded-2xl p-8 w-full max-w-sm"
        style={{ animation: "fade-in 0.35s ease-out" }}
      >
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-sky-300/50">
            T
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mt-3">{isLogin ? "Selamat Datang" : "Buat Akun"}</h1>
          <p className="text-slate-500 text-sm mt-1">TEAM Live</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="text-sm text-slate-600 mb-1 block">Nickname</label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Nama tampilan kamu"
                maxLength={20}
                className="w-full bg-sky-50/70 border border-sky-200 rounded-xl px-4 py-2.5 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent transition-all"
              />
            </div>
          )}
          <div>
            <label className="text-sm text-slate-600 mb-1 block">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@contoh.com"
              className="w-full bg-sky-50/70 border border-sky-200 rounded-xl px-4 py-2.5 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent transition-all"
            />
          </div>
          <div>
            <label className="text-sm text-slate-600 mb-1 block">Password</label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                className="w-full bg-sky-50/70 border border-sky-200 rounded-xl px-4 py-2.5 pr-10 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent transition-all"
              />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && <p className="text-red-500 text-sm bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-sky-500 to-blue-500 text-white py-2.5 rounded-xl font-semibold hover:opacity-95 hover:shadow-lg hover:shadow-sky-300/40 transition-all disabled:opacity-50"
          >
            {loading ? "Loading..." : isLogin ? "Masuk" : "Daftar"}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-5">
          {isLogin ? "Belum punya akun?" : "Sudah punya akun?"}{" "}
          <button onClick={() => { setIsLogin(!isLogin); setError(""); }} className="text-sky-600 font-semibold hover:underline">
            {isLogin ? "Daftar" : "Masuk"}
          </button>
        </p>
      </div>
    </div>
  );
};

export default AuthPage;
