// Paket membership terpusat — dipakai di panel admin, panel owner, katalog,
// dan edge function pembelian membership.
export type MembershipType = "weekly" | "monthly" | "bimonthly" | "yearly";

export const MEMBERSHIP_PLANS: { type: MembershipType; days: number; label: string; short: string }[] = [
  { type: "weekly", days: 7, label: "Mingguan (7 hari)", short: "Mingguan" },
  { type: "monthly", days: 30, label: "Bulanan (30 hari)", short: "Bulanan" },
  { type: "bimonthly", days: 60, label: "2 Bulan (60 hari)", short: "2 Bulan" },
  { type: "yearly", days: 365, label: "Tahunan (365 hari)", short: "Tahunan" },
];

export const membershipDays = (type?: string | null): number =>
  MEMBERSHIP_PLANS.find((p) => p.type === type)?.days ?? 30;

export const membershipLabel = (type?: string | null): string =>
  MEMBERSHIP_PLANS.find((p) => p.type === type)?.short ?? "Bulanan";
