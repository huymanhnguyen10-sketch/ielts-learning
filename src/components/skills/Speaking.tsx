"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { SpeakingQuestion } from "@prisma/client";
import { Timer, type TimerPhase } from "@/components/Timer";
import { useToast } from "@/components/Toast";
import { setSpeakingNotes } from "@/lib/actions/settings";
import { addSpeakingQuestion, deleteSpeakingQuestion, saveMyAnswer } from "@/lib/actions/speaking";

export type SpeakingPart = 1 | 2 | 3;

export interface TutorTip {
  id: number;
  title: string;
  note: string;
}

interface Props {
  notes: string;
  /** Up to 8 everyday phrases from the bank. */
  everydayPhrases: string[];
  /** Question bank (Parts 1–3), already ordered by part, topic, sortOrder. */
  questions: SpeakingQuestion[];
  /** Speaking-skill "Note" materials imported from the tutor sheet. */
  tips: TutorTip[];
}

const SINTRO: Record<SpeakingPart, string> = {
  1: "Part 1 · Introduction & interview · 4–5 minutes",
  2: "Part 2 · Long turn · 1 min prep, up to 2 min talk",
  3: "Part 3 · Discussion · 4–5 minutes",
};

const SQ: Record<1 | 3, string[]> = {
  1: [
    "Do you work or are you a student?",
    "What do you enjoy about the area where you live?",
    "How often do you use public transport? Why?",
  ],
  3: [
    "Do people read less than they used to? Why?",
    "How might technology change the way children learn?",
    "Should governments pay for public libraries?",
  ],
};

const TIMER: Record<SpeakingPart, TimerPhase & { next?: TimerPhase }> = {
  1: { seconds: 120, label: "Speaking" },
  2: { seconds: 60, label: "Preparation", next: { seconds: 120, label: "Speak now" } },
  3: { seconds: 120, label: "Speaking" },
};

type SaveState = "idle" | "dirty" | "saving" | "saved";

/** One bank question with an "Answer" toggle and a debounced autosaved textarea. */
function QuestionRow({
  q,
  onRemove,
  removing,
}: {
  q: SpeakingQuestion;
  onRemove: (id: number) => void;
  removing: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [answer, setAnswer] = useState(q.myAnswer);
  const [state, setState] = useState<SaveState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const onChange = (value: string) => {
    setAnswer(value);
    setState("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setState("saving");
      const r = await saveMyAnswer(q.id, value);
      setState(r.ok ? "saved" : "dirty");
    }, 600);
  };

  const hasAnswer = answer.trim().length > 0;
  // Imported "Topic 5: Work — related questions…" rows are pointers to a sample doc, not answerable questions.
  const isTopicLink = /^Topic(?: \d+)?: .+ — /.test(q.question);

  return (
    <li className="py-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 flex-1 text-lg leading-normal [overflow-wrap:anywhere]">{q.question}</span>
        {!isTopicLink && (
          <button
            type="button"
            className="btn btn-sm"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            style={hasAnswer ? { borderColor: "#B7A8F5", background: "#EEEAFE", color: "#3B2799" } : undefined}
          >
            {open ? "Hide answer" : hasAnswer ? "Answer ✓" : "Answer"}
          </button>
        )}
        {q.sampleUrl && (
          <a className="btn btn-sm" href={q.sampleUrl} target="_blank" rel="noopener">
            Open sample answers
          </a>
        )}
        <button
          type="button"
          className="btn btn-sm text-muted"
          onClick={() => onRemove(q.id)}
          disabled={removing}
          aria-label={`Remove question: ${q.question}`}
          title="Remove from bank"
        >
          ×
        </button>
      </div>
      {open && (
        <div className="mt-2">
          <textarea
            className="inp text-[15px]"
            rows={3}
            value={answer}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Write your answer in 2–3 sentences…"
            aria-label={`My answer to: ${q.question}`}
          />
          <div className="mt-1 flex items-center justify-between text-xs text-muted">
            <span>{q.sourceNote}</span>
            <span role="status" aria-live="polite">
              {state === "saving" && "Saving…"}
              {state === "saved" && "Saved"}
              {state === "dirty" && "Unsaved changes"}
            </span>
          </div>
        </div>
      )}
    </li>
  );
}

export function Speaking({ notes: initialNotes, everydayPhrases, questions, tips }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [part, setPart] = useState<SpeakingPart>(2);
  const [notes, setNotes] = useState(initialNotes);
  const [newTopic, setNewTopic] = useState("");
  const [newQuestion, setNewQuestion] = useState("");
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (notesTimer.current) clearTimeout(notesTimer.current);
    },
    [],
  );

  const onNotes = (value: string) => {
    setNotes(value);
    if (notesTimer.current) clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(() => {
      void setSpeakingNotes(value);
    }, 500);
  };

  /** Bank questions for the current part, grouped by topic in bank order. */
  const groups = useMemo(() => {
    const out: { topic: string; items: SpeakingQuestion[] }[] = [];
    for (const q of questions) {
      if (q.part !== part) continue;
      const g = out.find((x) => x.topic === q.topic);
      if (g) g.items.push(q);
      else out.push({ topic: q.topic, items: [q] });
    }
    return out;
  }, [questions, part]);

  const add = () => {
    if (part === 2) return;
    start(async () => {
      const r = await addSpeakingQuestion({ part, topic: newTopic, question: newQuestion });
      toast(r.message);
      if (r.ok) {
        setNewQuestion("");
        router.refresh();
      }
    });
  };

  const remove = (id: number) => {
    start(async () => {
      const r = await deleteSpeakingQuestion(id);
      toast(r.message);
      router.refresh();
    });
  };

  const tabStyle = (on: boolean) => ({
    background: on ? "#5B3FD9" : "#FFFFFF",
    color: on ? "#FFFFFF" : "#1E1B3A",
    borderColor: on ? "#5B3FD9" : "#D3CCEE",
  });

  const t = TIMER[part];

  return (
    <>
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Speaking part">
        {([1, 2, 3] as SpeakingPart[]).map((n) => (
          <button
            key={n}
            type="button"
            role="tab"
            aria-selected={part === n}
            className="btn"
            style={tabStyle(part === n)}
            onClick={() => setPart(n)}
          >
            Part {n}
          </button>
        ))}
      </div>

      <Timer seconds={t.seconds} label={t.label} next={t.next} resetKey={part} />

      <section className="card p-7">
        <div className="eyebrow">{SINTRO[part]}</div>

        {part === 2 ? (
          <>
            <div className="mt-3 rounded-xl p-6" style={{ background: "#FFEBDA", color: "#3D1E04" }}>
              <div className="font-heading text-[22px] font-semibold">Describe a book that you enjoyed reading.</div>
              <div className="mt-3 text-[15px]">You should say:</div>
              <ul className="m-0 mt-1.5 list-disc pl-5 text-[15px] leading-[1.8]">
                <li>what the book was</li>
                <li>when you read it</li>
                <li>what it was about</li>
              </ul>
              <div className="mt-1.5 text-[15px]">and explain why you enjoyed it.</div>
            </div>
            <label className="mt-4 block text-[13px] font-semibold">
              Notes (1 minute to prepare)
              <textarea
                className="inp mt-1.5 font-normal"
                rows={4}
                value={notes}
                onChange={(e) => onNotes(e.target.value)}
              />
            </label>
          </>
        ) : groups.length > 0 ? (
          <div className="mt-3 flex flex-col gap-5">
            {groups.map((g) => (
              <div key={g.topic}>
                <h3 className="m-0 mb-1 font-heading text-base font-semibold">{g.topic}</h3>
                <ol className="m-0 flex list-decimal flex-col gap-1 pl-[22px]">
                  {g.items.map((q) => (
                    <QuestionRow key={q.id} q={q} onRemove={remove} removing={pending} />
                  ))}
                </ol>
              </div>
            ))}
          </div>
        ) : (
          <ol className="m-0 mt-3 flex list-decimal flex-col gap-3 pl-[22px] text-lg leading-normal">
            {SQ[part].map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ol>
        )}

        {part !== 2 && (
          <form
            className="mt-4 flex flex-wrap items-end gap-2 rounded-[10px] border border-line p-3"
            onSubmit={(e) => {
              e.preventDefault();
              add();
            }}
          >
            <label className="label block" style={{ flex: "1 1 160px" }}>
              Topic
              <input
                className="inp mt-1 font-normal"
                value={newTopic}
                onChange={(e) => setNewTopic(e.target.value)}
                placeholder="e.g. Hometown"
                maxLength={60}
              />
            </label>
            <label className="label block" style={{ flex: "3 1 260px" }}>
              Question (Part {part})
              <input
                className="inp mt-1 font-normal"
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                placeholder="Type a question to add to your bank…"
                maxLength={300}
              />
            </label>
            <button type="submit" className="btn btn-p" disabled={pending}>
              Add a question
            </button>
          </form>
        )}

        <div className="mt-[18px] rounded-[10px] bg-ground px-4 py-3.5">
          <div className="mb-2 text-[13px] font-semibold">Everyday phrases to try in your answer</div>
          <div className="flex flex-wrap gap-1.5">
            {everydayPhrases.map((p) => (
              <span
                key={p}
                className="rounded-xl px-2.5 py-1 text-sm"
                style={{ background: "#FFEBDA", color: "#8A4209" }}
              >
                {p}
              </span>
            ))}
          </div>
        </div>

        {tips.length > 0 && (
          <details className="mt-3 rounded-[10px] border border-line px-4 py-3">
            <summary className="cursor-pointer text-[13px] font-semibold">
              Tips from your tutor <span className="font-normal text-muted">({tips.length})</span>
            </summary>
            <div className="mt-2 flex flex-col gap-2">
              {tips.map((tip) => (
                <details key={tip.id} className="rounded-lg bg-ground px-3 py-2">
                  <summary className="cursor-pointer text-sm font-semibold">{tip.title}</summary>
                  <p className="m-0 mt-1.5 whitespace-pre-line text-sm leading-relaxed">{tip.note}</p>
                </details>
              ))}
            </div>
          </details>
        )}

        <p className="m-0 mt-3.5 text-sm text-muted">
          Tip: record yourself on your phone, then listen back for fluency, range of vocabulary and pronunciation.
        </p>
      </section>
    </>
  );
}
