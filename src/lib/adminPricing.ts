// Harga per link yang dibuat admin (untuk setoran)
export const PRICE_NORMAL = 3000;
export const PRICE_MEMBERSHIP_WEEKLY = 8000;
export const PRICE_MEMBERSHIP_MONTHLY = 13000;

export type LinkKind = "normal" | "membership_weekly" | "membership_monthly";

export interface AdminLogLike {
  link_type?: string | null;
  duration_days?: number | null;
}

export const classifyLog = (l: AdminLogLike): LinkKind => {
  if (l.link_type === "membership") {
    return (l.duration_days || 0) >= 30 ? "membership_monthly" : "membership_weekly";
  }
  return "normal";
};

export const priceOf = (l: AdminLogLike): number => {
  const k = classifyLog(l);
  if (k === "membership_weekly") return PRICE_MEMBERSHIP_WEEKLY;
  if (k === "membership_monthly") return PRICE_MEMBERSHIP_MONTHLY;
  return PRICE_NORMAL;
};

export interface AdminTally {
  normal: number;
  weekly: number;
  monthly: number;
  total: number;
  amount: number;
}

export const tallyLogs = (logs: AdminLogLike[]): AdminTally => {
  const t: AdminTally = { normal: 0, weekly: 0, monthly: 0, total: 0, amount: 0 };
  for (const l of logs) {
    const k = classifyLog(l);
    if (k === "normal") t.normal++;
    else if (k === "membership_weekly") t.weekly++;
    else t.monthly++;
    t.total++;
    t.amount += priceOf(l);
  }
  return t;
};

export const formatIDR = (n: number) =>
  "Rp" + Math.round(n).toLocaleString("id-ID");
