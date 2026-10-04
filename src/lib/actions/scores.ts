"use server";

import { prisma } from "@/lib/db";
import { isYmd, today } from "@/lib/dates";
import { fmtBand, isValidBand, roundBand } from "@/lib/ielts";
import { revalidatePath } from "next/cache";

/** Newest first (by date, then id). */
export async function listScores() {
  return prisma.score.findMany({ orderBy: [{ date: "desc" }, { id: "desc" }] });
}

export async function addScore(input: {
  date?: string;
  listening: unknown;
  reading: unknown;
  writing: unknown;
  speaking: unknown;
}) {
  const vals = [input.listening, input.reading, input.writing, input.speaking];
  if (!vals.every(isValidBand)) return { ok: false, message: "Enter all four bands (0–9, steps of 0.5)." };
  const [l, r, w, s] = vals.map((v) => parseFloat(String(v)));
  const overall = roundBand((l + r + w + s) / 4);
  await prisma.score.create({
    data: {
      date: isYmd(input.date) ? input.date : today(),
      listening: l,
      reading: r,
      writing: w,
      speaking: s,
      overall,
    },
  });
  revalidatePath("/", "layout");
  return { ok: true, message: `Score saved · overall ${fmtBand(overall)}.` };
}

export async function removeScore(id: number) {
  await prisma.score.delete({ where: { id } }).catch(() => null);
  revalidatePath("/", "layout");
  return { ok: true, message: "Score deleted." };
}
