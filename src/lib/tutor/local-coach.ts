// Offline fallback for the AI tutor when no ANTHROPIC_API_KEY is configured.
// Ported from the prototype's keyword replies, but computed from the real database.
import { prisma } from "@/lib/db";
import { diffDays, today } from "@/lib/dates";
import { fmtBand } from "@/lib/ielts";
import { blankOut, dailyPlan, status } from "@/lib/srs";
import { getSettings } from "@/lib/actions/settings";
import { wordCount } from "@/lib/ielts";

const ENABLE_NOTE =
  "\n\n—\nOffline coach: add ANTHROPIC_API_KEY to .env to get full answers from Claude.";

export async function localReply(text: string, opts: { essay?: string; lastAssistant?: string }) {
  const t = text.toLowerCase();
  const T = today();
  const settings = await getSettings();
  const [items, scores, materials] = await Promise.all([
    prisma.phrase.findMany(),
    prisma.score.findMany({ orderBy: [{ date: "desc" }, { id: "desc" }] }),
    prisma.material.findMany({ select: { studied: true } }),
  ]);
  const latest = scores[0];
  const learning = items.filter((d) => status(d) !== "known");
  const unstudied = materials.filter((m) => !m.studied).length;
  const days = settings.examDate ? diffDays(T, settings.examDate) : null;

  // Answer a pending quiz ("Which phrase means ...") from the previous turn.
  const quizMatch = opts.lastAssistant && /Which phrase means “(.+?)”\?/.exec(opts.lastAssistant);
  if (quizMatch) {
    const w = items.find((i) => i.meaning === quizMatch[1]);
    if (w) {
      return (
        `The phrase is “${w.phrase}”.\nExample: ${w.example || "—"}\n\nCompare it with your answer. Say “quiz me” for another one.` +
        ENABLE_NOTE
      );
    }
  }

  if (/quiz|vocab|word|phrase/.test(t)) {
    const acad = learning.filter((w) => w.kind === "academic");
    const pool = acad.length ? acad : learning;
    if (!pool.length) return "You know every phrase in your bank. Add new ones and I will quiz you on them." + ENABLE_NOTE;
    const w = pool[Math.floor(Math.random() * pool.length)];
    return (
      `Quick quiz (${pool.length} phrases still learning):\n\nWhich phrase means “${w.meaning}”?\nHint: ${blankOut(w.example, w.phrase)}` +
      ENABLE_NOTE
    );
  }
  if (/plan|path|schedule|focus|today|start|roadmap/.test(t)) {
    const p = dailyPlan(settings.minutesPerDay);
    const lines = ["Here is a study path based on what I can see:", ""];
    lines.push(`• Target: band ${fmtBand(settings.targetBand)}${latest ? `, latest overall ${fmtBand(latest.overall)}` : ""}`);
    if (days != null && days >= 0) lines.push(`• Time left: ${days} days`);
    if (latest) {
      const sk: Array<[string, number]> = [
        ["Listening", latest.listening], ["Reading", latest.reading], ["Writing", latest.writing], ["Speaking", latest.speaking],
      ];
      sk.sort((a, b) => a[1] - b[1]);
      lines.push(`• Main focus: ${sk[0][0]} (band ${fmtBand(sk[0][1])}). Practise it 3–4 times a week.`);
    } else lines.push("• First step: take a full mock test and log it, so I can find your weakest skill.");
    lines.push(`• Every day (${settings.minutesPerDay} min): ~${p.newN} new phrases, reviews, and ${p.sentenceN} sentences.`);
    lines.push("• Collect phrases mainly from your own Writing, then Reading and Listening.");
    lines.push(`• Library: ${unstudied} materials not studied yet.`);
    lines.push("• Every 2 weeks: another mock test to track progress.");
    return lines.join("\n") + ENABLE_NOTE;
  }
  if (/essay|writing|task 1|task 2|check my/.test(t)) {
    const essay = opts.essay || "";
    const words = wordCount(essay);
    if (!words)
      return (
        "Write or paste your essay in the Writing screen, then ask “check my essay”. I will review it against the four criteria: Task Response / Task Achievement, Coherence & Cohesion, Lexical Resource, and Grammatical Range & Accuracy." +
        ENABLE_NOTE
      );
    const low = essay.toLowerCase();
    const used = items.filter((i) => low.includes(i.phrase.toLowerCase())).map((i) => i.phrase);
    return (
      `Your draft has ${words} words${words < 250 ? ", below the 250-word Task 2 minimum (150 for Task 1)." : ", which meets the minimum."}\n` +
      (used.length ? `Phrases from your bank you used: ${used.join(", ")}.` : "You have not used any phrases from your bank yet. Try adding 2–3.") +
      "\n\nThings to check:\n• Is your position clear in the introduction and conclusion?\n• One main idea per paragraph, with a supporting example\n• Vary your linkers (however, as a result, in contrast)" +
      ENABLE_NOTE
    );
  }
  if (/not given|true|false|reading|skim|scan/.test(t))
    return (
      "True / False / Not Given:\n• TRUE: the passage says the same thing, often in different words.\n• FALSE: the passage says the opposite.\n• NOT GIVEN: the passage does not say. Don’t use your own knowledge.\n\nTip: answers follow the order of the passage. Find the keywords, then read that sentence closely." +
      ENABLE_NOTE
    );
  if (/listening|map|spelling|audio/.test(t))
    return (
      "Listening tips:\n• Read the questions before each section and predict the type of answer (number, name, place).\n• Watch the word limit, e.g. “NO MORE THAN TWO WORDS”.\n• Spelling counts. Practise names, dates and numbers.\n• If you miss one, move on. The audio only plays once." +
      ENABLE_NOTE
    );
  if (/speaking|cue card|part 2|part 1|part 3|fluency/.test(t))
    return (
      "Speaking Part 2:\n• Use your 1 minute of preparation for keywords, not sentences.\n• Cover each bullet point, then spend the most time on “explain why”.\n• Aim to talk for the full 2 minutes. Add a short story or example.\n• Drop in a few everyday phrases from your bank. They sound natural in speaking." +
      ENABLE_NOTE
    );
  if (/score|band|trend|progress/.test(t)) {
    if (!scores.length) return "No mock test scores yet. Log one in Mock tests & scores and I will track your trend." + ENABLE_NOTE;
    const first = scores[scores.length - 1];
    return (
      `You have ${scores.length} test(s) logged. Latest overall: ${fmtBand(latest.overall)}${scores.length > 1 ? ` (first: ${fmtBand(first.overall)})` : ""}. Target: ${fmtBand(settings.targetBand)}.` +
      ENABLE_NOTE
    );
  }
  return (
    "I can help more once Claude is connected. For now, try “make me a study plan”, “check my essay”, “explain True vs Not Given” or “quiz me on my phrases”." +
    ENABLE_NOTE
  );
}
