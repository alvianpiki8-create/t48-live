// Device fingerprint yang stabil.
// Disimpan di localStorage + cookie + sessionStorage supaya ID tidak berubah
// saat storage dibersihkan sebagian — penyebab utama pesan
// "link sudah dipakai di perangkat lain" padahal orangnya sama.
const KEY = "teamlive_device_id";

const readCookie = (): string | null => {
  const m = document.cookie.match(/(?:^|;\s*)teamlive_device_id=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
};

const writeCookie = (id: string) => {
  try {
    document.cookie = `${KEY}=${encodeURIComponent(id)}; path=/; max-age=${60 * 60 * 24 * 730}; SameSite=Lax`;
  } catch { /* ignore */ }
};

const persist = (id: string) => {
  try { localStorage.setItem(KEY, id); } catch { /* ignore */ }
  try { sessionStorage.setItem(KEY, id); } catch { /* ignore */ }
  writeCookie(id);
};

export const getDeviceId = (): string => {
  let id: string | null = null;
  try { id = localStorage.getItem(KEY); } catch { /* ignore */ }
  if (!id) id = readCookie();
  if (!id) { try { id = sessionStorage.getItem(KEY); } catch { /* ignore */ } }

  if (!id) {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    id = Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  persist(id);
  return id;
};
