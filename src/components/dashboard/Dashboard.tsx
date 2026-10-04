"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { PlanTask, Score } from "@prisma/client";
import { setExamDate, setMinutesPerDay } from "@/lib/actions/settings";
import { addTask, removeTask, toggleTask } from "@/lib/actions/plan";
import { fmtBand } from "@/lib/ielts";
import { dayName } from "@/lib/dates";
import { SKILL_COLOR } from "@/lib/topics";
import { SKILL_TINT } from "@/lib/page-colors";
import { useToast } from "../Toast";

export interface DashboardProps {
  today: string;
  minutes: number;
  examDate: string;
  daysLeft: number | null;
  targetBand: number;
  goalPhrases: number;
  vp: { newN: number; reviewN: number; sentenceN: number };
  reviewToday: number;
  newToday: number;
  sentToday: number;
  learned: number;
  total: number;
  academic: number;
  everyday: number;
  bySource: Record<string, number>;
  week: { date: string; n: number }[];
  plan: PlanTask[];
  latest: Score | null;
  materials: { total: number; studied: number };
}

const PHASES = [
  [0, 30, "Month 1", "Build your phrase bank by topic", "Focus on 1–2 common topics a week (Education, Environment, Technology, Work). Collect mostly from your Writing and Reading."],
  [30, 60, "Month 2", "Use phrases actively", "More sentence practice: at least 2 sentences per academic phrase. Put learned phrases into new essays."],
  [60, 999, "Month 3", "Consolidate before the exam", "Fewer new phrases, more review of hard cards. Use your phrase bank during mock tests."],
] as const;

const SOURCES: Array<[string, string]> = [
  ["Writing", "#F0623A"],
  ["Reading", "#2563EB"],
  ["Listening", "#0EA5B7"],
  ["Speaking", "#A855F7"],
];

/** Card with the 5px coloured top border used across the dashboard (SPEC §3). */
const topBar = (color: string) => ({ borderTop: `5px solid ${color}` });

const TILES: Array<[string, string, string]> = [
  ["/reading", "Reading", "Passages & question types"],
  ["/listening", "Listening", "Play audio, mark answers"],
  ["/writing", "Writing", "Timed Task 1 & Task 2"],
  ["/speaking", "Speaking", "Cue cards with timer"],
];

export function Dashboard(p: DashboardProps) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [minutes, setMinutes] = useState(p.minutes);
  const [newTask, setNewTask] = useState("");
  const [examDate, setExam] = useState(p.examDate);

  const cards = p.reviewToday + p.newToday;
  const planDone = p.plan.filter((t) => t.done).length;
  const latest = p.latest;
  const gap = latest ? p.targetBand - latest.overall : null;
  const elapsed = 90 - (p.daysLeft == null ? 90 : p.daysLeft);

  const daysLeftLabel =
    p.daysLeft == null
      ? "Set your test date"
      : p.daysLeft > 1
        ? `${p.daysLeft} days to go (≈ ${Math.round(p.daysLeft / 7)} weeks)`
        : p.daysLeft === 1
          ? "Tomorrow — good luck!"
          : p.daysLeft === 0
            ? "Test day!"
            : "Test date has passed";
  const gapLabel = !latest
    ? "Log a mock test to see where you stand"
    : gap! > 0
      ? `${fmtBand(gap)} below your target of ${fmtBand(p.targetBand)}`
      : "At or above your target";
  const perDayLabel =
    p.daysLeft != null && p.daysLeft > 0
      ? `About ${Math.ceil(Math.max(0, p.goalPhrases - p.learned) / p.daysLeft)} new phrases a day to stay on track`
      : "Set an exam date to plan";
  const maxSrc = Math.max(1, ...SOURCES.map(([s]) => p.bySource[s] || 0));

  const pickMinutes = (m: number) => {
    setMinutes(m);
    start(async () => {
      await setMinutesPerDay(m);
      router.refresh();
    });
  };

  const onExamDate = (v: string) => {
    setExam(v);
    if (!v) return;
    start(async () => {
      const r = await setExamDate(v);
      if (!r.ok) toast(r.message);
      router.refresh();
    });
  };

  const submitTask = () => {
    const t = newTask.trim();
    if (!t) return;
    setNewTask("");
    start(async () => {
      await addTask(t);
      router.refresh();
    });
  };

  const planSteps = [
    { step: "Step 1", value: p.reviewToday, label: "cards to review", time: `≈ ${Math.max(1, Math.round((p.reviewToday * 20) / 60))} min` },
    { step: "Step 2", value: p.newToday, label: "new phrases", time: `≈ ${Math.max(1, p.newToday)} min` },
    { step: "Step 3", value: Math.max(0, p.vp.sentenceN - p.sentToday), label: "sentences to write", time: `≈ ${p.vp.sentenceN * 2} min` },
  ];

  const skillBands = (["Listening", "Reading", "Writing", "Speaking"] as const).map((k) => {
    const v = latest ? (latest[k.toLowerCase() as "listening" | "reading" | "writing" | "speaking"] as number) : null;
    return { skill: k, label: latest ? fmtBand(v) : "No score yet", pct: latest && v != null ? (v / 9) * 100 : 0, color: SKILL_COLOR[k] };
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Today's vocabulary session */}
      <section className="flex flex-wrap items-center gap-6 rounded-[14px] bg-primary p-6 text-white">
        <div className="min-w-0" style={{ flex: "1 1 300px" }}>
          <div className="text-[13px] uppercase tracking-[0.08em] text-on-dark">Today&apos;s vocabulary session</div>
          <div className="mt-1.5 font-heading text-[26px] font-bold">
            {minutes} min · {cards} cards, {p.vp.sentenceN} sentences
          </div>
          <div className="mt-3.5 flex flex-wrap gap-1.5" role="group" aria-label="Study time">
            {[15, 20, 30].map((m) => {
              const on = minutes === m;
              return (
                <button
                  key={m}
                  className="btn"
                  onClick={() => pickMinutes(m)}
                  aria-pressed={on}
                  style={{ background: on ? "#FF9F43" : "#4B38A3", color: on ? "#1E1B3A" : "#FFFFFF", borderColor: on ? "#FF9F43" : "#6450C2" }}
                >
                  {m} min
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid min-w-0 gap-3" style={{ flex: "2 1 420px", gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
          {planSteps.map((s) => (
            <div key={s.step} className="rounded-[10px] bg-primary-hover p-3.5">
              <div className="text-xs text-on-dark">{s.step}</div>
              <div className="mt-1 font-heading text-[26px] font-bold">{s.value}</div>
              <div className="text-[13px] text-on-dark-2">{s.label}</div>
              <div className="mt-1.5 text-xs text-highlight">{s.time}</div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2.5" style={{ flex: "1 1 100%" }}>
          <Link href="/review" className="btn btn-accent" style={{ minHeight: 48, padding: "0 22px" }}>Start review</Link>
          <Link href="/sentence" className="btn btn-dark" style={{ minHeight: 48 }}>Practise sentences</Link>
        </div>
      </section>

      {/* Stat cards */}
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <div className="card p-5" style={topBar("#F0623A")}>
          <div className="text-[13px] font-semibold text-writing-dark">Exam date</div>
          <input className="inp mt-2" type="date" aria-label="Exam date" value={examDate} onChange={(e) => onExamDate(e.target.value)} />
          <div className="mt-2.5 font-heading text-xl font-semibold">{daysLeftLabel}</div>
        </div>
        <div className="card p-5" style={topBar("#2563EB")}>
          <div className="text-[13px] font-semibold text-reading">Latest overall band</div>
          <div className="mt-2 font-heading text-[44px] font-bold leading-none">{latest ? fmtBand(latest.overall) : "–"}</div>
          <div className="mt-2 text-sm text-muted">{gapLabel}</div>
        </div>
        <div className="card p-5" style={topBar("#E8488A")}>
          <div className="text-[13px] font-semibold text-vocab-dark">Phrases learned / 3-month goal</div>
          <div className="mt-2 font-heading text-4xl font-bold leading-none">
            {p.learned}
            <span className="text-lg text-muted"> / {p.goalPhrases}</span>
          </div>
          <div className="track mt-3">
            <div className="bg-vocab" style={{ width: `${Math.min(100, (p.learned / p.goalPhrases) * 100)}%` }} />
          </div>
          <div className="mt-2 text-[13px] text-muted">{perDayLabel}</div>
        </div>
        <div className="card p-5" style={topBar("#0EA5B7")}>
          <div className="text-[13px] font-semibold text-listening-dark">Library</div>
          <div className="mt-2 font-heading text-[44px] font-bold leading-none">{p.materials.total}</div>
          <div className="mt-2 text-sm text-muted">
            {p.materials.studied} studied · {p.materials.total - p.materials.studied} to go
          </div>
        </div>
      </div>

      {/* Plan + band by skill */}
      <div className="flex flex-wrap items-start gap-4">
        <section className="card min-w-0 p-5" style={{ flex: "1 1 380px", ...topBar("#16A34A") }}>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="m-0 font-heading text-xl font-semibold">Today&apos;s plan</h2>
            <span className="text-sm text-muted">{planDone} of {p.plan.length} done</span>
          </div>
          <div className="track mb-1.5 mt-3.5">
            <div className="bg-primary" style={{ width: `${p.plan.length ? (planDone / p.plan.length) * 100 : 0}%` }} />
          </div>
          <div className="flex flex-col">
            {p.plan.map((t) => (
              <label key={t.id} className="flex min-h-11 cursor-pointer items-center gap-3 border-b border-line-2 text-[15px]">
                <input
                  type="checkbox"
                  checked={t.done}
                  onChange={() => start(async () => { await toggleTask(t.id); router.refresh(); })}
                  className="h-[18px] w-[18px] accent-primary"
                />
                <span className="flex-1" style={{ textDecoration: t.done ? "line-through" : "none", color: t.done ? "#5B5775" : "#1E1B3A" }}>
                  {t.text}
                </span>
                <button
                  className="btn btn-sm"
                  aria-label="Delete task"
                  onClick={(e) => { e.preventDefault(); start(async () => { await removeTask(t.id); router.refresh(); }); }}
                >
                  Delete
                </button>
              </label>
            ))}
          </div>
          <div className="mt-3.5 flex gap-2">
            <input
              className="inp"
              aria-label="New task"
              placeholder="Add a task, e.g. Listening Section 3"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submitTask(); }}
            />
            <button className="btn btn-p" onClick={submitTask} disabled={pending}>Add</button>
          </div>
        </section>

        <section className="card min-w-0 p-5" style={{ flex: "1 1 380px", ...topBar("#2563EB") }}>
          <h2 className="m-0 font-heading text-xl font-semibold">Band by skill</h2>
          <p className="mb-4 mt-1.5 text-sm text-muted">From your latest mock test. The marker shows your target.</p>
          <div className="flex flex-col gap-4">
            {skillBands.map((b) => (
              <div key={b.skill}>
                <div className="mb-1.5 flex justify-between text-sm">
                  <span className="font-semibold">{b.skill}</span>
                  <span>{b.label}</span>
                </div>
                <div className="relative h-2.5 rounded-[5px] bg-track">
                  <div className="h-2.5 rounded-[5px]" style={{ background: b.color, width: `${b.pct}%` }} />
                  <div className="absolute w-0.5 bg-ink" style={{ top: -4, height: 18, left: `${(p.targetBand / 9) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
          <Link href="/tests" className="btn mt-[18px]">Log a mock test score</Link>
        </section>
      </div>

      {/* Roadmap */}
      <section className="card p-5" style={topBar("#FF9F43")}>
        <h2 className="mb-1 mt-0 font-heading text-xl font-semibold">3-month roadmap</h2>
        <p className="mb-4 mt-0 text-sm text-muted">15–30 minutes a day. Practise academic phrases deeply; everyday phrases only need recognition.</p>
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          {PHASES.map(([from, to, name, focus, detail]) => {
            const now = elapsed >= from && elapsed < to;
            return (
              <div key={name} className="rounded-[10px] p-4" style={{ border: `2px solid ${now ? "#5B3FD9" : "#E4E0F5"}`, background: now ? "#F7F5FF" : "#FFFFFF" }}>
                <div className="flex items-center justify-between gap-2">
                  <div className="font-heading text-base font-semibold">{name}</div>
                  {now && <span className="rounded-[10px] bg-primary px-2 py-0.5 text-xs font-semibold text-white">You are here</span>}
                </div>
                <div className="mt-1.5 text-sm font-semibold">{focus}</div>
                <div className="mt-1 text-[13px] leading-[1.55] text-muted">{detail}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Sources / split / week */}
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <section className="card p-5" style={topBar("#F0623A")}>
          <h2 className="mb-1 mt-0 font-heading text-lg font-semibold">Where your phrases come from</h2>
          <p className="mb-3.5 mt-0 text-[13px] text-muted">Collect most of them from your own Writing.</p>
          <div className="flex flex-col gap-3">
            {SOURCES.map(([label, color]) => {
              const n = p.bySource[label] || 0;
              return (
                <div key={label}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{label}</span>
                    <span className="font-semibold">{n}</span>
                  </div>
                  <div className="track">
                    <div style={{ background: color, width: `${(n / maxSrc) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
        <section className="card p-5" style={topBar("#5B3FD9")}>
          <h2 className="mb-1 mt-0 font-heading text-lg font-semibold">Academic vs everyday</h2>
          <p className="mb-3.5 mt-0 text-[13px] text-muted">Everyday phrases are reviewed half as often and fill at most 30% of a session.</p>
          <div className="flex h-3.5 overflow-hidden rounded-[7px] bg-track">
            <div className="bg-primary" style={{ width: `${p.total ? (p.academic / p.total) * 100 : 0}%` }} />
            <div className="bg-accent" style={{ width: `${p.total ? (p.everyday / p.total) * 100 : 0}%` }} />
          </div>
          <div className="mt-3 flex flex-col gap-1.5 text-sm">
            <span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-primary" />Academic: <strong>{p.academic}</strong></span>
            <span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-accent" />Everyday / spoken: <strong>{p.everyday}</strong></span>
          </div>
        </section>
        <section className="card p-5" style={topBar("#E8488A")}>
          <h2 className="mb-1 mt-0 font-heading text-lg font-semibold">Last 7 days</h2>
          <p className="mb-3.5 mt-0 text-[13px] text-muted">Cards reviewed per day.</p>
          <div className="flex gap-1.5">
            {p.week.map((d, i) => {
              const isToday = i === p.week.length - 1;
              const bg = d.n ? (isToday ? "#5B3FD9" : "#B7A8F5") : "#F0EDFA";
              const fg = d.n ? (isToday ? "#FFFFFF" : "#1E1B3A") : "#5B5775";
              return (
                <div key={d.date} className="flex-1 text-center">
                  <div className="flex h-9 items-center justify-center rounded-md text-xs font-semibold" style={{ background: bg, color: fg }}>
                    {d.n || ""}
                  </div>
                  <div className="mt-1 text-[11px] text-muted">{isToday ? "Today" : dayName(d.date)}</div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Skill tiles */}
      <section className="card p-5" style={topBar("#0EA5B7")}>
        <h2 className="mb-3.5 mt-0 font-heading text-xl font-semibold">Practise a skill</h2>
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          {TILES.map(([href, label, sub]) => (
            <Link
              key={href}
              href={href}
              className="btn flex-col items-start rounded-[10px] p-4 text-left"
              style={{ minHeight: 96, background: SKILL_TINT[label], borderColor: SKILL_COLOR[label] }}
            >
              <span className="h-1.5 w-8 rounded-[3px]" style={{ background: SKILL_COLOR[label] }} />
              <span className="font-heading text-[17px] font-semibold">{label}</span>
              <span className="text-[13px] font-normal text-muted">{sub}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
