"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatClock, norm, QUIZ_TYPES, type Question } from "@/lib/quiz";
import { C, HEADING, type AnswerMap } from "./shared";

const KEYS = ["A", "B", "C", "D"];

/**
 * One quick test: a single total countdown, immediate feedback per question.
 * The countdown interval lives here, so leaving the view (Back/Settings/navigation) unmounts
 * the component and clears it. The parent remounts with a new `key` for each test.
 */
export function QuizView({
  questions,
  totalSeconds,
  onFinish,
}: {
  questions: Question[];
  totalSeconds: number;
  onFinish: (answers: AnswerMap, usedSeconds: number) => void;
}) {
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [order, setOrder] = useState<number[]>([]);
  const [text, setText] = useState("");
  const [left, setLeft] = useState(totalSeconds);

  // Latest values for the finish callback (called from the timer effect and buttons).
  // Updated in an effect (declared before the time-up effect) so they are fresh when it runs.
  const answersRef = useRef(answers);
  const leftRef = useRef(left);
  const finishedRef = useRef(false);
  useEffect(() => {
    answersRef.current = answers;
    leftRef.current = left;
  }, [answers, left]);

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onFinish(answersRef.current, totalSeconds - Math.max(0, leftRef.current));
  }, [onFinish, totalSeconds]);

  useEffect(() => {
    const id = setInterval(() => setLeft((l) => (l > 0 ? l - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, []);

  // Time up → auto-finish; unanswered questions count as wrong.
  useEffect(() => {
    if (left <= 0) finish();
  }, [left, finish]);

  const q = questions[idx];
  const a = answers[idx];
  const answered = !!a;

  const answer = useCallback(
    (correct: boolean, given: string) => {
      setAnswers((prev) => (prev[idx] ? prev : { ...prev, [idx]: { correct, given } }));
    },
    [idx],
  );

  const nextQ = () => {
    if (idx >= questions.length - 1) {
      finish();
      return;
    }
    setIdx(idx + 1);
    setOrder([]);
    setText("");
  };

  const checkText = () => {
    if (!q || answered) return;
    answer(norm(text) === norm(q.answer), text.trim() || "(blank)");
  };

  const pickChip = (k: number) => {
    if (!q || answered) return;
    const next = order.concat([k]);
    setOrder(next);
    if (next.length === q.chips.length) {
      const built = next.map((i) => q.chips[i]).join(" ");
      answer(norm(built) === norm(q.answer), built);
    }
  };

  if (!q) return null;

  const tt = QUIZ_TYPES[q.type];
  const lowTime = totalSeconds > 0 && left / totalSeconds < 0.25;
  const timePct = totalSeconds ? (left / totalSeconds) * 100 : 0;
  const isLast = idx >= questions.length - 1;

  const fbText =
    (a && !a.correct ? "Answer: " + q.answer + "." : "") +
    (q.type === "mcMeaning" || q.type === "tf" ? " “" + q.phrase + "” = " + q.meaning + "." : "");

  return (
    <>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 14,
          background: C.violetDeep,
          color: C.white,
          borderRadius: 12,
          padding: "14px 20px",
        }}
      >
        <div style={{ fontSize: 13, color: "#C9C0F2" }} aria-live="polite">
          Question {idx + 1} of {questions.length}
        </div>
        <div
          style={{ flex: "1 1 160px", height: 10, borderRadius: 5, background: C.violetMid, overflow: "hidden" }}
          role="progressbar"
          aria-label="Time left"
          aria-valuemin={0}
          aria-valuemax={totalSeconds}
          aria-valuenow={left}
        >
          <div
            style={{
              height: 10,
              background: lowTime ? C.orange : C.yellow,
              width: `${timePct}%`,
              transition: "width 1s linear",
            }}
          />
        </div>
        <div
          aria-live="off"
          style={{
            ...HEADING,
            fontSize: 28,
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
            color: lowTime ? "#FFB37A" : C.white,
          }}
        >
          {formatClock(left)}
        </div>
        <button
          type="button"
          className="btn"
          onClick={finish}
          style={{ background: C.violetMid, color: C.white, borderColor: C.violetLine }}
        >
          Finish
        </button>
      </div>

      <section
        style={{
          background: C.white,
          border: `1px solid ${C.line}`,
          borderTop: `6px solid ${tt.color}`,
          borderRadius: 16,
          padding: "28px clamp(20px, 4vw, 44px)",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <span
          style={{
            alignSelf: "flex-start",
            fontSize: 12,
            fontWeight: 600,
            padding: "4px 10px",
            borderRadius: 12,
            background: tt.tint,
            color: tt.dark,
          }}
        >
          {tt.label}
        </span>
        <div style={{ fontSize: 14, color: C.muted }}>{q.prompt}</div>
        <div lang={q.lang} style={{ ...HEADING, fontSize: "clamp(22px, 3vw, 32px)", fontWeight: 700, lineHeight: 1.3 }}>
          {q.main}
        </div>
        {q.sub && <div style={{ fontSize: 15, color: C.muted, fontStyle: "italic" }}>{q.sub}</div>}

        {q.kind === "choice" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
            {q.options.map((o, k) => {
              const isAns = o === q.answer;
              const isGiven = !!a && a.given === o;
              const st = !a
                ? [C.white, C.text, C.input, tt.tint, tt.dark]
                : isAns
                  ? [C.greenTint, C.greenDark, C.green, C.green, C.white]
                  : isGiven
                    ? [C.redTint, C.redDark, C.red, C.red, C.white]
                    : [C.white, C.muted, C.line, "#F0EDFA", C.muted];
              const key = a && isAns ? "✓" : a && isGiven ? "✗" : KEYS[k];
              return (
                <button
                  key={k}
                  type="button"
                  className="btn"
                  onClick={() => answer(isAns, o)}
                  aria-disabled={answered}
                  style={{
                    justifyContent: "flex-start",
                    textAlign: "left",
                    minHeight: 56,
                    padding: "10px 16px",
                    fontSize: 15,
                    background: st[0],
                    color: st[1],
                    borderColor: st[2],
                    borderWidth: 2,
                  }}
                >
                  <span
                    style={{
                      minWidth: 26,
                      height: 26,
                      borderRadius: 13,
                      background: st[3],
                      color: st[4],
                      fontSize: 13,
                      fontWeight: 700,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {key}
                  </span>
                  <span>{o}</span>
                </button>
              );
            })}
          </div>
        )}

        {q.kind === "type" && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <label className="sr" htmlFor="qz-input">
              Your answer
            </label>
            <input
              key={idx}
              id="qz-input"
              className="inp"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                if (!answered) checkText();
                else nextQ();
              }}
              placeholder="Type the phrase…"
              autoComplete="off"
              autoFocus
              readOnly={answered}
              style={{ flex: "1 1 260px", fontSize: 17, minHeight: 48 }}
            />
            <button
              type="button"
              className="btn"
              onClick={checkText}
              disabled={answered}
              style={{ minHeight: 48, background: C.violet, borderColor: C.violet, color: C.white }}
            >
              Check
            </button>
          </div>
        )}

        {q.kind === "order" && (
          <>
            <div
              style={{
                minHeight: 56,
                padding: 10,
                borderRadius: 10,
                border: `2px dashed ${C.input}`,
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                alignItems: "center",
              }}
              aria-live="polite"
            >
              {order.length === 0 && (
                <span style={{ fontSize: 14, color: C.muted }}>Tap the words below in the right order</span>
              )}
              {order.map((k, i) => (
                <span
                  key={`${k}-${i}`}
                  style={{ padding: "8px 14px", borderRadius: 8, background: C.violet, color: C.white, fontWeight: 600 }}
                >
                  {q.chips[k]}
                </span>
              ))}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {q.chips.map((w, k) =>
                order.includes(k) ? null : (
                  <button
                    key={k}
                    type="button"
                    className="btn"
                    onClick={() => pickChip(k)}
                    style={{ background: "#FFF6DB", borderColor: "#E0B000", color: "#5C4300", fontWeight: 600 }}
                  >
                    {w}
                  </button>
                ),
              )}
              <button
                type="button"
                className="btn"
                onClick={() => {
                  if (!answered) setOrder((o) => o.slice(0, -1));
                }}
                disabled={answered || order.length === 0}
              >
                Undo
              </button>
            </div>
          </>
        )}

        {a && (
          <>
            <div
              role="status"
              style={{
                padding: "14px 16px",
                borderRadius: 10,
                background: a.correct ? C.greenTint : C.redTint,
                color: a.correct ? C.greenDark : "#7C2D12",
                fontSize: 15,
                lineHeight: 1.6,
              }}
            >
              <strong>{a.correct ? "✓ Correct!" : "✗ Not quite."}</strong> {fbText}
              {q.example && <div style={{ fontSize: 14, marginTop: 4, opacity: 0.9 }}>Example: {q.example}</div>}
            </div>
            <button
              type="button"
              className="btn"
              onClick={nextQ}
              autoFocus={q.kind !== "type"}
              style={{
                alignSelf: "flex-end",
                minHeight: 48,
                padding: "0 24px",
                background: C.violet,
                borderColor: C.violet,
                color: C.white,
              }}
            >
              {isLast ? "See results" : "Next question"}
            </button>
          </>
        )}
      </section>
    </>
  );
}
