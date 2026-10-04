import { Reading } from "@/components/skills/Reading";
import { SkillMaterials } from "@/components/SkillMaterials";
import { getPassage, listPassages } from "@/lib/actions/content";
import { listMaterials } from "@/lib/actions/materials";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const passageId = Number.parseInt(one(sp.passage), 10);

  const [materials, passages, selected] = await Promise.all([
    listMaterials(),
    listPassages(),
    Number.isInteger(passageId) && passageId > 0 ? getPassage(passageId) : Promise.resolve(null),
  ]);

  return (
    <>
      <SkillMaterials skill="Reading" materials={materials.filter((m) => m.skill === "Reading")} />
      <Reading
        key={selected ? selected.id : "sample"}
        passages={passages.map((p) => ({ id: p.id, title: p.title, source: p.source }))}
        selected={
          selected
            ? {
                id: selected.id,
                title: selected.title,
                source: selected.source,
                sourceUrl: selected.sourceUrl,
                instructions: selected.instructions,
                text: selected.text,
                questions: selected.questions,
              }
            : null
        }
      />
    </>
  );
}
