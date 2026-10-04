"use client";

import { formatClock, QUIZ_TYPE_KEYS, QUIZ_TYPES, resultTitle } from "@/lib/quiz";
import { C, HEADING, type QuizResultState } from "./shared";

const darkBtn: React.CSSProperties = { background: C.violetMid, borderColor: C.violetLine, color: C.white };

export function ResultsView({
  result,
  pending,
  onRetry,
  onAddToReview,
  onNewTest,
  onSettings,
}: {
  result: QuizResultState;
  pending: boolean;
  onRetry: () => void;
  onAddToReview: () => void;
  onNewTest: () => void;
  onSettings: () => void;
}) {
  const total = result.questions.length;
  const pct = total ? Math.round((result.right / total) * 100) : 0;
  const nWrong = result.wrongIds.length;
  const byType = QUIZ_TYPE_KEYS.filter((k) => result.byType[k]).map((k) => ({
    key: k,
    meta: QUIZ_TYPES[k],
    score: result.byType[k] as [number, number],
  }));

  return (
    <>
      <section
        style={{
          background: C.violet,
          color: C.white,
          borderRadius: 14,
          padding: 28,
          display: "flex",
          flexWrap: "wrap",
          gap: 24,
          alignItems: "center",
        }}
      >
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: 60,
            background: C.white,
            color: C.violetDark,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            flex: "none",
          }}
        >
          <span style={{ ...HEADING, fontSize: 36, fontWeight: 700, lineHeight: 1 }}>{pct}%</span>
          <span style={{ fontSize: 13 }}>
            {result.right} / {total}
          </span>
        </div>
        <div style={{ flex: "1 1 260px" }}>
          <div style={{ ...HEADING, fontSize: 28, fontWeight: 700 }}>{resultTitle(pct)}</div>
          <div style={{ color: "#DCD5F8", marginTop: 6 }}>
            Time used: {formatClock(result.usedSeconds)} · {nWrong} {nWrong === 1 ? "phrase" : "phrases"} to work on
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
            {nWrong > 0 && (
              <>
                <button
                  type="button"
                  className="btn"
                  onClick={onRetry}
                  style={{ background: C.yellow, borderColor: C.yellow, color: C.text, fontWeight: 600 }}
                >
                  Retry mistakes
                </button>
                <button type="button" className="btn" onClick={onAddToReview} disabled={pending} style={darkBtn}>
                  Add mistakes to today&apos;s review
                </button>
              </>
            )}
            <button type="button" className="btn" onClick={onNewTest} style={darkBtn}>
              New test
            </button>
            <button type="button" className="btn" onClick={onSettings} style={darkBtn}>
              Settings
            </button>
          </div>
        </div>
      </section>

      <section
        style={{
          background: C.white,
          border: `1px solid ${C.line}`,
          borderTop: `5px solid ${C.orange}`,
          borderRadius: 12,
          padding: 20,
        }}
      >
        <h2 style={{ ...HEADING, margin: "0 0 12px", fontSize: 18 }}>By question type</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
          {byType.map((bt) => (
            <div key={bt.key} style={{ padding: "12px 14px", borderRadius: 10, background: bt.meta.tint }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: bt.meta.dark }}>{bt.meta.label}</div>
              <div style={{ ...HEADING, fontSize: 22, fontWeight: 700, marginTop: 2 }}>
                {bt.score[0]} / {bt.score[1]}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section
        style={{
          background: C.white,
          border: `1px solid ${C.line}`,
          borderTop: `5px solid ${C.pink}`,
          borderRadius: 12,
        }}
      >
        <h2 style={{ ...HEADING, margin: 0, padding: "18px 20px 10px", fontSize: 18 }}>Answers</h2>
        {result.questions.map((q, i) => {
          const a = result.answers[i];
          const ok = !!a && a.correct;
          const color = ok ? C.greenDark : C.rust;
          return (
            <div
              key={i}
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "8px 14px",
                alignItems: "baseline",
                padding: "12px 20px",
                borderTop: `1px solid ${C.line}`,
              }}
            >
              <span style={{ fontWeight: 700, color, minWidth: 22 }} aria-label={ok ? "Correct" : "Wrong"}>
                {ok ? "✓" : "✗"}
              </span>
              <span style={{ flex: "1 1 220px", minWidth: 0 }}>
                <strong>{q.phrase}</strong>
                <span style={{ fontSize: 12, color: C.muted }}> · {QUIZ_TYPES[q.type].label}</span>
              </span>
              <span style={{ flex: "1 1 220px", fontSize: 14, color: C.muted }}>
                You: <span style={{ color, fontWeight: 600 }}>{a ? a.given : "— (time up)"}</span>
                {!ok && (
                  <>
                    {" "}
                    · Answer: <strong style={{ color: C.text }}>{q.answer}</strong>
                  </>
                )}
              </span>
            </div>
          );
        })}
      </section>
    </>
  );
}
