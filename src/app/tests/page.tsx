import { Scores } from "@/components/progress/Scores";
import { listScores } from "@/lib/actions/scores";
import { today } from "@/lib/dates";

export default async function Page() {
  const scores = await listScores();
  return (
    <Scores
      today={today()}
      scores={scores.map((s) => ({
        id: s.id,
        date: s.date,
        listening: s.listening,
        reading: s.reading,
        writing: s.writing,
        speaking: s.speaking,
        overall: s.overall,
      }))}
    />
  );
}
