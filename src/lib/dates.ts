// All dates in the app are local "YYYY-MM-DD" strings (never UTC ISO), matching
// the prototype's helpers so due dates and streaks follow the learner's clock.

export function ymd(d: Date): string {
  const m = d.getMonth() + 1;
  const dd = d.getDate();
  return `${d.getFullYear()}-${m < 10 ? "0" : ""}${m}-${dd < 10 ? "0" : ""}${dd}`;
}

export function today(): string {
  return ymd(new Date());
}

export function addDays(s: string, n: number): string {
  const d = new Date(s + "T00:00:00");
  d.setDate(d.getDate() + n);
  return ymd(d);
}

/** Whole days from a to b (positive when b is later). */
export function diffDays(a: string, b: string): number {
  return Math.round(
    (new Date(b + "T00:00:00").getTime() - new Date(a + "T00:00:00").getTime()) / 86400000,
  );
}

export const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function dayName(s: string): string {
  return DOW[new Date(s + "T00:00:00").getDay()];
}

export function isYmd(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}
