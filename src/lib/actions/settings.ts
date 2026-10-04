"use server";

import { prisma } from "@/lib/db";
import { addDays, isYmd, today } from "@/lib/dates";
import { revalidatePath } from "next/cache";
import type { Settings } from "@prisma/client";

export async function getSettings(): Promise<Settings> {
  const existing = await prisma.settings.findUnique({ where: { id: 1 } });
  if (existing) return existing;
  return prisma.settings.create({ data: { id: 1, examDate: addDays(today(), 90) } });
}

export async function setTargetBand(delta: number) {
  const s = await getSettings();
  const next = Math.min(9, Math.max(4, Math.round((s.targetBand + delta) * 2) / 2));
  await prisma.settings.update({ where: { id: 1 }, data: { targetBand: next } });
  revalidatePath("/", "layout");
  return next;
}

export async function setExamDate(date: string) {
  if (!isYmd(date)) return { ok: false, message: "Pick a valid date." };
  await prisma.settings.update({ where: { id: 1 }, data: { examDate: date } });
  revalidatePath("/", "layout");
  return { ok: true, message: "Exam date saved." };
}

export async function setMinutesPerDay(min: number) {
  if (![15, 20, 30].includes(min)) return;
  await prisma.settings.update({ where: { id: 1 }, data: { minutesPerDay: min } });
  revalidatePath("/", "layout");
}

export async function setReviewMode(mode: "produce" | "recognize") {
  await prisma.settings.update({ where: { id: 1 }, data: { reviewMode: mode } });
}

export async function setWritingPrompt(task: 1 | 2, prompt: string) {
  await prisma.settings.update({
    where: { id: 1 },
    data: task === 1 ? { writingPrompt1: prompt } : { writingPrompt2: prompt },
  });
}

export async function setSpeakingNotes(notes: string) {
  await prisma.settings.update({ where: { id: 1 }, data: { speakingNotes: notes } });
}

export async function setTutorUseContext(on: boolean) {
  await prisma.settings.update({ where: { id: 1 }, data: { tutorUseContext: on } });
}
