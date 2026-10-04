import { Listening } from "@/components/skills/Listening";
import { SkillMaterials } from "@/components/SkillMaterials";
import { getListeningTest, listListeningTests } from "@/lib/actions/content";
import { listMaterials } from "@/lib/actions/materials";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const testId = Number.parseInt(one(sp.test), 10);

  const [materials, tests, selected] = await Promise.all([
    listMaterials(),
    listListeningTests(),
    Number.isInteger(testId) && testId > 0 ? getListeningTest(testId) : Promise.resolve(null),
  ]);

  const audios = materials
    .filter((m) => m.kind === "Audio" && !!m.url)
    .map((m) => ({ id: m.id, title: m.title, url: m.url as string }));

  return (
    <>
      <SkillMaterials skill="Listening" materials={materials.filter((m) => m.skill === "Listening")} />
      <Listening
        key={selected ? selected.id : "none"}
        audios={audios}
        tests={tests.map((t) => ({ id: t.id, title: t.title, source: t.source }))}
        selected={
          selected
            ? {
                id: selected.id,
                title: selected.title,
                source: selected.source,
                sourceUrl: selected.sourceUrl,
                audioUrl: selected.audioUrl,
                transcriptUrl: selected.transcriptUrl,
                answerKey: selected.answerKey,
                note: selected.note,
              }
            : null
        }
      />
    </>
  );
}
