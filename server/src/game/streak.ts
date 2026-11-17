// The streak: how many consecutive local days, ending today or yesterday, have a ledger row (spec 013, kept by 024).
const DAY_MS = 24 * 60 * 60 * 1000;
const t = (day: string) => Date.parse(`${day}T00:00:00Z`);

export function streakDays(days: readonly string[], today: string): number {
  const have = new Set(days);
  let cursor = have.has(today) ? t(today) : t(today) - DAY_MS;
  let n = 0;
  while (have.has(new Date(cursor).toISOString().slice(0, 10))) {
    n++;
    cursor -= DAY_MS;
  }
  return n;
}
