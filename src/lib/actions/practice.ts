"use server";

import { prisma } from "@/lib/db";
import { today } from "@/lib/dates";
import { isQuizType, type PoolItem, type QuizType, type Speed } from "@/lib/quiz";
import { revalidatePath } from "next/cache";

export interface QuizResultRow {
  id: number;
  date: string; // local "YYYY-MM-DD HH:mm"
  right: number;
  total: number;
  speed: Speed;
  usedSeconds: number;
  types: QuizType[];
  byType: Partial<Record<QuizType, [number, number]>>;
  wrongPhraseIds: number[];
}

function parseJson<T>(s: string, fallback: T): T {
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

function asSpeed(s: string): Speed {
  return s === "relaxed" || s === "fast" ? s : "normal";
}

export async function getPracticeData(): Promise<{ items: PoolItem[]; history: QuizResultRow[] }> {
  const [phrases, results] = await Promise.all([
    prisma.phrase.findMany({
      orderBy: { id: "asc" },
      select: {
        id: true,
        phrase: true,
        meaning: true,
        example: true,
        topic: true,
        kind: true,
        reps: true,
        interval: true,
        vi: true,
      },
    }),
    prisma.quizResult.findMany({ orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 20 }),
  ]);
  const history: QuizResultRow[] = results.map((r) => {
    const types = parseJson<unknown>(r.typesJson, []);
    const byTypeRaw = parseJson<Record<string, unknown>>(r.byTypeJson, {});
    const byType: Partial<Record<QuizType, [number, number]>> = {};
    for (const k of Object.keys(byTypeRaw)) {
      const v = byTypeRaw[k];
      if (isQuizType(k) && Array.isArray(v) && v.length === 2)
        byType[k] = [Number(v[0]) || 0, Number(v[1]) || 0];
    }
    const wrong = parseJson<unknown>(r.wrongPhraseIds, []);
    return {
      id: r.id,
      date: r.date,
      right: r.right,
      total: r.total,
      speed: asSpeed(r.speed),
      usedSeconds: r.usedSeconds,
      types: Array.isArray(types) ? types.filter((t): t is QuizType => typeof t === "string" && isQuizType(t)) : [],
      byType,
      wrongPhraseIds: Array.isArray(wrong) ? wrong.filter((x): x is number => typeof x === "number") : [],
    };
  });
  return { items: phrases, history };
}

export interface SaveQuizInput {
  right: number;
  total: number;
  speed: Speed;
  usedSeconds: number;
  types: QuizType[];
  byType: Partial<Record<QuizType, [number, number]>>;
  wrongPhraseIds: number[];
}

/** Local "YYYY-MM-DD HH:mm" (the prototype's `when`). */
function nowStamp(): string {
  const d = new Date();
  const hh = d.getHours();
  const mi = d.getMinutes();
  return today() + " " + (hh < 10 ? "0" : "") + hh + ":" + (mi < 10 ? "0" : "") + mi;
}

export async function saveQuizResult(input: SaveQuizInput): Promise<{ ok: boolean; id: number }> {
  const total = Math.max(0, Math.floor(Number(input.total) || 0));
  const right = Math.min(total, Math.max(0, Math.floor(Number(input.right) || 0)));
  const types = (input.types || []).filter((t) => isQuizType(t));
  const byType: Partial<Record<QuizType, [number, number]>> = {};
  for (const k of Object.keys(input.byType || {})) {
    const v = input.byType[k as QuizType];
    if (isQuizType(k) && v) byType[k] = [Math.floor(v[0]) || 0, Math.floor(v[1]) || 0];
  }
  const wrong = Array.from(
    new Set((input.wrongPhraseIds || []).filter((x) => Number.isInteger(x) && x > 0)),
  );
  const created = await prisma.quizResult.create({
    data: {
      date: nowStamp(),
      right,
      total,
      speed: asSpeed(input.speed),
      usedSeconds: Math.max(0, Math.floor(Number(input.usedSeconds) || 0)),
      typesJson: JSON.stringify(types),
      byTypeJson: JSON.stringify(byType),
      wrongPhraseIds: JSON.stringify(wrong),
    },
  });
  revalidatePath("/practice");
  return { ok: true, id: created.id };
}

/**
 * "Add mistakes to today's review": phrases that have been reviewed before (reps > 0) become due
 * today with their interval capped at 1 day. New phrases are left alone (they enter via the new queue).
 */
export async function addWrongToReview(ids: number[]): Promise<{ ok: boolean; message: string }> {
  const clean = Array.from(new Set((ids || []).filter((x) => Number.isInteger(x) && x > 0)));
  if (!clean.length) return { ok: false, message: "Nothing to add." };
  const T = today();
  const items = await prisma.phrase.findMany({
    where: { id: { in: clean }, reps: { gt: 0 } },
    select: { id: true, interval: true },
  });
  await prisma.$transaction(
    items.map((i) =>
      prisma.phrase.update({
        where: { id: i.id },
        data: { due: T, interval: Math.min(i.interval, 1) },
      }),
    ),
  );
  revalidatePath("/", "layout");
  return {
    ok: true,
    message: clean.length + (clean.length === 1 ? " phrase" : " phrases") + " added to today's review.",
  };
}
