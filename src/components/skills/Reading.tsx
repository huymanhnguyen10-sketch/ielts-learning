"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { answerMatches, type PassageQuestion } from "@/lib/content-types";
import { selectionIn } from "@/lib/selection";

// ---------------------------------------------------------------------------
// Props (plain data from the server component)
// ---------------------------------------------------------------------------

export interface PassageOption {
  id: number;
  title: string;
  source: string;
}

export interface PassageData {
  id: number;
  title: string;
  source: string;
  sourceUrl: string | null;
  instructions: string;
  text: string;
  questions: PassageQuestion[];
}

interface Props {
  passages: PassageOption[];
  selected: PassageData | null;
}

// ---------------------------------------------------------------------------
// Built-in sample passage (shown when the bank is empty or nothing is chosen)
// ---------------------------------------------------------------------------

const P1 =
  "Urban beekeeping has grown rapidly in many European and North American cities over the past two decades. Supporters argue that rooftop hives help pollinate city gardens and raise public awareness of declining insect populations.";
const P2 =
  "However, some ecologists warn that adding large numbers of honeybees can increase competition for flowers, putting pressure on wild bee species that already struggle to find food in built-up areas. One city survey found that the number of hives had tripled in ten years, while the area of flowering plants had barely changed.";
const P3 =
  "For this reason, researchers suggest that planting more native flowers may matter more than simply adding hives.";

const SAMPLE: PassageData = {
  id: 0,
  title: "Bees on the rooftops",
  source: "Sample passage",
  sourceUrl: null,
  instructions: "Do the statements agree with the passage?",
  text: `${P1}\n\n${P2}\n\n${P3}`,
  questions: [
    { n: 1, type: "tfng", text: "Urban beekeeping has become more popular in recent decades.", answer: ["TRUE"] },
    { n: 2, type: "tfng", text: "All ecologists support the spread of rooftop hives.", answer: ["FALSE"] },
    { n: 3, type: "tfng", text: "City honeybees produce more honey than countryside bees.", answer: ["NOT GIVEN"] },
    {
      n: 4,
      type: "tfng",
      text: "Flowering plants in the surveyed city increased as fast as the number of hives.",
      answer: ["FALSE"],
    },
    {
      n: 5,
      type: "tfng",
      text: "Researchers think native flowers may be more important than extra hives.",
      answer: ["TRUE"],
    },
  ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TOGGLES: Record<"tfng" | "ynng", string[]> = {
  tfng: ["TRUE", "FALSE", "NOT GIVEN"],
  ynng: ["YES", "NO", "NOT GIVEN"],
};

/** "A the Chinese" → "A"; "iii Why it matters" → "iii". */
function optionKey(option: string): string {
  const i = option.indexOf(" ");
  return (i === -1 ? option : option.slice(0, i)).trim();
}

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function sameSet(a: string[], b: string[]): boolean {
  const A = new Set(a.map(norm).filter(Boolean));
  const B = new Set(b.map(norm).filter(Boolean));
  if (A.size !== B.size) return false;
  for (const x of A) if (!B.has(x)) return false;
  return true;
}

type Given = string | string[] | undefined;

function isCorrect(q: PassageQuestion, given: Given): boolean {
  if (q.multi) {
    return Array.isArray(given) && sameSet(given, q.answer);
  }
  if (typeof given !== "string" || !given.trim()) return false;
  if (q.type === "gap") return answerMatches(given, q.answer);
  // tfng / ynng / mcq / heading / match: compare the letter, numeral or label case-insensitively.
  const g = norm(given);
  return q.answer.some((a) => norm(a) === g);
}

function headingFor(qs: PassageQuestion[]): string {
  const types = new Set(qs.map((q) => q.type));
  if (types.size === 1) {
    const t = qs[0].type;
    if (t === "tfng") return "True / False / Not Given";
    if (t === "ynng") return "Yes / No / Not Given";
    if (t === "mcq") return "Multiple choice";
    if (t === "gap") return "Complete the gaps";
    if (t === "heading") return "Matching headings";
    if (t === "match") return "Matching";
  }
  return "Questions";
}

const toggleStyle = (on: boolean) => ({
  minHeight: 36,
  padding: "6px 12px",
  background: on ? "#5B3FD9" : "#FFFFFF",
  color: on ? "#FFFFFF" : "#1E1B3A",
  borderColor: on ? "#5B3FD9" : "#D3CCEE",
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Reading({ passages, selected }: Props) {
  const router = useRouter();
  const passage = selected ?? SAMPLE;
  const isSample = selected === null;
  const questions = passage.questions;
  const paragraphs = passage.text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const fullText = paragraphs.join(" ");

  const [answers, setAnswers] = useState<Record<number, Given>>({});
  const [checked, setChecked] = useState(false);
  const [pending, setPending] = useState<{ sel: string; sentence: string } | null>(null);

  const correct = questions.filter((q, i) => isCorrect(q, answers[i])).length;

  const setAnswer = (i: number, value: Given) => {
    setAnswers((a) => ({ ...a, [i]: value }));
    setChecked(false);
  };

  const toggleMulti = (i: number, letter: string) => {
    setAnswers((a) => {
      const cur = Array.isArray(a[i]) ? (a[i] as string[]) : [];
      const next = cur.includes(letter) ? cur.filter((x) => x !== letter) : [...cur, letter];
      return { ...a, [i]: next };
    });
    setChecked(false);
  };

  const grab = () => {
    const r = selectionIn(fullText);
    if (r) setPending(r);
  };

  const savePending = () => {
    if (!pending) return;
    const qs = new URLSearchParams({
      phrase: pending.sel,
      example: pending.sentence,
      source: "Reading",
      note: `Reading: ${passage.title}`,
    });
    router.push(`/add?${qs.toString()}`);
  };

  const choosePassage = (value: string) => {
    router.push(value ? `/reading?passage=${value}` : "/reading");
  };

  return (
    <>
      <section className="card px-5 py-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="label min-w-0" style={{ flex: "1 1 320px" }}>
            Choose a passage
            <select
              className="inp mt-1.5 font-normal"
              value={isSample ? "" : String(passage.id)}
              onChange={(e) => choosePassage(e.target.value)}
            >
              <option value="">Sample passage · {SAMPLE.title}</option>
              {passages.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.title} · {p.source}
                </option>
              ))}
            </select>
          </label>
          {passage.sourceUrl && (
            <a className="btn btn-sm" href={passage.sourceUrl} target="_blank" rel="noopener">
              Open source
            </a>
          )}
        </div>
        {passages.length === 0 && (
          <p className="mt-2.5 mb-0 text-sm text-muted">
            The passage bank is empty for now; the sample passage below is ready to practise on.
          </p>
        )}
      </section>

      {pending && (
        <div
          className="flex flex-wrap items-center gap-2.5 rounded-[10px] px-4 py-3"
          style={{ background: "#FFEBDA", color: "#3D1E04" }}
        >
          <span style={{ flex: "1 1 240px" }}>
            Selected: <strong>{pending.sel}</strong>
          </span>
          <button type="button" className="btn btn-p" onClick={savePending}>
            Save as phrase
          </button>
          <button type="button" className="btn" onClick={() => setPending(null)}>
            Dismiss
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-start gap-4">
        <article onMouseUp={grab} className="card min-w-0 p-6" style={{ flex: "1 1 400px" }}>
          <div className="text-xs uppercase tracking-[0.08em] text-muted">
            {passage.source} · highlight a phrase to save it
          </div>
          <h2 className="mt-1.5 mb-3 font-heading text-[22px] font-semibold">{passage.title}</h2>
          {paragraphs.map((p, i) => (
            <p
              key={i}
              className={`m-0 text-base leading-[1.75] whitespace-pre-line ${i < paragraphs.length - 1 ? "mb-3" : ""}`}
            >
              {p}
            </p>
          ))}
        </article>

        <section className="card min-w-0 p-6" style={{ flex: "1 1 380px" }}>
          <h2 className="m-0 mb-1 font-heading text-xl font-semibold">
            {questions.length ? headingFor(questions) : "Questions"}
          </h2>
          {passage.instructions && (
            <p className="m-0 mb-4 text-sm text-muted whitespace-pre-line">{passage.instructions}</p>
          )}

          {questions.length === 0 && (
            <div className="rounded-[10px] bg-ground p-5 text-sm text-muted">
              This extract has no auto-markable questions — open the source PDF to try it.
            </div>
          )}

          {questions.length > 0 && (
            <>
              <div className="flex flex-col gap-4">
                {questions.map((q, i) => {
                  const given = answers[i];
                  const right = isCorrect(q, given);
                  const feedback = checked && (
                    <span className="text-[13px] font-semibold" style={{ color: right ? "#5B3FD9" : "#C2410C" }}>
                      {right ? "✓ Correct" : `✗ ${q.answer.join(" / ")}`}
                    </span>
                  );
                  const inputId = `rq-${passage.id}-${i}`;

                  return (
                    <div key={i}>
                      <div className="text-[15px] leading-normal whitespace-pre-line">
                        <strong>{q.n}.</strong> {q.text}
                      </div>

                      {(q.type === "tfng" || q.type === "ynng") && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {TOGGLES[q.type].map((o) => {
                            const on = given === o;
                            return (
                              <button
                                key={o}
                                type="button"
                                className="btn"
                                aria-pressed={on}
                                onClick={() => setAnswer(i, o)}
                                style={toggleStyle(on)}
                              >
                                {o}
                              </button>
                            );
                          })}
                          {feedback}
                        </div>
                      )}

                      {q.type === "mcq" && (
                        <div className="mt-2 flex flex-col items-start gap-1.5">
                          {q.multi && (
                            <span className="text-[13px] text-muted">Choose {q.answer.length}</span>
                          )}
                          {(q.options ?? []).map((o) => {
                            const letter = optionKey(o);
                            const on = q.multi
                              ? Array.isArray(given) && given.includes(letter)
                              : given === letter;
                            return (
                              <button
                                key={o}
                                type="button"
                                className="btn text-left"
                                aria-pressed={on}
                                onClick={() => (q.multi ? toggleMulti(i, letter) : setAnswer(i, letter))}
                                style={{ ...toggleStyle(on), justifyContent: "flex-start", whiteSpace: "normal" }}
                              >
                                {o}
                              </button>
                            );
                          })}
                          {feedback}
                        </div>
                      )}

                      {(q.type === "heading" || q.type === "match") && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <label className="sr" htmlFor={inputId}>
                            Answer to question {q.n}
                          </label>
                          <select
                            id={inputId}
                            className="inp min-w-0 font-normal"
                            style={{ flex: "1 1 240px", width: "auto" }}
                            value={typeof given === "string" ? given : ""}
                            onChange={(e) => setAnswer(i, e.target.value)}
                          >
                            <option value="">Choose…</option>
                            {(q.options ?? []).map((o) => (
                              <option key={o} value={optionKey(o)}>
                                {o}
                              </option>
                            ))}
                          </select>
                          {feedback}
                        </div>
                      )}

                      {q.type === "gap" && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <label className="sr" htmlFor={inputId}>
                            Answer to question {q.n}
                          </label>
                          <input
                            id={inputId}
                            className="inp min-w-0 font-normal"
                            style={{ flex: "1 1 200px", width: "auto" }}
                            placeholder="Your answer"
                            value={typeof given === "string" ? given : ""}
                            onChange={(e) => setAnswer(i, e.target.value)}
                            autoComplete="off"
                            spellCheck={false}
                          />
                          {q.wordLimit && <span className="text-xs text-muted">{q.wordLimit}</span>}
                          {feedback}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2">
                <button type="button" className="btn btn-p" onClick={() => setChecked(true)}>
                  Check answers
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setAnswers({});
                    setChecked(false);
                  }}
                >
                  Try again
                </button>
                {checked && (
                  <span className="font-semibold">
                    {correct} / {questions.length} correct
                  </span>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );
}
