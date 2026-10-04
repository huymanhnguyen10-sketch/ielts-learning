import { Speaking } from "@/components/skills/Speaking";
import { SkillMaterials } from "@/components/SkillMaterials";
import { listMaterials } from "@/lib/actions/materials";
import { listPhrases } from "@/lib/actions/phrases";
import { getSettings } from "@/lib/actions/settings";
import { listSpeakingQuestions } from "@/lib/actions/speaking";

export default async function Page() {
  const [materials, settings, phrases, questions] = await Promise.all([
    listMaterials(),
    getSettings(),
    listPhrases(),
    listSpeakingQuestions(),
  ]);
  const everyday = phrases.filter((p) => p.kind === "everyday").slice(0, 8).map((p) => p.phrase);
  const speakingMaterials = materials.filter((m) => m.skill === "Speaking");
  const tips = speakingMaterials
    .filter((m) => m.kind === "Note" && m.note.trim())
    .sort((a, b) => a.id - b.id)
    .map((m) => ({ id: m.id, title: m.title, note: m.note }));
  return (
    <>
      <SkillMaterials skill="Speaking" materials={speakingMaterials} />
      <Speaking notes={settings.speakingNotes} everydayPhrases={everyday} questions={questions} tips={tips} />
    </>
  );
}
