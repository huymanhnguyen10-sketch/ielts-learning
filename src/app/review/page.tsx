import type { Phrase } from "@prisma/client";
import { ReviewSession } from "@/components/vocab/ReviewSession";
import { buildQueue, listPhrases } from "@/lib/actions/phrases";
import { getSettings } from "@/lib/actions/settings";

export default async function Page() {
  const [ids, phrases, settings] = await Promise.all([buildQueue(), listPhrases(), getSettings()]);
  const byId = new Map<number, Phrase>(
    phrases.map((p) => {
      const { sentences, ...plain } = p;
      void sentences;
      return [plain.id, plain];
    }),
  );
  const queue = ids.map((id) => byId.get(id)).filter((p): p is Phrase => !!p);
  const mode = settings.reviewMode === "recognize" ? "recognize" : "produce";
  return <ReviewSession queue={queue} mode={mode} />;
}
