"use server";

import { prisma } from "@/lib/db";
import { today } from "@/lib/dates";
import { wordCount } from "@/lib/ielts";
import { revalidatePath } from "next/cache";

export async function listDrafts() {
  return prisma.draft.findMany({ orderBy: { id: "desc" } });
}

export async function saveDraft(input: { task: number; prompt: string; text: string }) {
  const words = wordCount(input.text);
  if (!words) return { ok: false, message: "Write something first." };
  const task = input.task === 1 ? 1 : 2;
  await prisma.draft.create({
    data: { task, prompt: input.prompt || "", text: input.text, words, date: today() },
  });
  revalidatePath("/writing");
  return { ok: true, message: "Draft saved." };
}

export async function deleteDraft(id: number) {
  await prisma.draft.delete({ where: { id } }).catch(() => null);
  revalidatePath("/writing");
  return { ok: true, message: "Draft deleted." };
}
