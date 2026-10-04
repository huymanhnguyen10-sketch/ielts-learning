/**
 * Import the tutor's spreadsheet ("IELTS Online Anh Huy.xlsx") into Band Up.
 *
 *   npx tsx scripts/import-sheet.ts [--file <path>] [--dry-run]
 *
 * Reading / Listening tabs → Phrase bank (column E vocab) + tip notes (Material kind "Note")
 *                            + Link materials for every hyperlink in D/F/G.
 * Writing tab              → Link materials for hyperlinks in D/F/G.
 * Speaking tab             → SpeakingQuestion rows (B questions + F answers + G related topics)
 *                            + tip notes from C/E + Link materials from D.
 *
 * Idempotent: SpeakingQuestion rows are keyed by `sourceRef`; phrases match on the phrase text
 * (case-insensitive); materials match on url (links) or title + skill (notes).
 */
import ExcelJS from "exceljs";
import { PrismaClient } from "@prisma/client";
import { today } from "../src/lib/dates";
import { TOPICS } from "../src/lib/topics";

// ───────────────────────────── CLI ─────────────────────────────

const argv = process.argv.slice(2);
const DRY = argv.includes("--dry-run");
const fileIdx = argv.indexOf("--file");
const FILE =
  fileIdx >= 0 && argv[fileIdx + 1] ? argv[fileIdx + 1] : "C:\\Users\\admin\\Downloads\\IELTS Online Anh Huy.xlsx";

// ───────────────────────────── Cell helpers ─────────────────────────────

interface CellData {
  text: string;
  links: string[];
}

function cellText(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    const o = v as unknown as Record<string, unknown>;
    if (Array.isArray(o.richText)) {
      return (o.richText as Array<{ text?: string }>).map((r) => r.text ?? "").join("");
    }
    if ("hyperlink" in o) return cellText(o.text as ExcelJS.CellValue);
    if ("formula" in o || "sharedFormula" in o) return cellText(o.result as ExcelJS.CellValue);
    if ("error" in o) return "";
  }
  return String(v);
}

const URL_RE = /https?:\/\/[^\s<>()"']+/gi;

function readCell(row: ExcelJS.Row, col: number): CellData {
  const cell = row.getCell(col);
  const raw = cell.value as unknown;
  const text = cellText(cell.value).replace(/\r\n?/g, "\n").replace(/\u00a0/g, " ");
  const links: string[] = [];
  const push = (u: unknown) => {
    if (typeof u === "string" && /^https?:\/\//i.test(u.trim())) {
      const clean = u.trim().replace(/[.,;)]+$/, "");
      if (!links.includes(clean)) links.push(clean);
    }
  };
  if (raw && typeof raw === "object" && "hyperlink" in (raw as object)) push((raw as { hyperlink?: string }).hyperlink);
  push((cell as unknown as { hyperlink?: string }).hyperlink);
  for (const m of text.match(URL_RE) ?? []) push(m);
  return { text: text.replace(/[ \t]+\n/g, "\n").trim(), links };
}

function firstLine(s: string): string {
  return (s.split("\n").map((l) => l.trim()).find((l) => l) ?? "").trim();
}

function clip(s: string, n: number): string {
  s = s.replace(/\s+/g, " ").trim();
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

function slug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "x";
}

function hostname(u: string): string {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
}

function lessonLabel(n: number | null): string {
  return n == null ? "?" : Number.isInteger(n) ? String(n) : String(n);
}

// ───────────────────────────── Topic mapping ─────────────────────────────

const TOPIC_RULES: Array<[string, string[]]> = [
  [
    "environment",
    ["ecosystem", "animal", "habitat", "bird", "insect", "forest", "dust", "glacier", "tiny forest", "easter island", "lake vostok", "wetland"],
  ],
  ["technology", ["robot", "mechanical", "mechanial", "intelligent", "electric bike", "battery"]],
  ["health", ["medicine", "maori", "pharmacy", "fitness", "swimming", "health"]],
  ["culture", ["goya", "portrait", "tea", "perfume", "sydney opera house", "roller coaster", "whale culture", "thames"]],
  ["work", ["job", "work", "lifeboat", "volunteer", "warranty", "customer"]],
  ["travel", ["holiday", "caravan", "island", "tour", "leisure centre", "bike hire"]],
  ["trends", ["number practice", "percentage"]],
];

const TOPIC_KEYS = new Set(TOPICS.map((t) => t[0]));

function mapTopic(text: string, skill: string): string {
  const t = text.toLowerCase();
  for (const [key, words] of TOPIC_RULES) {
    for (const w of words) {
      const re = new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:s|es|ing)?\\b`, "i");
      if (re.test(t)) return TOPIC_KEYS.has(key) ? key : "daily";
    }
  }
  return skill === "Reading" ? "science" : "daily";
}

// ───────────────────────────── Vocab / tips parser ─────────────────────────────

const VI_RE = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
const POS_RE = /^(n|v|adj|adv|phr|phrase|phrasal verb|prep|pron|conj|idiom|collocation|exp|expression|det|num|interj)\b/i;
const TIPS_HEADER_RE = /^\s*[*#_]*\s*tips?\b.*:\s*$/i;
const TIPS_INLINE_RE = /^\s*tips?\s*:/i;
const VOCAB_HEADER_RE = /^\s*(vocab(?:ulary)?|words?|phrases?)\s*:?\s*$/i;
const BULLET_RE = /^\s*[-•*–]\s*/;
const NUMBERED_RE = /^\s*\d+[.)]\s+/;
const CONTINUATION_RE = /^\s*(vd\s*:|e\.g\.|->|=>|ví dụ\s*:)/i;

interface ParsedVocab {
  phrase: string;
  pos: string;
  meaning: string;
  example: string;
}

/** Try to parse a single line as a vocab entry. */
function parseVocabLine(line: string): ParsedVocab | null {
  if (NUMBERED_RE.test(line)) return null; // numbered lists are notes, not vocab
  const body = line.replace(BULLET_RE, "").trim();
  const colon = body.indexOf(":");
  if (colon <= 0 || colon > 90) return null;
  const head = body.slice(0, colon).trim();
  const rest = body.slice(colon + 1).trim();
  if (!head || !rest) return null;
  if (/https?:\/\//i.test(body)) return null;

  // pos = first parenthetical that looks like a part-of-speech tag.
  let pos = "";
  const parens = [...head.matchAll(/\(([^)]{1,30})\)/g)];
  for (const p of parens) {
    const m = POS_RE.exec(p[1].trim());
    if (m) {
      pos = p[1].trim();
      break;
    }
  }
  // phrase = head up to the first "(", "=", "#", "><", "/ " separators that start a note.
  const cut = head.search(/\s*(\(|=|#|><)/);
  let phrase = (cut >= 0 ? head.slice(0, cut) : head).trim();
  let headRest = (cut >= 0 ? head.slice(cut) : "").trim();
  if (pos) headRest = headRest.replace(`(${pos})`, "").replace(/\s+/g, " ").trim();
  phrase = phrase.replace(/\s+/g, " ").replace(/[.,;]+$/, "").trim();
  if (!phrase || phrase.length > 60) return null;
  if (VI_RE.test(phrase)) return null; // the phrase itself must be English ("Bước 1", "Lưu ý" are notes)
  const words = phrase.split(/\s+/).length;
  if (!pos && !(VI_RE.test(rest) && words <= 6)) return null;
  if (!pos && !/[a-z]/i.test(phrase)) return null;
  if (words > 8) return null;

  // Split meaning / example.
  let meaning = rest;
  let example = "";
  const splitters: RegExp[] = [
    /\s*->\s*/,
    /\s*=>\s*/,
    /\s*\((?:ví dụ|vdu|vd|e\.g\.)\s*[:.]?\s*/i,
    /\s+#\s+(?=[A-Z][a-z])/,
    /\s*[-–]\s+(?=[A-Z][a-z])/,
    /\.\s+(?=[A-Z][a-z])/,
  ];
  for (const re of splitters) {
    const m = re.exec(meaning);
    if (m && m.index > 0) {
      const cand = meaning.slice(m.index + m[0].length).trim().replace(/\)\s*$/, "").trim();
      // Only accept as an example if it reads like English (no Vietnamese diacritics).
      if (cand && !VI_RE.test(cand) && /[a-z]/i.test(cand)) {
        example = cand;
        meaning = meaning.slice(0, m.index).trim();
        break;
      }
    }
  }
  meaning = meaning.replace(/[\s\-–:]+$/, "").trim();
  if (headRest) meaning = `${meaning} ${headRest}`.trim();
  if (pos) meaning = `(${pos}) ${meaning}`;
  return { phrase, pos, meaning, example };
}

interface TipBlock {
  title: string;
  lines: string[];
}

interface ParsedE {
  vocab: ParsedVocab[];
  tips: TipBlock[];
  unclassified: string[];
  labels: string[];
}

function isSectionHeader(line: string): boolean {
  return /:\s*$/.test(line) && !BULLET_RE.test(line) && line.replace(/:\s*$/, "").trim().split(/\s+/).length <= 8;
}

function isShortLabel(line: string): boolean {
  return !BULLET_RE.test(line) && !/[:.!?]/.test(line) && line.trim().split(/\s+/).length <= 6 && !NUMBERED_RE.test(line);
}

/** Parse the "Vocab Learnt / Tips & Tricks" cell with a small VOCAB | TIPS state machine. */
function parseVocabCell(text: string): ParsedE {
  const out: ParsedE = { vocab: [], tips: [], unclassified: [], labels: [] };
  const lines = text.split("\n");
  let mode: "VOCAB" | "TIPS" = "VOCAB";
  let tip: TipBlock | null = null;
  let notes: TipBlock | null = null;
  let last: ParsedVocab | null = null;

  // True when one of the next two non-empty lines is a vocab entry (a sub-topic label may sit between).
  const nextIsVocab = (i: number) => {
    let seen = 0;
    for (let j = i + 1; j < lines.length && seen < 2; j++) {
      if (!lines[j].trim()) continue;
      seen++;
      if (parseVocabLine(lines[j]) != null) return true;
    }
    return false;
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line) continue;

    if (TIPS_HEADER_RE.test(line) || TIPS_INLINE_RE.test(line)) {
      mode = "TIPS";
      tip = { title: line.replace(/[*#_]/g, "").replace(/:\s*$/, "").trim(), lines: [] };
      out.tips.push(tip);
      const after = line.replace(/^\s*tips?\s*:\s*/i, "");
      if (TIPS_INLINE_RE.test(line) && after && after !== line) tip.lines.push(after);
      last = null;
      continue;
    }
    if (VOCAB_HEADER_RE.test(line)) {
      mode = "VOCAB";
      out.labels.push(line);
      last = null;
      continue;
    }

    if (mode === "TIPS") {
      if (isSectionHeader(line) && nextIsVocab(i)) {
        mode = "VOCAB";
        out.labels.push(line);
        tip = null;
        last = null;
        continue;
      }
      tip!.lines.push(line);
      continue;
    }

    // VOCAB mode
    const v = parseVocabLine(line);
    if (v) {
      out.vocab.push(v);
      last = v;
      continue;
    }
    if ((isSectionHeader(line) || isShortLabel(line)) && nextIsVocab(i)) {
      out.labels.push(line);
      last = null;
      continue;
    }
    if (last && (CONTINUATION_RE.test(line) || /^\s{2,}/.test(raw)) ) {
      const ex = line.replace(CONTINUATION_RE, "").trim();
      last.example = last.example ? `${last.example} ${ex}` : ex;
      continue;
    }
    if (!notes) {
      notes = { title: "Notes", lines: [] };
      out.tips.push(notes);
    }
    notes.lines.push(line);
    out.unclassified.push(line);
    last = null;
  }
  out.tips = out.tips.filter((t) => t.lines.length);
  return out;
}

// ───────────────────────────── Speaking parsers ─────────────────────────────

interface SpQuestion {
  part: number;
  topic: string;
  num: number;
  question: string;
}

interface SpAnswerBlock {
  topic: string | null;
  items: Array<{ num: number; question: string; answer: string[] }>;
}

const PART_RE = /^\s*part\s*(\d)\s*[:.\-–]\s*(.+?)\s*$/i;
const QNUM_RE = /^\s*(\d+)\s*[.)]\s*(.*)$/;
const TOPIC_LABEL_RE = /^\s*topics?\s*:\s*(.+?)\s*$/i;

function parseQuestions(text: string): SpQuestion[] {
  const out: SpQuestion[] = [];
  let part = 1;
  let topic = "";
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const p = PART_RE.exec(line);
    if (p) {
      part = Number(p[1]) || 1;
      topic = p[2].trim();
      continue;
    }
    const q = QNUM_RE.exec(line);
    if (q && topic && q[2].trim()) {
      out.push({ part, topic, num: Number(q[1]), question: q[2].trim() });
    }
  }
  return out;
}

function parseAnswers(text: string): SpAnswerBlock[] {
  const blocks: SpAnswerBlock[] = [];
  let cur: SpAnswerBlock | null = null;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const p = PART_RE.exec(line);
    if (p) {
      cur = { topic: p[2].trim(), items: [] };
      blocks.push(cur);
      continue;
    }
    if (!cur) {
      cur = { topic: null, items: [] };
      blocks.push(cur);
    }
    const q = QNUM_RE.exec(line);
    if (q) {
      cur.items.push({ num: Number(q[1]), question: q[2].trim(), answer: [] });
      continue;
    }
    const item = cur.items[cur.items.length - 1];
    if (item) item.answer.push(line);
  }
  return blocks;
}

function normTopic(s: string): string {
  return s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();
}

function tokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2),
  );
}

function similarity(a: string, b: string): number {
  const A = tokens(a);
  const B = tokens(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / Math.max(A.size, B.size);
}

/** Find the learner's answer for a question. */
function findAnswer(q: SpQuestion, blocks: SpAnswerBlock[], topicCount: number): string {
  const answerOf = (it: SpAnswerBlock["items"][number]) => {
    // "1. Where is your hometown?" + answer lines, or "1. <answer text>" directly.
    if (it.question && similarity(it.question, q.question) >= 0.6) return it.answer.join("\n").trim();
    if (it.answer.length) return [it.question, ...it.answer].filter(Boolean).join("\n").trim();
    return it.question.trim();
  };
  // 1) same topic + number
  for (const b of blocks) {
    if (b.topic && normTopic(b.topic) === normTopic(q.topic)) {
      const it = b.items.find((x) => x.num === q.num);
      if (it) return answerOf(it);
    }
  }
  // 2) anonymous block when the question cell holds a single topic
  if (topicCount === 1) {
    for (const b of blocks) {
      if (!b.topic) {
        const it = b.items.find((x) => x.num === q.num);
        if (it) return answerOf(it);
      }
    }
  }
  // 3) question text similarity
  let best: { score: number; text: string } | null = null;
  for (const b of blocks) {
    for (const it of b.items) {
      const s = similarity(it.question, q.question);
      if (s >= 0.6 && (!best || s > best.score)) best = { score: s, text: it.answer.join("\n").trim() };
    }
  }
  return best?.text ?? "";
}

// ───────────────────────────── Collected output ─────────────────────────────

interface PhraseOut {
  phrase: string;
  meaning: string;
  example: string;
  source: string;
  sourceNote: string;
  topic: string;
  kind: string;
}

interface MaterialOut {
  title: string;
  skill: string;
  kind: "Note" | "Link";
  url: string | null;
  note: string;
}

interface SpeakingOut {
  part: number;
  topic: string;
  question: string;
  myAnswer: string;
  sampleUrl: string | null;
  sourceNote: string;
  sourceRef: string;
  sortOrder: number;
}

const phrases = new Map<string, PhraseOut>(); // key: lowercase phrase
const materials: MaterialOut[] = [];
const materialKeys = new Set<string>(); // "url:<u>" | "note:<skill>|<title>"
const noteBodies = new Set<string>(); // "<skill>|<note>" — identical notes imported once
const speaking = new Map<string, SpeakingOut>(); // key: sourceRef
const unclassified: string[] = [];
const labels: string[] = [];

function addPhrase(p: PhraseOut) {
  const key = p.phrase.toLowerCase();
  if (!p.phrase || !p.meaning) return;
  if (!phrases.has(key)) phrases.set(key, p);
}

function addNote(skill: string, title: string, note: string, lesson: string) {
  title = clip(title.replace(/:\s*$/, ""), 80);
  note = note.trim();
  if (!title || !note) return;
  const bodyKey = `${skill}|${note}`;
  if (noteBodies.has(bodyKey)) return;
  noteBodies.add(bodyKey);
  let key = `note:${skill}|${title}`;
  if (materialKeys.has(key)) {
    title = clip(`${title} · Lesson ${lesson}`, 80);
    key = `note:${skill}|${title}`;
    let n = 2;
    while (materialKeys.has(key)) {
      key = `note:${skill}|${title} (${n})`;
      n++;
    }
    if (n > 2) title = `${title} (${n - 1})`;
  }
  materialKeys.add(key);
  materials.push({ title, skill, kind: "Note", url: null, note });
}

const GENERIC_LINK_RE = /^(link|links|slide|slides|here|click here|x|url|truy cập|xem)\s*:?$/i;

function linkTitle(cellTextValue: string, topic: string, url: string): string {
  const fallback = clip(`${topic || "Tutor sheet"} – ${hostname(url)}`, 80);
  // Cells that spell out a URL are instructions ("Truy cập: https://…"), not a title.
  if (/https?:\/\//i.test(cellTextValue)) return fallback;
  const lines = cellTextValue
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !GENERIC_LINK_RE.test(l) && !/:\s*$/.test(l));
  if (!lines.length) return fallback;
  const joined = lines.join(" · ");
  if (joined.length <= 80) return joined;
  return lines[0].length <= 80 ? lines[0] : fallback;
}

function addLink(skill: string, url: string, title: string, lesson: string) {
  const key = `url:${url}`;
  if (materialKeys.has(key)) return;
  materialKeys.add(key);
  materials.push({ title: clip(title, 80), skill, kind: "Link", url, note: `From tutor sheet, lesson ${lesson}` });
}

// ───────────────────────────── Tab importers ─────────────────────────────

interface RowCtx {
  row: number;
  lesson: number | null;
  A: CellData;
  B: CellData;
  C: CellData;
  D: CellData;
  E: CellData;
  F: CellData;
  G: CellData;
}

function readRows(ws: ExcelJS.Worksheet): RowCtx[] {
  const rows: RowCtx[] = [];
  let lesson: number | null = null;
  ws.eachRow({ includeEmpty: false }, (row, rn) => {
    if (rn === 1) return;
    const A = readCell(row, 1);
    const n = parseFloat(A.text.replace(",", "."));
    if (A.text && !Number.isNaN(n)) lesson = n;
    const ctx: RowCtx = {
      row: rn,
      lesson,
      A,
      B: readCell(row, 2),
      C: readCell(row, 3),
      D: readCell(row, 4),
      E: readCell(row, 5),
      F: readCell(row, 6),
      G: readCell(row, 7),
    };
    if ([ctx.B, ctx.C, ctx.D, ctx.E, ctx.F, ctx.G].some((c) => c.text || c.links.length)) rows.push(ctx);
  });
  return rows;
}

function importLinks(skill: string, r: RowCtx, topic: string) {
  const lesson = lessonLabel(r.lesson);
  for (const cell of [r.D, r.F, r.G]) {
    for (const url of cell.links) addLink(skill, url, linkTitle(cell.text, topic, url), lesson);
  }
}

function importVocabTab(ws: ExcelJS.Worksheet, skill: "Reading" | "Listening") {
  const rows = readRows(ws);
  // lesson-level B/D text for continuation rows
  const lessonText = new Map<number, { B: string; D: string }>();
  for (const r of rows) {
    if (r.lesson != null && r.A.text) lessonText.set(r.lesson, { B: r.B.text, D: r.D.text });
  }
  for (const r of rows) {
    const lesson = lessonLabel(r.lesson);
    const lt = r.lesson != null ? lessonText.get(r.lesson) : undefined;
    const ownText = `${r.B.text}\n${r.D.text}`.trim();
    const topicText = ownText || `${lt?.B ?? ""}\n${lt?.D ?? ""}`;
    const topic = mapTopic(topicText, skill);
    const passage = firstLine(r.D.text) || firstLine(r.B.text) || firstLine(lt?.D ?? "") || firstLine(lt?.B ?? "");
    const sourceNote = clip(`Lesson ${lesson} · ${passage}`.replace(/ · $/, ""), 80);

    importLinks(skill, r, firstLine(r.B.text) || firstLine(lt?.B ?? "") || passage);

    if (!r.E.text) continue;
    const parsed = parseVocabCell(r.E.text);
    labels.push(...parsed.labels.map((l) => `${skill} r${r.row}: ${l}`));
    unclassified.push(...parsed.unclassified.map((l) => `${skill} r${r.row}: ${l}`));
    for (const v of parsed.vocab) {
      addPhrase({
        phrase: v.phrase,
        meaning: v.meaning,
        example: v.example,
        source: skill,
        sourceNote,
        topic,
        kind: skill === "Reading" || v.pos ? "academic" : "everyday",
      });
    }
    for (const t of parsed.tips) {
      const qtype = firstLine(r.C.text) || (t.title === "Notes" ? firstLine(r.B.text) : "") || t.title;
      addNote(skill, `${skill} tips · ${qtype} · Lesson ${lesson}`, t.lines.join("\n"), lesson);
    }
  }
}

function importWritingTab(ws: ExcelJS.Worksheet) {
  for (const r of readRows(ws)) importLinks("Writing", r, firstLine(r.B.text));
}

function importSpeakingTab(ws: ExcelJS.Worksheet) {
  const rows = readRows(ws);
  let sortOrder = 0;
  for (const r of rows) {
    const lesson = lessonLabel(r.lesson);
    const sourceNote = `Lesson ${lesson} (tutor sheet)`;
    const firstLink = r.D.links[0] ?? r.G.links[0] ?? null;

    // B: Part N: Topic + numbered questions, or a "Topic: X" label.
    const qs = parseQuestions(r.B.text);
    if (qs.length) {
      const blocks = parseAnswers(r.F.text);
      const topicCount = new Set(qs.map((q) => normTopic(q.topic))).size;
      for (const q of qs) {
        const ref = `xlsx:speaking:r${r.row}:${q.part}:${slug(q.topic)}:${q.num}`;
        speaking.set(ref, {
          part: q.part,
          topic: q.topic,
          question: q.question,
          myAnswer: findAnswer(q, blocks, topicCount),
          sampleUrl: null,
          sourceNote,
          sourceRef: ref,
          sortOrder: sortOrder++,
        });
      }
    } else {
      const label = TOPIC_LABEL_RE.exec(firstLine(r.B.text));
      if (label) {
        const name = label[1].trim();
        const ref = `xlsx:speaking:r${r.row}:1:${slug(name)}:0`;
        speaking.set(ref, {
          part: 1,
          topic: name,
          question: `Topic: ${name} — see sample questions`,
          myAnswer: "",
          sampleUrl: firstLink,
          sourceNote,
          sourceRef: ref,
          sortOrder: sortOrder++,
        });
      }
    }

    // G: related topics with a Google Doc link.
    if (r.G.text && !PART_RE.test(firstLine(r.G.text))) {
      const url = r.G.links[0] ?? null;
      for (const m of r.G.text.matchAll(/topic\s*(\d+)?\s*:\s*([^,\n]+)/gi)) {
        const num = m[1] ? Number(m[1]) : null;
        const name = m[2].trim().replace(/[.,;]+$/, "");
        if (!name) continue;
        const ref = `xlsx:speaking:r${r.row}:g:${num ?? slug(name)}`;
        speaking.set(ref, {
          part: 1,
          topic: name,
          question: `Topic${num != null ? ` ${num}` : ""}: ${name} — related questions & sample answers`,
          myAnswer: "",
          sampleUrl: url,
          sourceNote,
          sourceRef: ref,
          sortOrder: sortOrder++,
        });
      }
    }

    // E + C → tip notes (multi-line cells or substantial single lines).
    for (const cell of [r.E, r.C]) {
      const t = cell.text.trim();
      if (!t) continue;
      if (!t.includes("\n") && t.length < 60) continue; // short labels like "Câu hỏi về bản thân"
      addNote("Speaking", firstLine(t), t, lesson);
    }

    // D → slide links.
    for (const url of r.D.links) addLink("Speaking", url, linkTitle(r.D.text, firstLine(r.B.text), url), lesson);
  }
}

// ───────────────────────────── DB writes ─────────────────────────────

async function writeAll() {
  const prisma = new PrismaClient();
  const summary = {
    phrasesCreated: 0,
    phrasesUpdated: 0,
    materialsCreated: 0,
    materialsUpdated: 0,
    speakingCreated: 0,
    speakingUpdated: 0,
  };
  try {
    const existing = await prisma.phrase.findMany({ select: { id: true, phrase: true } });
    const byLower = new Map(existing.map((p) => [p.phrase.toLowerCase(), p.id]));
    const T = today();
    for (const p of phrases.values()) {
      const id = byLower.get(p.phrase.toLowerCase());
      if (id) {
        await prisma.phrase.update({
          where: { id },
          data: { meaning: p.meaning, example: p.example, sourceNote: p.sourceNote, topic: p.topic },
        });
        summary.phrasesUpdated++;
      } else {
        const created = await prisma.phrase.create({ data: { ...p, due: T } });
        byLower.set(p.phrase.toLowerCase(), created.id);
        summary.phrasesCreated++;
      }
    }

    for (const m of materials) {
      const found =
        (m.url ? await prisma.material.findFirst({ where: { url: m.url } }) : null) ??
        (await prisma.material.findFirst({ where: { title: m.title, skill: m.skill } }));
      if (found) {
        await prisma.material.update({
          where: { id: found.id },
          data: { title: m.title, kind: m.kind, url: m.url, note: m.note },
        });
        summary.materialsUpdated++;
      } else {
        await prisma.material.create({ data: { title: m.title, skill: m.skill, kind: m.kind, url: m.url, note: m.note } });
        summary.materialsCreated++;
      }
    }

    for (const q of speaking.values()) {
      const found = await prisma.speakingQuestion.findUnique({ where: { sourceRef: q.sourceRef } });
      if (found) {
        // Keep an answer the learner typed in the app unless the sheet has one.
        await prisma.speakingQuestion.update({
          where: { id: found.id },
          data: {
            part: q.part,
            topic: q.topic,
            question: q.question,
            myAnswer: q.myAnswer || found.myAnswer,
            sampleUrl: q.sampleUrl,
            sourceNote: q.sourceNote,
            sortOrder: q.sortOrder,
          },
        });
        summary.speakingUpdated++;
      } else {
        await prisma.speakingQuestion.create({ data: q });
        summary.speakingCreated++;
      }
    }
  } finally {
    await prisma.$disconnect();
  }
  return summary;
}

// ───────────────────────────── Main ─────────────────────────────

async function main() {
  console.log(`${DRY ? "[dry-run] " : ""}Reading ${FILE}`);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(FILE);

  for (const ws of wb.worksheets) {
    const name = ws.name.trim();
    if (/^reading$/i.test(name)) importVocabTab(ws, "Reading");
    else if (/^listening$/i.test(name)) importVocabTab(ws, "Listening");
    else if (/^writing$/i.test(name)) importWritingTab(ws);
    else if (/^speaking$/i.test(name)) importSpeakingTab(ws);
    else console.log(`Skipping unknown tab "${ws.name}"`);
  }

  console.log(`\nParsed: ${phrases.size} phrases, ${materials.length} materials, ${speaking.size} speaking questions`);

  if (DRY) {
    console.log("\n── Phrases ──");
    for (const p of phrases.values()) {
      console.log(
        `• [${p.source}/${p.kind}/${p.topic}] ${p.phrase} — ${p.meaning}${p.example ? ` | ex: ${p.example}` : ""} (${p.sourceNote})`,
      );
    }
    console.log("\n── Materials ──");
    for (const m of materials) {
      console.log(`• [${m.skill}/${m.kind}] ${m.title}${m.url ? ` → ${m.url}` : ""}`);
      if (m.kind === "Note") console.log(m.note.split("\n").map((l) => "    " + l).join("\n"));
    }
    console.log("\n── Speaking questions ──");
    for (const q of speaking.values()) {
      console.log(
        `• P${q.part} [${q.topic}] ${q.question}${q.sampleUrl ? ` → ${q.sampleUrl}` : ""}${
          q.myAnswer ? `\n    answer: ${clip(q.myAnswer, 110)}` : ""
        }  (${q.sourceRef})`,
      );
    }
  } else {
    const s = await writeAll();
    console.log(
      `\nPhrases: ${s.phrasesCreated} created, ${s.phrasesUpdated} updated` +
        `\nMaterials: ${s.materialsCreated} created, ${s.materialsUpdated} updated` +
        `\nSpeaking questions: ${s.speakingCreated} created, ${s.speakingUpdated} updated`,
    );
  }

  console.log(`\n── Section labels skipped (${labels.length}) ──`);
  for (const l of labels) console.log("  " + l);
  console.log(`\n── E-column lines not classified (${unclassified.length}) — filed under "Notes" tips ──`);
  for (const l of unclassified) console.log("  " + l);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
