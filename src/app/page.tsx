import { Dashboard } from "@/components/dashboard/Dashboard";
import { getDashboardData } from "@/lib/stats";

export default async function Page() {
  const d = await getDashboardData();
  return (
    <Dashboard
      today={d.today}
      minutes={d.vocab.settings.minutesPerDay}
      examDate={d.vocab.settings.examDate}
      daysLeft={d.daysLeft}
      targetBand={d.vocab.settings.targetBand}
      goalPhrases={d.vocab.settings.goalPhrases}
      vp={d.vocab.vp}
      reviewToday={d.vocab.reviewToday}
      newToday={d.vocab.newToday}
      sentToday={d.vocab.sentToday}
      learned={d.vocab.learned}
      total={d.vocab.total}
      academic={d.vocab.academic}
      everyday={d.vocab.everyday}
      bySource={d.vocab.bySource}
      week={d.week}
      plan={d.plan}
      latest={d.latest}
      materials={d.materials}
    />
  );
}
