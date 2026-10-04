import {
  COUNT_OPTIONS,
  QUIZ_TYPE_KEYS,
  type PoolSource,
  type Question,
  type QuizType,
  type Speed,
} from "@/lib/quiz";

// Literal theme colours from the prototype (design/Main.dc.html).
export const C = {
  violet: "#5B3FD9",
  violetDark: "#3B2799",
  violetDeep: "#2A1B6B",
  violetMid: "#4B38A3",
  violetLine: "#6450C2",
  pink: "#E8488A",
  orange: "#FF9F43",
  yellow: "#FFD166",
  text: "#1E1B3A",
  muted: "#5B5775",
  line: "#E4E0F5",
  input: "#D3CCEE",
  track: "#ECE8FA",
  white: "#FFFFFF",
  green: "#16A34A",
  greenDark: "#166534",
  greenTint: "#E7F6EC",
  red: "#F0623A",
  redDark: "#9A3412",
  redTint: "#FEECE6",
  rust: "#C2410C",
} as const;

export type FlashFront = "phrase" | "meaning";

export interface PracticeSettings {
  source: PoolSource;
  topic: string;
  count: number;
  speed: Speed;
  types: Record<QuizType, boolean>;
}

export const DEFAULT_SETTINGS: PracticeSettings = {
  source: "all",
  topic: "All",
  count: 10,
  speed: "normal",
  types: { mcPhrase: true, mcMeaning: true, fill: true, tf: true, gap: true, order: true, vi: true },
};

export const SETTINGS_KEY = "bandup:practice";

const SOURCES: PoolSource[] = ["all", "learning", "new", "academic", "everyday"];

/** Read persisted setup settings; invalid or missing data yields null. */
export function readSettings(): PracticeSettings | null {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<Record<keyof PracticeSettings, unknown>>;
    const out: PracticeSettings = { ...DEFAULT_SETTINGS, types: { ...DEFAULT_SETTINGS.types } };
    if (typeof v.source === "string" && (SOURCES as string[]).includes(v.source)) out.source = v.source as PoolSource;
    if (typeof v.topic === "string" && v.topic) out.topic = v.topic;
    if (typeof v.count === "number" && (COUNT_OPTIONS as readonly number[]).includes(v.count)) out.count = v.count;
    if (v.speed === "relaxed" || v.speed === "normal" || v.speed === "fast") out.speed = v.speed;
    if (v.types && typeof v.types === "object") {
      const t = v.types as Record<string, unknown>;
      for (const k of QUIZ_TYPE_KEYS) if (typeof t[k] === "boolean") out.types[k] = t[k] as boolean;
      if (!QUIZ_TYPE_KEYS.some((k) => out.types[k])) out.types = { ...DEFAULT_SETTINGS.types };
    }
    return out;
  } catch {
    return null;
  }
}

export function writeSettings(s: PracticeSettings): void {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable: settings simply are not remembered */
  }
}

/** Selected/unselected pill colours (prototype `pill(on, col)`). */
export function pill(on: boolean, col: string): { background: string; color: string; borderColor: string } {
  return {
    background: on ? col : C.white,
    color: on ? C.white : C.text,
    borderColor: on ? col : C.input,
  };
}

export function kindStyle(kind: string): { bg: string; fg: string; label: string } {
  return kind === "everyday"
    ? { bg: "#FFEBDA", fg: "#8A4209", label: "Everyday / spoken" }
    : { bg: "#EEEAFE", fg: "#3B2799", label: "Academic" };
}

export interface Answer {
  correct: boolean;
  given: string;
}
export type AnswerMap = Record<number, Answer>;

export interface QuizResultState {
  questions: Question[];
  answers: AnswerMap;
  usedSeconds: number;
  right: number;
  wrongIds: number[];
  byType: Partial<Record<QuizType, [number, number]>>;
}

export const HEADING = { fontFamily: "var(--font-heading)" } as const;
