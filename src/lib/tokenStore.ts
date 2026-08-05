const KEY = "teamlive_token";

export const setAccessToken = (token: string) => {
  try { sessionStorage.setItem(KEY, token); } catch {}
  try { localStorage.setItem(KEY, token); } catch {}
};

export const getAccessToken = (): string | null => {
  let t: string | null = null;
  try { t = sessionStorage.getItem(KEY); } catch {}
  if (!t) {
    try { t = localStorage.getItem(KEY); } catch {}
    if (t) { try { sessionStorage.setItem(KEY, t); } catch {} }
  }
  return t;
};

export const clearAccessToken = () => {
  try { sessionStorage.removeItem(KEY); } catch {}
  try { localStorage.removeItem(KEY); } catch {}
};
