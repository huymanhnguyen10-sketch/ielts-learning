import { TutorPage } from "@/components/tutor/TutorPage";
import { listChats } from "@/lib/actions/chats";
import { getVocabCounts } from "@/lib/stats";
import { prisma } from "@/lib/db";
import { diffDays, today } from "@/lib/dates";
import { fmtBand } from "@/lib/ielts";

export default async function Page() {
  const [chats, vocab, latest, matCount] = await Promise.all([
    listChats(),
    getVocabCounts(),
    prisma.score.findFirst({ orderBy: [{ date: "desc" }, { id: "desc" }] }),
    prisma.material.count(),
  ]);
  const daysLeft = diffDays(today(), vocab.settings.examDate);
  const daysLabel =
    daysLeft > 1 ? `${daysLeft} days to go (≈ ${Math.round(daysLeft / 7)} weeks)` : daysLeft === 1 ? "Tomorrow — good luck!" : daysLeft === 0 ? "Test day!" : "Test date has passed";
  const chips = [
    `${vocab.total} phrases`,
    `${matCount} library items`,
    latest ? `Latest band ${fmtBand(latest.overall)}` : "No scores yet",
    `Target ${fmtBand(vocab.settings.targetBand)}`,
    daysLabel,
  ];
  return <TutorPage chats={chats} ctxChips={chips} initialUseContext={vocab.settings.tutorUseContext} />;
}
