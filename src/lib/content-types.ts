// Shared shapes for the Reading passage bank, Listening test bank and Writing prompt bank.
// Passage.questionsJson is a JSON-encoded PassageQuestion[].

export type PassageQuestionType =
  | "tfng" // TRUE / FALSE / NOT GIVEN
  | "ynng" // YES / NO / NOT GIVEN
  | "mcq" // choose a letter from options (single answer, or `multi` for "choose TWO")
  | "gap" // type a word/phrase from the passage
  | "heading" // matching headings: options are "i …", "ii …"
  | "match"; // matching features / sentence endings: options are "A …", "B …"

export interface PassageQuestion {
  n: number; // question number as printed in the test
  type: PassageQuestionType;
  text: string; // the statement, sentence with "…………" blank, or item to match
  options?: string[]; // for mcq/heading/match, e.g. ["A the Chinese", "B the Indians"]
  answer: string[]; // accepted answers, compared case-insensitively after trimming;
  // for mcq/heading/match a single letter/numeral ("A", "iii");
  // for `multi` questions ALL letters that must be chosen (any order).
  multi?: boolean; // "Choose TWO letters" style
  wordLimit?: string; // e.g. "NO MORE THAN THREE WORDS"
}

export interface PassageSeed {
  sourceRef: string;
  title: string;
  source: string;
  sourceUrl?: string;
  instructions: string; // task rubric shown above the questions
  text: string; // passage text, paragraphs separated by blank lines; section letters "A", "B" kept at paragraph start
  questions: PassageQuestion[];
}

export interface ListeningTestSeed {
  sourceRef: string;
  title: string;
  source: string;
  sourceUrl?: string;
  audioUrl?: string;
  transcriptUrl?: string;
  answerKey: string; // one answer per line, alternatives separated by "/"
  note: string; // question paper summary / instructions / tapescript
}

export interface WritingPromptSeed {
  sourceRef: string;
  task: 1 | 2;
  title: string;
  prompt: string;
  imageUrl?: string;
  modelAnswer?: string;
  source: string;
  sourceUrl?: string;
}

/** Normalise an answer for comparison: lowercase, trim, collapse spaces, strip brackets/punctuation. */
export function normaliseAnswer(s: string): string {
  return s
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/[^a-z0-9£$.,:/\- ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Expand "(some) books" style optional-word keys into the set of accepted variants. */
export function expandKey(key: string): string[] {
  const parts = key.split("/").map((p) => p.trim()).filter(Boolean);
  const out = new Set<string>();
  for (const p of parts) {
    const withOptional = p.replace(/[()]/g, "");
    const withoutOptional = p.replace(/\([^)]*\)/g, "");
    out.add(normaliseAnswer(withOptional));
    out.add(normaliseAnswer(withoutOptional));
  }
  return [...out].filter(Boolean);
}

export function answerMatches(given: string, accepted: string[]): boolean {
  const g = normaliseAnswer(given);
  if (!g) return false;
  return accepted.some((a) => expandKey(a).includes(g));
}
