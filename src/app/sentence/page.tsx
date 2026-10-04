import { SentencePractice } from "@/components/vocab/SentencePractice";
import { sentenceQueue, sentencesWrittenToday } from "@/lib/actions/phrases";
import { getSettings } from "@/lib/actions/settings";
import { dailyPlan } from "@/lib/srs";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const [sp, queue, writtenToday, settings] = await Promise.all([
    searchParams,
    sentenceQueue(),
    sentencesWrittenToday(),
    getSettings(),
  ]);
  const raw = Array.isArray(sp.phrase) ? sp.phrase[0] : sp.phrase;
  const parsed = raw ? Number(raw) : NaN;
  const initialId = Number.isInteger(parsed) ? parsed : null;
  return (
    <SentencePractice
      key={initialId ?? "first"}
      queue={queue}
      writtenToday={writtenToday}
      goal={dailyPlan(settings.minutesPerDay).sentenceN}
      initialId={initialId}
    />
  );
}
