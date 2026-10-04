import { PhraseBank } from "@/components/vocab/PhraseBank";
import { listPhrases } from "@/lib/actions/phrases";

export default async function Page() {
  const items = await listPhrases();
  return <PhraseBank items={items} />;
}
