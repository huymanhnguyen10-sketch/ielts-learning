import { Writing } from "@/components/skills/Writing";
import { SkillMaterials } from "@/components/SkillMaterials";
import { listWritingPrompts } from "@/lib/actions/content";
import { listDrafts } from "@/lib/actions/drafts";
import { listMaterials } from "@/lib/actions/materials";
import { getSettings } from "@/lib/actions/settings";

export default async function Page() {
  const [materials, settings, drafts, bank] = await Promise.all([
    listMaterials(),
    getSettings(),
    listDrafts(),
    listWritingPrompts(),
  ]);
  return (
    <>
      <SkillMaterials skill="Writing" materials={materials.filter((m) => m.skill === "Writing")} />
      <Writing
        prompts={{ 1: settings.writingPrompt1, 2: settings.writingPrompt2 }}
        bank={bank.map((b) => ({
          id: b.id,
          task: b.task === 1 ? 1 : 2,
          title: b.title,
          prompt: b.prompt,
          source: b.source,
          sourceUrl: b.sourceUrl,
          imageUrl: b.imageUrl,
          modelAnswer: b.modelAnswer,
        }))}
        drafts={drafts.map((d) => ({
          id: d.id,
          task: d.task === 1 ? 1 : 2,
          prompt: d.prompt,
          text: d.text,
          words: d.words,
          date: d.date,
        }))}
      />
    </>
  );
}
