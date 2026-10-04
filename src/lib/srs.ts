// Spaced-repetition rules from design/SPEC.md §6. Pure functions, no I/O.

export type Grade = "again" | "hard" | "good" | "easy";
export const GRADES: Grade[] = ["again", "hard", "good", "easy"];

export interface SrsItem {
  reps: number;
  interval: number;
  ease: number;
  kind: string; // academic | everyday
}

export type Status = "new" | "learning" | "known";

export function status(i: { reps: number; interval: number }): Status {
  if (!i.reps) return "new";
  if (i.interval >= 21) return "known";
  return "learning";
}

export function statusName(i: { reps: number; interval: number }): string {
  return { new: "New", learning: "Learning", known: "Known" }[status(i)];
}

/** Next interval in days for a grade. Everyday phrases: ×2, minimum 3 days. */
export function nextInterval(i: SrsItem, g: Grade): number {
  let iv = i.interval || 0;
  const e = i.ease || 2.5;
  const r = i.reps || 0;
  if (g === "again") return 0;
  if (g === "hard") iv = r === 0 ? 1 : Math.max(1, Math.round(iv * 1.2));
  else if (g === "good") iv = r === 0 ? 1 : r === 1 ? 3 : Math.round(iv * e);
  else iv = r === 0 ? 3 : Math.round(Math.max(iv, 1) * e * 1.3);
  if (i.kind === "everyday") iv = Math.max(3, iv * 2);
  return iv;
}

export function nextEase(ease: number, g: Grade): number {
  const e = ease || 2.5;
  if (g === "again") return Math.max(1.3, e - 0.2);
  if (g === "hard") return Math.max(1.3, e - 0.15);
  if (g === "easy") return e + 0.15;
  return e;
}

export function intervalLabel(n: number): string {
  if (n === 0) return "again now";
  if (n === 1) return "1 day";
  if (n < 30) return `${n} days`;
  const m = Math.round(n / 30);
  return `${m} ${m === 1 ? "month" : "months"}`;
}

/** Daily plan from minutes per day. */
export function dailyPlan(min: number) {
  return {
    newN: Math.round(min / 3),
    reviewN: Math.round(min * 1.5),
    sentenceN: min >= 30 ? 4 : min >= 20 ? 3 : 2,
  };
}

/** Replace the phrase inside an example with blanks for "meaning → phrase" cards. */
export function blankOut(example: string, phrase: string): string {
  if (!example) return "";
  const idx = example.toLowerCase().indexOf(phrase.toLowerCase());
  if (idx >= 0) return example.slice(0, idx) + "_____" + example.slice(idx + phrase.length);
  const words = phrase
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3 && !["something", "someone"].includes(w));
  let out = example;
  for (const w of words) {
    const clean = w.replace(/[^a-z-]/g, "");
    if (!clean) continue;
    out = out.replace(new RegExp(`\\b${clean}\\b`, "ig"), "___");
  }
  return out;
}

export function firstLetterHint(phrase: string): string {
  return phrase
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0] + "…")
    .join(" ");
}

/** Local sentence check before any AI feedback (SPEC §6). */
export function checkSentence(
  item: { phrase: string; example: string },
  text: string,
): { ok: boolean; msg: string } {
  const t = text.trim();
  if (!t) return { ok: false, msg: "Write a sentence first." };
  const low = t.toLowerCase();
  const keys = item.phrase
    .toLowerCase()
    .replace(/\b(something|someone|somebody|sth|sb|one's)\b/g, " ")
    .split(/[^a-z'-]+/)
    .filter((w) => w.length > 2 && !["the", "and"].includes(w));
  const hit = keys.every((w) => low.includes(w.length > 5 ? w.slice(0, w.length - 2) : w));
  const words = t.split(/\s+/).length;
  const lines: string[] = [];
  lines.push(
    hit
      ? `✓ You used “${item.phrase}”.`
      : `✗ The full phrase “${item.phrase}” is missing. Check each word.`,
  );
  lines.push(
    words >= 10
      ? `✓ Good length (${words} words).`
      : `• A bit short (${words} words). Add a reason or example so it reads like Writing.`,
  );
  if (!/^[A-Z]/.test(t)) lines.push("• Start with a capital letter.");
  if (!/[.!?]$/.test(t)) lines.push("• End with a full stop.");
  if (item.example && low === item.example.toLowerCase())
    lines.push("• That is the example sentence. Write your own.");
  return { ok: hit, msg: lines.join("\n") };
}
