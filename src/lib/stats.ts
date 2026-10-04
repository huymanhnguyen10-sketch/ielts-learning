// Read-only aggregates shared by the dashboard, sidebar badge and AI tutor context.
import { prisma } from "@/lib/db";
import { addDays, diffDays, today } from "@/lib/dates";
import { dailyPlan, status } from "@/lib/srs";
import { getSettings } from "@/lib/actions/settings";
import { fmtBand } from "@/lib/ielts";

export async function getVocabCounts() {
  const T = today();
  const settings = await getSettings();
  const vp = dailyPlan(settings.minutesPerDay);
  const items = await prisma.phrase.findMany({
    select: { reps: true, due: true, firstLearned: true, interval: true, kind: true, source: true },
  });
  const dueAll = items.filter((i) => i.reps > 0 && i.due <= T).length;
  const newAll = items.filter((i) => !i.reps).length;
  const learnedToday = items.filter((i) => i.firstLearned === T).length;
  const reviewToday = Math.min(vp.reviewN, dueAll);
  const newToday = Math.min(Math.max(0, vp.newN - learnedToday), newAll);
  const sentToday = await prisma.sentence.count({ where: { date: T } });
  return {
    settings,
    vp,
    total: items.length,
    dueAll,
    newAll,
    learnedToday,
    reviewToday,
    newToday,
    sentToday,
    learned: items.filter((i) => i.reps > 0).length,
    known: items.filter((i) => status(i) === "known").length,
    learning: items.filter((i) => status(i) === "learning").length,
    academic: items.filter((i) => i.kind === "academic").length,
    everyday: items.filter((i) => i.kind !== "academic").length,
    bySource: Object.fromEntries(
      ["Writing", "Reading", "Listening", "Speaking"].map((s) => [s, items.filter((i) => i.source === s).length]),
    ) as Record<string, number>,
  };
}

export async function getWeekHistory() {
  const T = today();
  const from = addDays(T, -6);
  const logs = await prisma.reviewLog.findMany({ where: { date: { gte: from } }, select: { date: true } });
  const counts: Record<string, number> = {};
  for (const l of logs) counts[l.date] = (counts[l.date] || 0) + 1;
  const week: { date: string; n: number }[] = [];
  for (let k = 6; k >= 0; k--) {
    const d = addDays(T, -k);
    week.push({ date: d, n: counts[d] || 0 });
  }
  return week;
}

export async function getDashboardData() {
  const T = today();
  const [vocab, week, plan, scores, materials] = await Promise.all([
    getVocabCounts(),
    getWeekHistory(),
    prisma.planTask.findMany({ orderBy: { id: "asc" } }),
    prisma.score.findMany({ orderBy: [{ date: "desc" }, { id: "desc" }], take: 20 }),
    prisma.material.findMany({ select: { studied: true } }),
  ]);
  const latest = scores[0] ?? null;
  const daysLeft = vocab.settings.examDate ? diffDays(T, vocab.settings.examDate) : null;
  return {
    today: T,
    vocab,
    week,
    plan,
    latest,
    daysLeft,
    materials: { total: materials.length, studied: materials.filter((m) => m.studied).length },
  };
}

/** Compact progress block for the AI tutor ("Use my progress as context"). */
export async function getTutorContext(page: string, essay?: string) {
  const T = today();
  const [vocab, scores, materials] = await Promise.all([
    getVocabCounts(),
    prisma.score.findMany({ orderBy: [{ date: "desc" }, { id: "desc" }], take: 5 }),
    prisma.material.findMany({ select: { studied: true, title: true, skill: true } }),
  ]);
  const latest = scores[0];
  const daysLeft = diffDays(T, vocab.settings.examDate);
  const lines: string[] = [];
  lines.push(`Today: ${T}. Page the learner is on: ${page}.`);
  lines.push(`Target band: ${fmtBand(vocab.settings.targetBand)}. Exam date: ${vocab.settings.examDate} (${daysLeft} days left).`);
  lines.push(`Study time: ${vocab.settings.minutesPerDay} min/day → ${vocab.vp.newN} new phrases, ${vocab.vp.reviewN} reviews, ${vocab.vp.sentenceN} sentences per day.`);
  if (latest) {
    const sk: Array<[string, number]> = [
      ["Listening", latest.listening], ["Reading", latest.reading], ["Writing", latest.writing], ["Speaking", latest.speaking],
    ];
    sk.sort((a, b) => a[1] - b[1]);
    lines.push(`Latest mock test (${latest.date}): L ${fmtBand(latest.listening)}, R ${fmtBand(latest.reading)}, W ${fmtBand(latest.writing)}, S ${fmtBand(latest.speaking)}, overall ${fmtBand(latest.overall)}. Weakest skill: ${sk[0][0]}.`);
    if (scores.length > 1) lines.push(`Score trend (newest first): ${scores.map((s) => `${s.date} ${fmtBand(s.overall)}`).join("; ")}.`);
  } else lines.push("No mock test scores logged yet.");
  lines.push(`Phrase bank: ${vocab.total} phrases (${vocab.learning} learning, ${vocab.known} known, ${vocab.newAll} not started; ${vocab.academic} academic, ${vocab.everyday} everyday). Due for review today: ${vocab.dueAll}. Sentences written today: ${vocab.sentToday}.`);
  lines.push(`Library: ${materials.length} items, ${materials.filter((m) => m.studied).length} studied.`);
  if (essay && essay.trim()) lines.push(`Current essay draft on the Writing page:\n"""\n${essay.trim().slice(0, 6000)}\n"""`);
  return lines.join("\n");
}
