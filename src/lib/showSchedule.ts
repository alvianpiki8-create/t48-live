export interface ShowSchedule {
  id: string;
  name: string;
  show_code?: string | null;
  show_date?: string | null; // YYYY-MM-DD
  access_hour?: string | null; // HH:MM
  access_duration_hours?: number | null;
}

export interface ShowWindow {
  start: Date | null;
  end: Date | null;
}

/** Hitung jendela akses (mulai & selesai) dari jadwal show. */
export const getShowWindow = (show?: ShowSchedule | null): ShowWindow => {
  if (!show?.show_date) return { start: null, end: null };
  const hour = (show.access_hour || "00:00").slice(0, 5);
  const start = new Date(`${show.show_date}T${hour}:00`);
  if (Number.isNaN(start.getTime())) return { start: null, end: null };
  const hours = Number(show.access_duration_hours || 24);
  const end = new Date(start.getTime() + hours * 60 * 60 * 1000);
  return { start, end };
};

export type ShowAccess =
  | { state: "open"; start: Date | null; end: Date | null }
  | { state: "pending"; start: Date; end: Date | null }
  | { state: "ended"; start: Date; end: Date };

/** Status akses show untuk waktu tertentu. */
export const getShowAccess = (show?: ShowSchedule | null, now: Date = new Date()): ShowAccess => {
  const { start, end } = getShowWindow(show);
  if (!start) return { state: "open", start: null, end: null };
  if (now < start) return { state: "pending", start, end };
  if (end && now > end) return { state: "ended", start, end };
  return { state: "open", start, end };
};

export const formatShowSchedule = (show?: ShowSchedule | null) => {
  const { start } = getShowWindow(show);
  if (!start) return "Tanpa jadwal";
  return start.toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

export const countdownText = (target: Date, now: Date = new Date()) => {
  let diff = Math.max(0, Math.floor((target.getTime() - now.getTime()) / 1000));
  const d = Math.floor(diff / 86400); diff -= d * 86400;
  const h = Math.floor(diff / 3600); diff -= h * 3600;
  const m = Math.floor(diff / 60);
  const s = diff - m * 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return d > 0 ? `${d} hari ${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(h)}:${pad(m)}:${pad(s)}`;
};
