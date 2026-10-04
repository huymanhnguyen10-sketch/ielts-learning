// Flashcards & quick-test rules from design/SPEC.md §6 ("Flashcards & tests").
// Pure functions, no I/O. Ported from the prototype (design/Main.dc.html).

import { blankOut, status } from "./srs";

export type QuizType = "mcPhrase" | "mcMeaning" | "fill" | "tf" | "gap" | "order" | "vi";
export type QuizKind = "choice" | "type" | "order";
export type Speed = "relaxed" | "normal" | "fast";
export type PoolSource = "all" | "learning" | "new" | "academic" | "everyday";

export interface QuizTypeMeta {
  label: string;
  color: string;
  tint: string;
  dark: string;
}

/** Order matters: it is the display order of the type toggles. */
export const QUIZ_TYPES: Record<QuizType, QuizTypeMeta> = {
  mcPhrase: { label: "Multiple choice", color: "#5B3FD9", tint: "#EEEAFE", dark: "#3B2799" },
  mcMeaning: { label: "Choose the meaning", color: "#2563EB", tint: "#E8F0FE", dark: "#1E40AF" },
  fill: { label: "Fill in the blank", color: "#F0623A", tint: "#FEECE6", dark: "#9A3412" },
  tf: { label: "True / False", color: "#0EA5B7", tint: "#E3F7FA", dark: "#0B5F6B" },
  gap: { label: "Missing word", color: "#E8488A", tint: "#FDE8F1", dark: "#9D174D" },
  order: { label: "Word order", color: "#E0B000", tint: "#FFF6DB", dark: "#5C4300" },
  vi: { label: "Vietnamese → English", color: "#16A34A", tint: "#E7F6EC", dark: "#166534" },
};

export const QUIZ_TYPE_KEYS = Object.keys(QUIZ_TYPES) as QuizType[];

export function isQuizType(s: string): s is QuizType {
  return (QUIZ_TYPE_KEYS as string[]).includes(s);
}

export const SPEED_SECONDS: Record<Speed, number> = { relaxed: 30, normal: 20, fast: 12 };
export const SPEED_LABEL: Record<Speed, string> = { relaxed: "Relaxed", normal: "Normal", fast: "Fast" };
export const COUNT_OPTIONS = [5, 10, 15, 20] as const;

export interface PoolItem {
  id: number;
  phrase: string;
  meaning: string;
  example: string;
  topic: string;
  kind: string;
  reps: number;
  interval: number;
  vi: string;
}

export interface Question {
  itemId: number;
  type: QuizType;
  phrase: string;
  meaning: string;
  example: string;
  kind: QuizKind;
  options: string[];
  chips: string[];
  answer: string;
  prompt: string;
  main: string;
  sub: string;
  lang: "en" | "vi";
}

export type Random = () => number;

/** Fisher–Yates shuffle (copy). */
export function shuffle<T>(a: ReadonlyArray<T>, random: Random = Math.random): T[] {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const t = b[i];
    b[i] = b[j];
    b[j] = t;
  }
  return b;
}

/** Normalise typed answers: case, curly quotes, punctuation and spacing are ignored. */
export function norm(t: string | null | undefined): string {
  return (t || "")
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9' -]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Filter the phrase bank by the setup's "Phrases from" and topic choices. */
export function filterPool<T extends PoolItem>(items: ReadonlyArray<T>, source: PoolSource, topic: string): T[] {
  return items.filter((i) => {
    if (topic !== "All" && i.topic !== topic) return false;
    if (source === "learning") return status(i) !== "known";
    if (source === "new") return !i.reps;
    if (source === "academic") return i.kind === "academic";
    if (source === "everyday") return i.kind === "everyday";
    return true;
  });
}

const GAP_STOP = ["something", "someone", "somebody", "that", "this", "with", "from", "into", "have"];

/** Words of a phrase that can be blanked for "Missing word" (≥ 4 letters, not a stop word). */
export function gapCands(it: { phrase: string }, ok?: (w: string) => boolean): string[] {
  return it.phrase
    .split(/\s+/)
    .filter(
      (w) =>
        w.replace(/[^a-z-]/gi, "").length >= 4 && !GAP_STOP.includes(w.toLowerCase()) && (!ok || ok(w)),
    );
}

function gapPool(others: ReadonlyArray<PoolItem>, exclude?: string): string[] {
  const pool: string[] = [];
  const ex = exclude ? exclude.toLowerCase() : null;
  for (const o of others) {
    for (const x of gapCands(o)) {
      const lx = x.toLowerCase();
      if (lx !== ex && !pool.includes(lx)) pool.push(lx);
    }
  }
  return pool;
}

/** Can question type `t` be asked about `it`, given the other phrases available as distractors? */
export function qApplicable(t: QuizType, it: PoolItem, others: ReadonlyArray<PoolItem>): boolean {
  const words = it.phrase.split(/\s+/);
  if (t === "mcPhrase" || t === "mcMeaning") return others.length >= 3;
  if (t === "tf") return others.length >= 1;
  if (t === "fill") return !!it.example && it.example.toLowerCase().includes(it.phrase.toLowerCase());
  if (t === "order") return words.length >= 3;
  if (t === "vi") return !!it.vi && others.length >= 3;
  if (t === "gap") {
    const c = gapCands(it);
    return c.length > 0 && gapPool(others).length >= 4;
  }
  return false;
}

/** Build one question of type `t` for `it`. `others` must be shuffled, exclude `it` and its meaning. */
export function makeQ(t: QuizType, it: PoolItem, others: ReadonlyArray<PoolItem>, random: Random = Math.random): Question {
  const q: Question = {
    itemId: it.id,
    type: t,
    phrase: it.phrase,
    meaning: it.meaning,
    example: it.example,
    kind: "choice",
    options: [],
    chips: [],
    answer: it.phrase,
    prompt: "",
    main: "",
    sub: "",
    lang: "en",
  };
  const three = others.slice(0, 3);
  if (t === "mcPhrase") {
    q.prompt = "Which phrase means:";
    q.main = it.meaning;
    q.options = shuffle([it.phrase].concat(three.map((o) => o.phrase)), random);
  } else if (t === "mcMeaning") {
    q.prompt = "What does this phrase mean?";
    q.main = it.phrase;
    q.answer = it.meaning;
    q.options = shuffle([it.meaning].concat(three.map((o) => o.meaning)), random);
  } else if (t === "vi") {
    q.prompt = "Which English phrase matches this Vietnamese meaning?";
    q.main = it.vi;
    q.lang = "vi";
    q.options = shuffle([it.phrase].concat(three.map((o) => o.phrase)), random);
  } else if (t === "tf") {
    const truth = random() < 0.5;
    q.prompt = "True or false?";
    q.main = "“" + it.phrase + "” means “" + (truth ? it.meaning : others[0].meaning) + "”.";
    q.options = ["True", "False"];
    q.answer = truth ? "True" : "False";
  } else if (t === "fill") {
    q.kind = "type";
    q.prompt = "Type the missing phrase:";
    q.main = blankOut(it.example, it.phrase);
    q.sub = "Meaning: " + it.meaning;
  } else if (t === "gap") {
    const cands = gapCands(it);
    const w = cands[Math.floor(random() * cands.length)];
    const pool = gapPool(others, w);
    q.prompt = "Choose the missing word:";
    q.main = it.phrase
      .split(/\s+/)
      .map((x) => (x === w ? "_____" : x))
      .join(" ");
    q.sub = "Meaning: " + it.meaning;
    q.answer = w.toLowerCase();
    q.options = shuffle([w.toLowerCase()].concat(shuffle(pool, random).slice(0, 3)), random);
  } else if (t === "order") {
    const words = it.phrase.split(/\s+/);
    let ch = shuffle(words, random);
    let n = 0;
    while (ch.join(" ") === words.join(" ") && n++ < 6) ch = shuffle(words, random);
    q.kind = "order";
    q.prompt = "Put the words in the right order:";
    q.main = it.meaning;
    q.chips = ch;
  }
  return q;
}

/**
 * Generate `count` questions from `pool` (cycling if the pool is smaller), each with a random
 * enabled type that fits the phrase. Distractors come from the whole bank (`allItems`).
 * Fallback when no enabled type fits: multiple choice if ≥ 3 others exist, else True/False.
 */
export function genQuiz(
  pool: ReadonlyArray<PoolItem>,
  allItems: ReadonlyArray<PoolItem>,
  count: number,
  enabledTypes: ReadonlyArray<QuizType>,
  random: Random = Math.random,
): Question[] {
  const out: Question[] = [];
  if (!pool.length) return out;
  const order = shuffle(pool, random);
  for (let i = 0; i < count; i++) {
    const it = order[i % order.length];
    const others = shuffle(
      allItems.filter((x) => x.id !== it.id && x.meaning !== it.meaning),
      random,
    );
    const ok = enabledTypes.filter((t) => qApplicable(t, it, others));
    const t: QuizType = ok.length
      ? ok[Math.floor(random() * ok.length)]
      : others.length >= 3
        ? "mcPhrase"
        : "tf";
    out.push(makeQ(t, it, others, random));
  }
  return out;
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, seconds);
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return mm + ":" + (ss < 10 ? "0" : "") + ss;
}

/** "10 questions, 3.3 min" */
export function setupLabel(count: number, speed: Speed): string {
  const per = SPEED_SECONDS[speed];
  return count + " questions, " + Math.round(((count * per) / 60) * 10) / 10 + " min";
}

export function resultTitle(pct: number): string {
  return pct >= 90 ? "Excellent!" : pct >= 70 ? "Nice work!" : pct >= 50 ? "Getting there" : "Keep practising";
}

export function scoreColor(pct: number): string {
  return pct >= 80 ? "#16A34A" : pct >= 50 ? "#5B3FD9" : "#F0623A";
}
