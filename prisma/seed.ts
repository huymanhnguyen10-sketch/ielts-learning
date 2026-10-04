// Seeds the single Settings row, a starter daily plan and (dev only) the 12
// sample phrases from the prototype. Safe to run more than once.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function ymd(d: Date) {
  const m = d.getMonth() + 1;
  const dd = d.getDate();
  return `${d.getFullYear()}-${m < 10 ? "0" : ""}${m}-${dd < 10 ? "0" : ""}${dd}`;
}
function addDays(s: string, n: number) {
  const d = new Date(s + "T00:00:00");
  d.setDate(d.getDate() + n);
  return ymd(d);
}

async function main() {
  const T = ymd(new Date());

  await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, examDate: addDays(T, 90) },
  });

  if ((await prisma.planTask.count()) === 0) {
    await prisma.planTask.createMany({
      data: [
        { text: "Vocabulary session (20 min)", date: T },
        { text: "One Reading passage — save 3 phrases", date: T },
        { text: "Listening Section 2", date: T },
        { text: "Speaking Part 2 practice", date: T },
      ],
    });
  }

  const wantSamples = (process.env.SEED_SAMPLE_PHRASES || "").toLowerCase() === "true";
  if (wantSamples && (await prisma.phrase.count()) === 0) {
    const mk = (
      phrase: string, meaning: string, example: string, source: string, sourceNote: string,
      topic: string, kind: string, related: string, reps: number, interval: number, dueIn: number,
    ) => ({
      phrase, meaning, example, source, sourceNote, topic, kind, related, reps, interval,
      ease: 2.5, due: addDays(T, dueIn), firstLearned: reps ? addDays(T, -6) : null,
      createdAt: new Date(addDays(T, -7) + "T09:00:00"),
    });
    await prisma.phrase.createMany({
      data: [
        mk("have a detrimental effect on", "to cause harm to", "Air pollution has a detrimental effect on public health.", "Writing", "My Task 2 essay", "environment", "academic", "adverse effect, negative impact", 2, 3, 0),
        mk("play a pivotal role in", "to be very important in", "Teachers play a pivotal role in shaping young people’s values.", "Reading", "", "education", "academic", "play a key role in", 1, 1, 0),
        mk("bridge the gap between", "to reduce the difference between", "Free online courses can bridge the gap between rich and poor students.", "Writing", "My Task 2 essay", "education", "academic", "narrow the gap", 0, 0, 0),
        mk("a steady increase in", "a regular, continuous rise in", "There was a steady increase in the number of visitors between 2010 and 2015.", "Writing", "Task 1 line graph", "trends", "academic", "a gradual rise, a sharp decline", 0, 0, 0),
        mk("raise awareness of", "to make people know more about", "Governments should run campaigns to raise awareness of recycling.", "Writing", "", "environment", "academic", "draw attention to", 1, 1, 0),
        mk("pose a threat to", "to be a danger to", "Rising sea levels pose a threat to coastal cities.", "Reading", "", "environment", "academic", "put something at risk", 0, 0, 0),
        mk("have access to", "to be able to use or get", "Many rural children do not have access to the internet.", "Reading", "", "technology", "academic", "gain access to", 2, 4, 1),
        mk("work-life balance", "a healthy split between work and personal life", "Flexible hours help employees achieve a better work-life balance.", "Listening", "", "work", "everyday", "", 0, 0, 0),
        mk("take something for granted", "to not value something because you always have it", "We often take clean water for granted.", "Listening", "", "society", "everyday", "", 1, 3, 0),
        mk("keep in touch with", "to stay in contact with", "Social media helps me keep in touch with old friends.", "Listening", "", "daily", "everyday", "stay in touch", 0, 0, 0),
        mk("in the long run", "over a long period of time", "In the long run, investing in education benefits the whole country.", "Speaking", "", "daily", "everyday", "in the long term", 1, 6, 2),
        mk("make ends meet", "to have just enough money to live", "Many students work part-time to make ends meet.", "Listening", "", "work", "everyday", "", 0, 0, 0),
      ],
    });
    console.log("Seeded 12 sample phrases.");
  }
  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
