"use server";

import { prisma } from "@/lib/db";
import type { PassageQuestion, PassageQuestionType } from "@/lib/content-types";
import { revalidatePath } from "next/cache";
import type { ListeningTest, Passage, WritingPrompt } from "@prisma/client";

// ---------------------------------------------------------------------------
// Shared result shape + helpers
// ---------------------------------------------------------------------------

export type ActionResult = { ok: boolean; message: string };

const QUESTION_TYPES: ReadonlyArray<PassageQuestionType> = ["tfng", "ynng", "mcq", "gap", "heading", "match"];

function clean(s: string | undefined | null): string {
  return (s ?? "").trim();
}

function cleanUrl(s: string | undefined | null): string | null {
  const u = clean(s);
  if (!u) return null;
  if (/^\//.test(u) || /^https?:\/\//i.test(u)) return u;
  return "https://" + u;
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

/** Coerce one raw JSON entry into a PassageQuestion, or null when it is unusable. */
function toQuestion(raw: unknown, index: number): PassageQuestion | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const type = typeof r.type === "string" && (QUESTION_TYPES as ReadonlyArray<string>).includes(r.type)
    ? (r.type as PassageQuestionType)
    : null;
  if (!type) return null;
  const text = typeof r.text === "string" ? r.text : "";
  const answer = isStringArray(r.answer) ? r.answer : typeof r.answer === "string" ? [r.answer] : [];
  const n = typeof r.n === "number" && Number.isFinite(r.n) ? r.n : index + 1;
  const q: PassageQuestion = { n, type, text, answer };
  if (isStringArray(r.options)) q.options = r.options;
  if (r.multi === true) q.multi = true;
  if (typeof r.wordLimit === "string" && r.wordLimit.trim()) q.wordLimit = r.wordLimit;
  return q;
}

/** Parse Passage.questionsJson defensively: bad JSON or non-arrays yield []. */
function parseQuestions(json: string): PassageQuestion[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json || "[]");
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.map(toQuestion).filter((q): q is PassageQuestion => q !== null);
}

// ---------------------------------------------------------------------------
// Reading passages
// ---------------------------------------------------------------------------

export type PassageSummary = Pick<Passage, "id" | "title" | "source" | "createdAt">;
export type PassageFull = Passage & { questions: PassageQuestion[] };

export async function listPassages(): Promise<PassageSummary[]> {
  return prisma.passage.findMany({
    select: { id: true, title: true, source: true, createdAt: true },
    orderBy: [{ source: "asc" }, { id: "asc" }],
  });
}

export async function getPassage(id: number): Promise<PassageFull | null> {
  if (!Number.isInteger(id)) return null;
  const p = await prisma.passage.findUnique({ where: { id } });
  if (!p) return null;
  return { ...p, questions: parseQuestions(p.questionsJson) };
}

export async function addPassage(input: {
  title: string;
  source: string;
  sourceUrl?: string;
  text: string;
  instructions: string;
  questionsJson: string;
}): Promise<ActionResult> {
  const title = clean(input.title);
  const source = clean(input.source);
  const text = clean(input.text);
  if (!title) return { ok: false, message: "Give the passage a title." };
  if (!source) return { ok: false, message: "Say where the passage comes from." };
  if (!text) return { ok: false, message: "Paste the passage text." };

  const rawJson = clean(input.questionsJson) || "[]";
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return { ok: false, message: "Questions must be valid JSON." };
  }
  if (!Array.isArray(parsed)) return { ok: false, message: "Questions JSON must be an array." };

  await prisma.passage.create({
    data: {
      title,
      source,
      sourceUrl: cleanUrl(input.sourceUrl),
      text,
      instructions: clean(input.instructions),
      questionsJson: JSON.stringify(parsed),
    },
  });
  revalidatePath("/reading");
  return { ok: true, message: `Added “${title}” to the passage bank.` };
}

export async function deletePassage(id: number): Promise<ActionResult> {
  const r = await prisma.passage.delete({ where: { id } }).catch(() => null);
  revalidatePath("/reading");
  return r ? { ok: true, message: "Passage removed." } : { ok: false, message: "Passage not found." };
}

// ---------------------------------------------------------------------------
// Listening tests
// ---------------------------------------------------------------------------

export type ListeningTestSummary = Pick<ListeningTest, "id" | "title" | "source" | "createdAt">;

export async function listListeningTests(): Promise<ListeningTestSummary[]> {
  return prisma.listeningTest.findMany({
    select: { id: true, title: true, source: true, createdAt: true },
    orderBy: [{ source: "asc" }, { id: "asc" }],
  });
}

export async function getListeningTest(id: number): Promise<ListeningTest | null> {
  if (!Number.isInteger(id)) return null;
  return prisma.listeningTest.findUnique({ where: { id } });
}

export async function addListeningTest(input: {
  title: string;
  source: string;
  sourceUrl?: string;
  audioUrl?: string;
  transcriptUrl?: string;
  answerKey: string;
  note: string;
}): Promise<ActionResult> {
  const title = clean(input.title);
  const source = clean(input.source);
  if (!title) return { ok: false, message: "Give the test a title." };
  if (!source) return { ok: false, message: "Say where the test comes from." };
  const answerKey = clean(input.answerKey);
  const sourceUrl = cleanUrl(input.sourceUrl);
  if (!answerKey && !sourceUrl) {
    return { ok: false, message: "Add an answer key or a link to the test." };
  }

  await prisma.listeningTest.create({
    data: {
      title,
      source,
      sourceUrl,
      audioUrl: cleanUrl(input.audioUrl),
      transcriptUrl: cleanUrl(input.transcriptUrl),
      answerKey,
      note: clean(input.note),
    },
  });
  revalidatePath("/listening");
  return { ok: true, message: `Added “${title}” to the test bank.` };
}

export async function deleteListeningTest(id: number): Promise<ActionResult> {
  const r = await prisma.listeningTest.delete({ where: { id } }).catch(() => null);
  revalidatePath("/listening");
  return r ? { ok: true, message: "Test removed." } : { ok: false, message: "Test not found." };
}

// ---------------------------------------------------------------------------
// Writing prompts
// ---------------------------------------------------------------------------

export async function listWritingPrompts(task?: 1 | 2): Promise<WritingPrompt[]> {
  return prisma.writingPrompt.findMany({
    where: task ? { task } : undefined,
    orderBy: [{ task: "asc" }, { source: "asc" }, { id: "asc" }],
  });
}

export async function getWritingPrompt(id: number): Promise<WritingPrompt | null> {
  if (!Number.isInteger(id)) return null;
  return prisma.writingPrompt.findUnique({ where: { id } });
}

export async function addWritingPrompt(input: {
  task: number;
  title: string;
  prompt: string;
  source: string;
  sourceUrl?: string;
  imageUrl?: string;
  modelAnswer?: string;
}): Promise<ActionResult> {
  const task = input.task === 1 ? 1 : input.task === 2 ? 2 : null;
  if (!task) return { ok: false, message: "Task must be 1 or 2." };
  const title = clean(input.title);
  const prompt = clean(input.prompt);
  const source = clean(input.source);
  if (!title) return { ok: false, message: "Give the prompt a title." };
  if (!prompt) return { ok: false, message: "Paste the prompt text." };
  if (!source) return { ok: false, message: "Say where the prompt comes from." };

  await prisma.writingPrompt.create({
    data: {
      task,
      title,
      prompt,
      source,
      sourceUrl: cleanUrl(input.sourceUrl),
      imageUrl: cleanUrl(input.imageUrl),
      modelAnswer: clean(input.modelAnswer),
    },
  });
  revalidatePath("/writing");
  return { ok: true, message: `Added “${title}” to the Task ${task} prompt bank.` };
}

export async function deleteWritingPrompt(id: number): Promise<ActionResult> {
  const r = await prisma.writingPrompt.delete({ where: { id } }).catch(() => null);
  revalidatePath("/writing");
  return r ? { ok: true, message: "Prompt removed." } : { ok: false, message: "Prompt not found." };
}
