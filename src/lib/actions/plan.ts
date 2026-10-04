"use server";

import { prisma } from "@/lib/db";
import { today } from "@/lib/dates";
import { revalidatePath } from "next/cache";

export async function listPlan() {
  return prisma.planTask.findMany({ orderBy: { id: "asc" } });
}

export async function addTask(text: string) {
  const t = (text || "").trim();
  if (!t) return { ok: false, message: "Type a task first." };
  await prisma.planTask.create({ data: { text: t, date: today() } });
  revalidatePath("/");
  return { ok: true, message: "Task added." };
}

export async function toggleTask(id: number) {
  const t = await prisma.planTask.findUnique({ where: { id } });
  if (!t) return;
  await prisma.planTask.update({ where: { id }, data: { done: !t.done } });
  revalidatePath("/");
}

export async function removeTask(id: number) {
  await prisma.planTask.delete({ where: { id } }).catch(() => null);
  revalidatePath("/");
}
