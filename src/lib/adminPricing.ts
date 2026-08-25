// Harga per link yang dibuat admin (untuk setoran)
export const PRICE_NORMAL = 3000;
export const PRICE_MEMBERSHIP_WEEKLY = 8000;
export const PRICE_MEMBERSHIP_MONTHLY = 13000;
export const PRICE_MEMBERSHIP_BIMONTHLY = 25000;
export const PRICE_MEMBERSHIP_YEARLY = 130000;

export type LinkKind = "normal" | "membership_weekly" | "membership_monthly" | "membership_bimonthly" | "membership_yearly";

export interface AdminLogLike {
  link_type?: string | null;
  duration_days?: number | null;
  created_at?: string | null;
}

export const filterLogsSince = <T extends AdminLogLike>(logs: T[], sinceIso?: string | null): T[] => {
  if (!sinceIso) return logs;
  const t = new Date(sinceIso).getTime();
  if (Number.isNaN(t)) return logs;
  return logs.filter((l) => (l.created_at ? new Date(l.created_at).getTime() > t : true));
};

export const classifyLog = (l: AdminLogLike): LinkKind => {
  if (l.link_type === "membership") {
    const d = l.duration_days || 0;
    if (d >= 365) return "membership_yearly";
    if (d >= 60) return "membership_bimonthly";
    if (d >= 30) return "membership_monthly";
    return "membership_weekly";
  }
  return "normal";
};

export const priceOf = (l: AdminLogLike): number => {
  const k = classifyLog(l);
  if (k === "membership_weekly") return PRICE_MEMBERSHIP_WEEKLY;
  if (k === "membership_monthly") return PRICE_MEMBERSHIP_MONTHLY;
  if (k === "membership_bimonthly") return PRICE_MEMBERSHIP_BIMONTHLY;
  if (k === "membership_yearly") return PRICE_MEMBERSHIP_YEARLY;
  return PRICE_NORMAL;
};

export interface AdminTally {
  normal: number;
  weekly: number;
  monthly: number;
  bimonthly: number;
  yearly: number;
  total: number;
  amount: number;
}

export const tallyLogs = (logs: AdminLogLike[]): AdminTally => {
  const t: AdminTally = { normal: 0, weekly: 0, monthly: 0, bimonthly: 0, yearly: 0, total: 0, amount: 0 };
  for (const l of logs) {
    const k = classifyLog(l);
    if (k === "normal") t.normal++;
    else if (k === "membership_weekly") t.weekly++;
    else if (k === "membership_monthly") t.monthly++;
    else if (k === "membership_bimonthly") t.bimonthly++;
    else t.yearly++;
    t.total++;
    t.amount += priceOf(l);
  }
  return t;
};


export const formatIDR = (n: number) =>
  "Rp" + Math.round(n).toLocaleString("id-ID");
