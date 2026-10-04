// Seeds the official IELTS.org sample tasks from data/official/*.json into the
// Reading passage bank, Listening test bank and Writing prompt bank, and adds
// Library links to the official sources. Idempotent: upserts by sourceRef
// (Passage / ListeningTest / WritingPrompt) and by title+skill (Material).
//
//   npx tsx scripts/seed-official.ts      (or: npm run seed:official)

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import type { ListeningTestSeed, PassageSeed, WritingPromptSeed } from "../src/lib/content-types";

const prisma = new PrismaClient();
const DATA_DIR = resolve(__dirname, "..", "data", "official");

function loadJson<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(DATA_DIR, name), "utf8")) as T;
}

const OFFICIAL_NOTE =
  "Official free practice material from IELTS.org (jointly owned by the British Council, IDP and Cambridge University Press & Assessment).";

const LINKS: { title: string; skill: string; url: string }[] = [
  {
    title: "IELTS.org Academic Reading sample tasks (PDF)",
    skill: "Reading",
    url: "https://ielts.org/cdn/Sample-tests/ielts-academic-reading-sample-tasks-2023.pdf",
  },
  {
    title: "IELTS.org full interactive Academic Reading sample test",
    skill: "Reading",
    url: "https://demo-ielts.inspera.com/player/?assessmentRunId=131013388&context=exam",
  },
  {
    title: "IELTS.org Listening sample tasks (PDF)",
    skill: "Listening",
    url: "https://ielts.org/cdn/Sample-tests/ielts-listening-sample-tasks-2023.pdf",
  },
  {
    title: "IELTS.org full interactive Listening sample test",
    skill: "Listening",
    url: "https://demo-ielts.inspera.com/player/?assessmentRunId=131012334&context=exam",
  },
  {
    title: "IELTS.org Academic Writing sample tasks (PDF)",
    skill: "Writing",
    url: "https://ielts.org/cdn/Sample-tests/ielts-academic-writing-sample-tasks-2023.pdf",
  },
  {
    title: "IELTS.org Academic Writing example responses with band scores and examiner comments (PDF)",
    skill: "Writing",
    url: "https://ielts.org/cdn/computer-delivered-sample-tests-academic-writing/ielts-academic-writing-example-responses-to-parts-1-and-2-with-band-scores-and-examiner-comments.pdf",
  },
  {
    title: "IELTS.org full interactive Academic Writing sample test",
    skill: "Writing",
    url: "https://ielts.inspera.com/player/?assessmentRunId=131013741&context=exam",
  },
];

type Counts = { created: number; updated: number };

function assertSeeds(passages: PassageSeed[], tests: ListeningTestSeed[], prompts: WritingPromptSeed[]) {
  const seen = new Set<string>();
  const check = (ref: string, what: string) => {
    if (!ref || typeof ref !== "string") throw new Error(`${what}: missing sourceRef`);
    if (seen.has(ref)) throw new Error(`${what}: duplicate sourceRef ${ref}`);
    seen.add(ref);
  };
  const types = new Set(["tfng", "ynng", "mcq", "gap", "heading", "match"]);
  for (const p of passages) {
    check(p.sourceRef, "reading.json");
    if (!p.title || !p.text) throw new Error(`${p.sourceRef}: title/text required`);
    if (!Array.isArray(p.questions)) throw new Error(`${p.sourceRef}: questions must be an array`);
    for (const q of p.questions) {
      if (typeof q.n !== "number") throw new Error(`${p.sourceRef}: question n must be a number`);
      if (!types.has(q.type)) throw new Error(`${p.sourceRef} Q${q.n}: bad type ${q.type}`);
      if (!Array.isArray(q.answer) || q.answer.length === 0) throw new Error(`${p.sourceRef} Q${q.n}: answer[] required`);
      if ((q.type === "mcq" || q.type === "heading" || q.type === "match") && !q.options?.length)
        throw new Error(`${p.sourceRef} Q${q.n}: options required for ${q.type}`);
    }
  }
  for (const t of tests) {
    check(t.sourceRef, "listening.json");
    if (!t.title || typeof t.answerKey !== "string" || typeof t.note !== "string")
      throw new Error(`${t.sourceRef}: title/answerKey/note required`);
  }
  for (const w of prompts) {
    check(w.sourceRef, "writing.json");
    if (w.task !== 1 && w.task !== 2) throw new Error(`${w.sourceRef}: task must be 1 or 2`);
    if (!w.title || !w.prompt) throw new Error(`${w.sourceRef}: title/prompt required`);
  }
}

async function seedPassages(passages: PassageSeed[]): Promise<Counts> {
  const c: Counts = { created: 0, updated: 0 };
  for (const p of passages) {
    const data = {
      title: p.title,
      source: p.source,
      sourceUrl: p.sourceUrl ?? null,
      instructions: p.instructions,
      text: p.text,
      questionsJson: JSON.stringify(p.questions),
    };
    const existing = await prisma.passage.findUnique({ where: { sourceRef: p.sourceRef } });
    if (existing) {
      await prisma.passage.update({ where: { sourceRef: p.sourceRef }, data });
      c.updated++;
    } else {
      await prisma.passage.create({ data: { ...data, sourceRef: p.sourceRef } });
      c.created++;
    }
  }
  return c;
}

async function seedListening(tests: ListeningTestSeed[]): Promise<Counts> {
  const c: Counts = { created: 0, updated: 0 };
  for (const t of tests) {
    const data = {
      title: t.title,
      source: t.source,
      sourceUrl: t.sourceUrl ?? null,
      audioUrl: t.audioUrl ?? null,
      transcriptUrl: t.transcriptUrl ?? null,
      answerKey: t.answerKey,
      note: t.note,
    };
    const existing = await prisma.listeningTest.findUnique({ where: { sourceRef: t.sourceRef } });
    if (existing) {
      await prisma.listeningTest.update({ where: { sourceRef: t.sourceRef }, data });
      c.updated++;
    } else {
      await prisma.listeningTest.create({ data: { ...data, sourceRef: t.sourceRef } });
      c.created++;
    }
  }
  return c;
}

async function seedWriting(prompts: WritingPromptSeed[]): Promise<Counts> {
  const c: Counts = { created: 0, updated: 0 };
  for (const w of prompts) {
    const data = {
      task: w.task,
      title: w.title,
      prompt: w.prompt,
      imageUrl: w.imageUrl ?? null,
      modelAnswer: w.modelAnswer ?? "",
      source: w.source,
      sourceUrl: w.sourceUrl ?? null,
    };
    const existing = await prisma.writingPrompt.findUnique({ where: { sourceRef: w.sourceRef } });
    if (existing) {
      await prisma.writingPrompt.update({ where: { sourceRef: w.sourceRef }, data });
      c.updated++;
    } else {
      await prisma.writingPrompt.create({ data: { ...data, sourceRef: w.sourceRef } });
      c.created++;
    }
  }
  return c;
}

async function seedMaterials(): Promise<Counts> {
  const c: Counts = { created: 0, updated: 0 };
  for (const l of LINKS) {
    const existing = await prisma.material.findFirst({ where: { title: l.title, skill: l.skill } });
    if (existing) {
      await prisma.material.update({
        where: { id: existing.id },
        data: { kind: "Link", url: l.url, note: OFFICIAL_NOTE },
      });
      c.updated++;
    } else {
      await prisma.material.create({
        data: { title: l.title, skill: l.skill, kind: "Link", url: l.url, note: OFFICIAL_NOTE },
      });
      c.created++;
    }
  }
  return c;
}

async function main() {
  const passages: PassageSeed[] = loadJson<PassageSeed[]>("reading.json");
  const tests: ListeningTestSeed[] = loadJson<ListeningTestSeed[]>("listening.json");
  const prompts: WritingPromptSeed[] = loadJson<WritingPromptSeed[]>("writing.json");
  assertSeeds(passages, tests, prompts);

  const r = await seedPassages(passages);
  const l = await seedListening(tests);
  const w = await seedWriting(prompts);
  const m = await seedMaterials();

  const fmt = (name: string, total: number, c: Counts) =>
    `${name.padEnd(16)} ${String(total).padStart(3)} in file  ${c.created} created, ${c.updated} updated`;
  console.log(fmt("Passages", passages.length, r));
  console.log(fmt("ListeningTests", tests.length, l));
  console.log(fmt("WritingPrompts", prompts.length, w));
  console.log(fmt("Materials", LINKS.length, m));
  console.log(`Total created: ${r.created + l.created + w.created + m.created}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
