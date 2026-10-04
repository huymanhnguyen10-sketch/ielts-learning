"use client";

import type { QuizResultRow } from "@/lib/actions/practice";
import {
  COUNT_OPTIONS,
  QUIZ_TYPE_KEYS,
  QUIZ_TYPES,
  scoreColor,
  setupLabel,
  SPEED_LABEL,
  type PoolSource,
  type QuizType,
  type Speed,
} from "@/lib/quiz";
import { C, HEADING, pill, type PracticeSettings } from "./shared";

const SPEED_OPTS: ReadonlyArray<readonly [Speed, string]> = [
  ["relaxed", "Relaxed · 30s per question"],
  ["normal", "Normal · 20s"],
  ["fast", "Fast · 12s"],
];

const cardStyle = (top: string): React.CSSProperties => ({
  background: C.white,
  border: `1px solid ${C.line}`,
  borderTop: `5px solid ${top}`,
  borderRadius: 12,
  padding: 20,
});

export function SetupView({
  settings,
  onChange,
  onToggleType,
  poolCount,
  totalCount,
  topics,
  history,
  onStartFlash,
  onStartQuiz,
}: {
  settings: PracticeSettings;
  onChange: (patch: Partial<PracticeSettings>) => void;
  onToggleType: (t: QuizType) => void;
  poolCount: number;
  totalCount: number;
  topics: ReadonlyArray<readonly [string, string]>;
  history: QuizResultRow[];
  onStartFlash: () => void;
  onStartQuiz: () => void;
}) {
  const poolLabel =
    poolCount +
    (poolCount === 1 ? " phrase matches" : " phrases match") +
    (totalCount < 4 ? " · add at least 4 phrases for tests" : "");
  const poolColor = poolCount && totalCount >= 4 ? C.greenDark : C.rust;

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        <section
          style={{
            background: "#FDE8F1",
            border: `2px solid ${C.pink}`,
            borderRadius: 14,
            padding: 24,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: C.pink,
              color: C.white,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="6" width="14" height="14" rx="2" />
              <path d="M7 2h12a2 2 0 0 1 2 2v12" />
            </svg>
          </div>
          <h2 style={{ ...HEADING, margin: 0, fontSize: 22, color: C.text }}>Flashcards</h2>
          <p style={{ margin: 0, fontSize: 15, color: C.muted, lineHeight: 1.55 }}>
            Shuffled cards you flip to reveal. Sort them into “I know it” and “Still learning”, then go again with
            the hard ones.
          </p>
          <button
            type="button"
            className="btn"
            onClick={onStartFlash}
            style={{
              alignSelf: "flex-start",
              background: C.pink,
              borderColor: C.pink,
              color: C.white,
              minHeight: 46,
              padding: "0 20px",
              fontWeight: 600,
            }}
          >
            Start flashcards
          </button>
        </section>
        <section
          style={{
            background: "#EEEAFE",
            border: `2px solid ${C.violet}`,
            borderRadius: 14,
            padding: 24,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: C.violet,
              color: C.white,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="13" r="8" />
              <path d="M12 9v4l2 2" />
              <path d="M9 2h6" />
            </svg>
          </div>
          <h2 style={{ ...HEADING, margin: 0, fontSize: 22, color: C.text }}>Quick test</h2>
          <p style={{ margin: 0, fontSize: 15, color: C.muted, lineHeight: 1.55 }}>
            A short countdown test. Phrases are picked at random and every question gets a random type.
          </p>
          <button
            type="button"
            className="btn"
            onClick={onStartQuiz}
            style={{
              alignSelf: "flex-start",
              background: C.violet,
              borderColor: C.violet,
              color: C.white,
              minHeight: 46,
              padding: "0 20px",
              fontWeight: 600,
            }}
          >
            Start test · {setupLabel(settings.count, settings.speed)}
          </button>
        </section>
      </div>

      <section style={{ ...cardStyle(C.orange), display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
          <h2 style={{ ...HEADING, margin: 0, fontSize: 18 }}>Settings</h2>
          <span style={{ fontSize: 14, fontWeight: 600, color: poolColor }} aria-live="polite">
            {poolLabel}
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          <label style={{ fontSize: 13, fontWeight: 600 }}>
            Phrases from
            <select
              className="inp"
              value={settings.source}
              onChange={(e) => onChange({ source: e.target.value as PoolSource })}
              style={{ marginTop: 6, fontWeight: 400 }}
            >
              <option value="all">Whole phrase bank</option>
              <option value="learning">Still learning (not known)</option>
              <option value="new">New only</option>
              <option value="academic">Academic only</option>
              <option value="everyday">Everyday only</option>
            </select>
          </label>
          <label style={{ fontSize: 13, fontWeight: 600 }}>
            Topic
            <select
              className="inp"
              value={settings.topic}
              onChange={(e) => onChange({ topic: e.target.value })}
              style={{ marginTop: 6, fontWeight: 400 }}
            >
              <option value="All">All topics</option>
              {topics.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Questions</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }} role="group" aria-label="Number of questions">
            {COUNT_OPTIONS.map((n) => {
              const on = settings.count === n;
              return (
                <button
                  key={n}
                  type="button"
                  className="btn"
                  aria-pressed={on}
                  onClick={() => onChange({ count: n })}
                  style={{ minWidth: 56, ...pill(on, C.orange), color: C.text }}
                >
                  {n}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Countdown speed</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }} role="group" aria-label="Countdown speed">
            {SPEED_OPTS.map(([v, label]) => {
              const on = settings.speed === v;
              return (
                <button
                  key={v}
                  type="button"
                  className="btn"
                  aria-pressed={on}
                  onClick={() => onChange({ speed: v })}
                  style={pill(on, C.violet)}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Question types (mixed at random)</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {QUIZ_TYPE_KEYS.map((k) => {
              const on = settings.types[k];
              const m = QUIZ_TYPES[k];
              return (
                <button
                  key={k}
                  type="button"
                  className="btn"
                  aria-pressed={on}
                  onClick={() => onToggleType(k)}
                  style={{
                    background: on ? m.tint : C.white,
                    color: on ? m.dark : C.muted,
                    borderColor: on ? m.color : C.input,
                  }}
                >
                  {on ? "✓" : "+"} {m.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section style={cardStyle(C.green)}>
        <h2 style={{ ...HEADING, margin: "0 0 12px", fontSize: 18 }}>Test history</h2>
        {history.length === 0 && (
          <p style={{ margin: 0, fontSize: 14, color: C.muted }}>No tests yet. Your scores will appear here.</p>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {history.map((h) => {
            const p = h.total ? Math.round((h.right / h.total) * 100) : 0;
            const color = scoreColor(p);
            return (
              <div
                key={h.id}
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: "#F5F3FF",
                }}
              >
                <span style={{ ...HEADING, fontWeight: 700, fontSize: 18, minWidth: 64, color }}>{p}%</span>
                <span style={{ flex: "1 1 160px", fontSize: 14 }}>
                  {h.right} / {h.total} correct · {SPEED_LABEL[h.speed]}
                </span>
                <span style={{ fontSize: 13, color: C.muted }}>{h.date}</span>
                <div style={{ flex: "0 0 120px", height: 8, borderRadius: 4, background: C.track, overflow: "hidden" }}>
                  <div style={{ height: 8, background: color, width: `${p}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
