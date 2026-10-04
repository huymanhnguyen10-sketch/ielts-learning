"use server";

import { prisma } from "@/lib/db";
import { addDays, today } from "@/lib/dates";
import { KINDS, SOURCES, TOPICS } from "@/lib/topics";
import {
  checkSentence,
  dailyPlan,
  nextEase,
  nextInterval,
  type Grade,
  GRADES,
} from "@/lib/srs";
import { revalidatePath } from "next/cache";
import type { Phrase, Sentence } from "@prisma/client";
import { getSettings } from "./settings";

export type PhraseWithSentences = Phrase & { sentences: Sentence[] };

export async function listPhrases(): Promise<PhraseWithSentences[]> {
  return prisma.phrase.findMany({
    orderBy: { id: "desc" },
    include: { sentences: { orderBy: { id: "desc" } } },
  });
}

export async function getPhrase(id: number): Promise<PhraseWithSentences | null> {
  return prisma.phrase.findUnique({
    where: { id },
    include: { sentences: { orderBy: { id: "desc" } } },
  });
}

export interface NewPhraseInput {
  phrase: string;
  meaning: string;
  example?: string;
  source: string;
  sourceNote?: string;
  topic: string;
  kind: string;
  related?: string;
  /** Vietnamese meaning (optional, SPEC §6 "Translate & explain"). */
  vi?: string;
  /** Short Vietnamese explanation (optional). */
  viNote?: string;
}

export async function createPhrase(input: NewPhraseInput) {
  const phrase = (input.phrase || "").trim();
  const meaning = (input.meaning || "").trim();
  if (!phrase || !meaning) return { ok: false, message: "Enter the phrase and its meaning." };
  if (phrase.length > 120) return { ok: false, message: "Keep the phrase under 120 characters." };
  const source = SOURCES.includes(input.source as never) ? input.source : "Writing";
  const kind = KINDS.includes(input.kind as never) ? input.kind : "academic";
  const topic = TOPICS.some((t) => t[0] === input.topic) ? input.topic : "education";

  const dup = await prisma.phrase.findFirst({
    where: { phrase: { equals: phrase } },
  });
  const dupCi = dup ?? (await prisma.phrase.findMany({ select: { phrase: true } })).find(
    (p) => p.phrase.toLowerCase() === phrase.toLowerCase(),
  );
  if (dupCi) return { ok: false, message: "That phrase is already in your bank." };

  const created = await prisma.phrase.create({
    data: {
      phrase,
      meaning,
      example: (input.example || "").trim(),
      source,
      sourceNote: (input.sourceNote || "").trim(),
      topic,
      kind,
      related: (input.related || "").trim(),
      vi: (input.vi || "").trim().slice(0, 300),
      viNote: (input.viNote || "").trim().slice(0, 1000),
      due: today(),
    },
  });
  revalidatePath("/", "layout");
  const topicLabel = TOPICS.find((t) => t[0] === topic)?.[1] ?? topic;
  return { ok: true, message: `Saved “${phrase}” to ${topicLabel}.`, id: created.id };
}

export async function deletePhrase(id: number) {
  await prisma.phrase.delete({ where: { id } }).catch(() => null);
  revalidatePath("/", "layout");
  return { ok: true, message: "Phrase deleted." };
}

/** Save the (user-edited) Vietnamese meaning + explanation of a phrase (SPEC §6). */
export async function saveVietnamese(id: number, vi: string, viNote: string) {
  const p = await prisma.phrase.findUnique({ where: { id } });
  if (!p) return { ok: false, message: "Phrase not found." };
  const data = { vi: (vi || "").trim().slice(0, 300), viNote: (viNote || "").trim().slice(0, 1000) };
  await prisma.phrase.update({ where: { id }, data });
  revalidatePath("/", "layout");
  return { ok: true, message: "Vietnamese saved.", ...data };
}

export async function togglePhraseKind(id: number) {
  const p = await prisma.phrase.findUnique({ where: { id } });
  if (!p) return { ok: false, message: "Phrase not found." };
  const kind = p.kind === "everyday" ? "academic" : "everyday";
  await prisma.phrase.update({ where: { id }, data: { kind } });
  revalidatePath("/", "layout");
  return { ok: true, message: `Marked as ${kind === "everyday" ? "everyday" : "academic"}.`, kind };
}

/** Build today's review queue (SPEC §6 "Session queue"). Returns phrase ids. */
export async function buildQueue(): Promise<number[]> {
  const T = today();
  const settings = await getSettings();
  const p = dailyPlan(settings.minutesPerDay);
  const items = await prisma.phrase.findMany();

  const due = items
    .filter((i) => i.reps > 0 && i.due <= T)
    .sort((a, b) =>
      a.kind === b.kind ? (a.due < b.due ? -1 : a.due > b.due ? 1 : a.id - b.id) : a.kind === "academic" ? -1 : 1,
    );
  const everyCap = Math.max(1, Math.floor(p.reviewN * 0.3));
  let ev = 0;
  const rev: number[] = [];
  for (const i of due) {
    if (rev.length >= p.reviewN) break;
    if (i.kind === "everyday") {
      if (ev >= everyCap) continue;
      ev++;
    }
    rev.push(i.id);
  }
  const learnedToday = items.filter((i) => i.firstLearned === T).length;
  const newOnes = items
    .filter((i) => !i.reps)
    .sort((a, b) => (a.kind === b.kind ? a.id - b.id : a.kind === "academic" ? -1 : 1))
    .slice(0, Math.max(0, p.newN - learnedToday))
    .map((i) => i.id);
  return rev.concat(newOnes);
}

/** Apply a grade to a phrase. Returns the updated phrase. */
export async function ratePhrase(id: number, grade: Grade) {
  if (!GRADES.includes(grade)) throw new Error("Bad grade");
  const T = today();
  const item = await prisma.phrase.findUnique({ where: { id } });
  if (!item) return null;
  const iv = nextInterval(item, grade);
  const ease = nextEase(item.ease, grade);
  const updated = await prisma.phrase.update({
    where: { id },
    data: {
      interval: iv,
      ease,
      due: addDays(T, iv),
      reps: grade === "again" ? item.reps : item.reps + 1,
      firstLearned: item.firstLearned ?? (grade === "again" ? null : T),
    },
  });
  await prisma.reviewLog.create({ data: { phraseId: id, grade, date: T } });
  revalidatePath("/", "layout");
  return updated;
}

/** Sentence-practice ordering (SPEC §6). */
export async function sentenceQueue(): Promise<PhraseWithSentences[]> {
  const items = await listPhrases();
  return items.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "academic" ? -1 : 1;
    if (a.reps > 0 !== b.reps > 0) return a.reps > 0 ? -1 : 1;
    return a.sentences.length - b.sentences.length;
  });
}

export async function saveSentence(phraseId: number, text: string) {
  const item = await prisma.phrase.findUnique({ where: { id: phraseId } });
  if (!item) return { ok: false, message: "Phrase not found." };
  const r = checkSentence(item, text);
  if (!text.trim()) return { ok: false, message: r.msg };
  if (!r.ok)
    return { ok: false, message: r.msg + "\n\nFix the sentence so it contains the full phrase, then save." };
  await prisma.sentence.create({ data: { phraseId, text: text.trim(), date: today() } });
  revalidatePath("/", "layout");
  return { ok: true, message: "Sentence saved." };
}

export async function sentencesWrittenToday(): Promise<number> {
  return prisma.sentence.count({ where: { date: today() } });
}
