"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { SpeakingQuestion } from "@prisma/client";

export async function listSpeakingQuestions(): Promise<SpeakingQuestion[]> {
  return prisma.speakingQuestion.findMany({
    orderBy: [{ part: "asc" }, { topic: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
  });
}

/** Autosaved from the Speaking page; no revalidation so typing stays smooth. */
export async function saveMyAnswer(id: number, text: string) {
  const q = await prisma.speakingQuestion.findUnique({ where: { id } });
  if (!q) return { ok: false, message: "Question not found." };
  await prisma.speakingQuestion.update({ where: { id }, data: { myAnswer: text.trim() } });
  return { ok: true, message: "Answer saved." };
}

export async function addSpeakingQuestion(input: { part: number; topic: string; question: string }) {
  const part = [1, 2, 3].includes(input.part) ? input.part : 1;
  const topic = (input.topic || "").trim();
  const question = (input.question || "").trim();
  if (!topic || !question) return { ok: false, message: "Enter a topic and the question." };
  if (topic.length > 60) return { ok: false, message: "Keep the topic under 60 characters." };
  if (question.length > 300) return { ok: false, message: "Keep the question under 300 characters." };

  const dup = await prisma.speakingQuestion.findFirst({ where: { part, question } });
  if (dup) return { ok: false, message: "That question is already in your bank." };

  const last = await prisma.speakingQuestion.findFirst({ orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  await prisma.speakingQuestion.create({
    data: { part, topic, question, sourceNote: "Added in app", sortOrder: (last?.sortOrder ?? 0) + 1 },
  });
  revalidatePath("/speaking");
  return { ok: true, message: `Added to Part ${part} · ${topic}.` };
}

export async function deleteSpeakingQuestion(id: number) {
  await prisma.speakingQuestion.delete({ where: { id } }).catch(() => null);
  revalidatePath("/speaking");
  return { ok: true, message: "Question removed." };
}
