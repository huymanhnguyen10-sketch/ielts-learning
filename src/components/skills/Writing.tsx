"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Timer } from "@/components/Timer";
import { useToast } from "@/components/Toast";
import { storeEssayForTutor } from "@/components/tutor/useChat";
import { deleteDraft, saveDraft } from "@/lib/actions/drafts";
import { setWritingPrompt } from "@/lib/actions/settings";
import { today } from "@/lib/dates";
import { wordCount } from "@/lib/ielts";

export type WritingTask = 1 | 2;

export interface DraftItem {
  id: number;
  task: WritingTask;
  prompt: string;
  text: string;
  words: number;
  date: string;
}

export interface BankPrompt {
  id: number;
  task: WritingTask;
  title: string;
  prompt: string;
  source: string;
  sourceUrl: string | null;
  imageUrl: string | null;
  modelAnswer: string;
}

interface Props {
  prompts: Record<WritingTask, string>;
  drafts: DraftItem[];
  bank: BankPrompt[];
}

type Criterion = [key: string, name: string, hint: string];

const CRITERIA: Record<WritingTask, Criterion[]> = {
  1: [
    ["ta", "Task Achievement", "Clear overview; key features compared"],
    ["cc", "Coherence & Cohesion", "Logical paragraphs, varied linkers"],
    ["lr", "Lexical Resource", "Precise trend and comparison language"],
    ["gra", "Grammatical Range & Accuracy", "Mix of complex sentences, few errors"],
  ],
  2: [
    ["tr", "Task Response", "All parts answered; clear position"],
    ["cc", "Coherence & Cohesion", "One main idea per paragraph"],
    ["lr", "Lexical Resource", "Topic phrases and collocations"],
    ["gra", "Grammatical Range & Accuracy", "Mix of complex sentences, few errors"],
  ],
};

const TIMER: Record<WritingTask, { seconds: number; label: string }> = {
  1: { seconds: 1200, label: "Task 1 timer" },
  2: { seconds: 2400, label: "Task 2 timer" },
};

const MIN_WORDS: Record<WritingTask, number> = { 1: 150, 2: 250 };

const essayKey = (task: WritingTask) => `bandup:essayDraft:${task}`;

function readEssay(task: WritingTask): string {
  try {
    return sessionStorage.getItem(essayKey(task)) || "";
  } catch {
    return "";
  }
}

function writeEssay(task: WritingTask, text: string) {
  try {
    sessionStorage.setItem(essayKey(task), text);
  } catch {}
}

/** The bank prompt whose text matches the current prompt, if any (so a reload keeps the selection). */
function matchBank(bank: BankPrompt[], task: WritingTask, prompt: string): number | null {
  const hit = bank.find((b) => b.task === task && b.prompt.trim() === prompt.trim());
  return hit ? hit.id : null;
}

export function Writing({ prompts: initialPrompts, drafts, bank }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();

  const [task, setTask] = useState<WritingTask>(2);
  const [prompts, setPrompts] = useState<Record<WritingTask, string>>(initialPrompts);
  const [bankId, setBankId] = useState<Record<WritingTask, number | null>>({
    1: matchBank(bank, 1, initialPrompts[1]),
    2: matchBank(bank, 2, initialPrompts[2]),
  });
  const [essays, setEssays] = useState<Record<WritingTask, string>>({ 1: "", 2: "" });
  const [crit, setCrit] = useState<Record<string, boolean>>({});

  const promptTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tutorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore essays kept in sessionStorage so a refresh does not lose them.
  useEffect(() => {
    setEssays({ 1: readEssay(1), 2: readEssay(2) });
  }, []);

  const essay = essays[task];
  const words = wordCount(essay);
  const minWords = MIN_WORDS[task];
  const pct = Math.min(100, (words / minWords) * 100);
  const barColor = words >= minWords ? "#5B3FD9" : "#FF9F43";

  // Let the floating tutor read the current essay (debounced).
  useEffect(() => {
    if (tutorTimer.current) clearTimeout(tutorTimer.current);
    tutorTimer.current = setTimeout(() => storeEssayForTutor(essay), 300);
    return () => {
      if (tutorTimer.current) clearTimeout(tutorTimer.current);
    };
  }, [essay]);

  useEffect(
    () => () => {
      if (promptTimer.current) clearTimeout(promptTimer.current);
    },
    [],
  );

  const onPrompt = (value: string) => {
    const t = task;
    setPrompts((p) => ({ ...p, [t]: value }));
    if (promptTimer.current) clearTimeout(promptTimer.current);
    promptTimer.current = setTimeout(() => {
      void setWritingPrompt(t, value);
    }, 500);
  };

  const bankForTask = bank.filter((b) => b.task === task);
  const bankItem = bankForTask.find((b) => b.id === bankId[task]) ?? null;

  const loadBankPrompt = (value: string) => {
    const t = task;
    const id = value ? Number(value) : null;
    const item = id === null ? null : bank.find((b) => b.id === id && b.task === t);
    setBankId((s) => ({ ...s, [t]: item ? item.id : null }));
    if (item) onPrompt(item.prompt);
  };

  const onEssay = (value: string) => {
    const t = task;
    setEssays((e) => ({ ...e, [t]: value }));
    writeEssay(t, value);
  };

  const collect = () => {
    if (!words) {
      toast("Write something first.");
      return;
    }
    const q = new URLSearchParams({
      src: essay,
      source: "Writing",
      note: `My Task ${task} essay, ${today()}`,
    });
    router.push(`/add?${q.toString()}`);
  };

  const save = () => {
    if (!words) {
      toast("Write something first.");
      return;
    }
    start(async () => {
      const r = await saveDraft({ task, prompt: prompts[task], text: essay });
      toast(r.message);
      if (r.ok) router.refresh();
    });
  };

  const loadDraft = (d: DraftItem) => {
    setTask(d.task);
    setEssays((e) => ({ ...e, [d.task]: d.text }));
    writeEssay(d.task, d.text);
  };

  const removeDraft = (id: number) => {
    start(async () => {
      const r = await deleteDraft(id);
      toast(r.message);
      router.refresh();
    });
  };

  const tabStyle = (on: boolean) => ({
    background: on ? "#5B3FD9" : "#FFFFFF",
    color: on ? "#FFFFFF" : "#1E1B3A",
    borderColor: on ? "#5B3FD9" : "#D3CCEE",
  });

  return (
    <>
      <div className="flex gap-1.5" role="tablist" aria-label="Writing task">
        {([1, 2] as WritingTask[]).map((n) => (
          <button
            key={n}
            type="button"
            role="tab"
            aria-selected={task === n}
            className="btn"
            style={tabStyle(task === n)}
            onClick={() => setTask(n)}
          >
            Task {n}
          </button>
        ))}
      </div>

      <Timer seconds={TIMER[task].seconds} label={TIMER[task].label} resetKey={task} />

      <div className="flex flex-wrap items-start gap-4">
        <section className="card min-w-0 p-6" style={{ flex: "999 1 460px" }}>
          <div className="mb-3.5 flex flex-wrap items-end gap-3">
            <label className="label min-w-0 text-muted" style={{ flex: "1 1 280px" }}>
              Load a prompt from the bank
              <select
                className="inp mt-1.5 font-normal text-ink"
                value={bankItem ? String(bankItem.id) : ""}
                onChange={(e) => loadBankPrompt(e.target.value)}
                disabled={bankForTask.length === 0}
              >
                <option value="">
                  {bankForTask.length ? `— choose a Task ${task} prompt —` : `No Task ${task} prompts in the bank yet`}
                </option>
                {bankForTask.map((b) => (
                  <option key={b.id} value={String(b.id)}>
                    {b.title} · {b.source}
                  </option>
                ))}
              </select>
            </label>
            {bankItem?.sourceUrl && (
              <a className="btn btn-sm" href={bankItem.sourceUrl} target="_blank" rel="noopener">
                Open source
              </a>
            )}
          </div>
          {bankItem?.imageUrl && (
            <img
              src={bankItem.imageUrl}
              alt={`Task 1 figure for ${bankItem.title}`}
              className="mb-3.5 max-h-[360px] w-auto max-w-full rounded-lg border border-line"
            />
          )}
          <label className="block text-[13px] font-semibold text-muted">
            Prompt (edit or paste one from your materials)
            <textarea
              className="inp mt-1.5 text-[15px] text-ink"
              rows={3}
              value={prompts[task]}
              onChange={(e) => onPrompt(e.target.value)}
              style={{ background: "#F5F3FF" }}
            />
          </label>
          <label className="sr" htmlFor="essay">
            Your essay
          </label>
          <textarea
            id="essay"
            className="inp mt-3.5 text-base"
            rows={16}
            value={essay}
            onChange={(e) => onEssay(e.target.value)}
            placeholder="Start writing…"
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <div style={{ flex: "1 1 200px" }}>
              <div className="text-sm">
                <strong>{words}</strong> words · aim for {minWords}+
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-[3px] bg-track">
                <div className="h-1.5" style={{ background: barColor, width: `${pct}%` }} />
              </div>
            </div>
            <button type="button" className="btn" onClick={collect}>
              Collect phrases from essay
            </button>
            <button type="button" className="btn btn-p" onClick={save} disabled={pending}>
              Save draft
            </button>
          </div>
        </section>

        <aside className="flex min-w-0 flex-col gap-4" style={{ flex: "1 1 260px" }}>
          <section className="card p-5">
            <h2 className="m-0 mb-1 font-heading text-lg">Self-check</h2>
            <p className="m-0 mb-2.5 text-[13px] text-muted">The four marking criteria.</p>
            {CRITERIA[task].map(([key, name, hint]) => {
              const k = `${task}${key}`;
              return (
                <label key={k} className="flex cursor-pointer items-start gap-2.5 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!crit[k]}
                    onChange={() => setCrit((c) => ({ ...c, [k]: !c[k] }))}
                    className="mt-0.5 h-[18px] w-[18px]"
                    style={{ accentColor: "#5B3FD9" }}
                  />
                  <span>
                    <strong>{name}</strong>
                    <br />
                    <span className="text-muted">{hint}</span>
                  </span>
                </label>
              );
            })}
          </section>

          <section className="card p-5">
            <h2 className="m-0 mb-2.5 font-heading text-lg">Saved drafts</h2>
            {drafts.length === 0 && <p className="m-0 text-sm text-muted">No drafts yet.</p>}
            {drafts.map((d) => (
              <div key={d.id} className="mb-1.5 flex items-stretch gap-1.5">
                <button
                  type="button"
                  className="btn min-w-0 flex-1 justify-between"
                  onClick={() => loadDraft(d)}
                  title={d.prompt}
                >
                  <span>
                    Task {d.task} · {d.date}
                  </span>
                  <span className="text-muted">{d.words} w</span>
                </button>
                <button
                  type="button"
                  className="btn btn-sm self-center"
                  onClick={() => removeDraft(d.id)}
                  disabled={pending}
                  aria-label={`Delete draft Task ${d.task} · ${d.date}`}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M3 6h18" />
                    <path d="M8 6V4h8v2" />
                    <path d="M19 6l-1 14H6L5 6" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                  </svg>
                </button>
              </div>
            ))}
          </section>

          {bankItem && bankItem.modelAnswer && (
            <details className="card p-0">
              <summary className="cursor-pointer px-5 py-3.5 font-heading text-lg">
                Model answer &amp; examiner comment
              </summary>
              <div
                className="overflow-y-auto border-t border-line px-5 py-3.5 text-sm leading-relaxed whitespace-pre-line"
                style={{ maxHeight: 480 }}
              >
                {bankItem.modelAnswer}
              </div>
            </details>
          )}
        </aside>
      </div>
    </>
  );
}
