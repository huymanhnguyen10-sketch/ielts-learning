"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { shuffle, type PoolItem } from "@/lib/quiz";
import { topicName } from "@/lib/topics";
import { C, HEADING, kindStyle, pill, type FlashFront } from "./shared";
import styles from "./flip.module.css";

type Mark = "know" | "learn";

const FRONT_OPTS: ReadonlyArray<readonly [FlashFront, string]> = [
  ["phrase", "Front: phrase"],
  ["meaning", "Front: meaning"],
];

/**
 * Flashcard deck. The parent owns the id list (and remounts this view with a new `key` for each
 * deck) so "Shuffle" / "Study still learning again" always start a clean run.
 */
export function FlashcardsView({
  items,
  ids,
  front,
  onFront,
  onBack,
  onShuffle,
  onRestart,
  onQuiz,
}: {
  items: PoolItem[];
  ids: number[];
  front: FlashFront;
  onFront: (f: FlashFront) => void;
  onBack: () => void;
  onShuffle: () => void;
  onRestart: (ids: number[]) => void;
  onQuiz: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [flip, setFlip] = useState(false);
  const [marks, setMarks] = useState<Record<number, Mark>>({});

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const cur = idx < ids.length ? byId.get(ids[idx]) ?? null : null;
  const knownN = ids.filter((id) => marks[id] === "know").length;
  const learnIds = ids.filter((id) => marks[id] === "learn");
  const done = !cur && ids.length > 0;
  const pct = ids.length ? (idx / ids.length) * 100 : 0;

  const mark = useCallback(
    (m: Mark) => {
      if (!cur) return;
      setMarks((prev) => ({ ...prev, [cur.id]: m }));
      setIdx((i) => i + 1);
      setFlip(false);
    },
    [cur],
  );
  const prev = useCallback(() => {
    setIdx((i) => Math.max(0, i - 1));
    setFlip(false);
  }, []);
  const next = useCallback(() => {
    setIdx((i) => i + 1);
    setFlip(false);
  }, []);

  useEffect(() => {
    if (!cur) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName ?? "";
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) return;
      if (e.key === " " || e.key === "Enter") {
        if (tag === "BUTTON" || tag === "A") return; // the focused control handles it
        e.preventDefault();
        setFlip((f) => !f);
      } else if (e.key === "1") {
        e.preventDefault();
        mark("learn");
      } else if (e.key === "2") {
        e.preventDefault();
        mark("know");
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cur, mark, prev, next]);

  const ks = cur ? kindStyle(cur.kind) : null;
  const frontText = cur ? (front === "phrase" ? cur.phrase : cur.meaning) : "";
  const backText = cur ? (front === "phrase" ? cur.meaning : cur.phrase) : "";

  return (
    <>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
        <button type="button" className="btn" onClick={onBack}>
          ← Back to setup
        </button>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }} role="group" aria-label="Card front">
          {FRONT_OPTS.map(([v, label]) => (
            <button
              key={v}
              type="button"
              className="btn"
              aria-pressed={front === v}
              onClick={() => {
                onFront(v);
                setFlip(false);
              }}
              style={pill(front === v, C.pink)}
            >
              {label}
            </button>
          ))}
          <button type="button" className="btn" onClick={onShuffle}>
            Shuffle
          </button>
        </div>
      </div>

      {cur && ks && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: C.muted }}>
            <span aria-live="polite">
              Card {Math.min(idx + 1, ids.length)} of {ids.length}
            </span>
            <span>
              <strong style={{ color: C.green }}>{knownN} know</strong> ·{" "}
              <strong style={{ color: C.rust }}>{learnIds.length} still learning</strong>
            </span>
          </div>
          <div
            style={{ height: 8, borderRadius: 4, background: C.track, overflow: "hidden" }}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={ids.length}
            aria-valuenow={idx}
            aria-label="Deck progress"
          >
            <div style={{ height: 8, background: C.pink, width: `${pct}%` }} />
          </div>
          <button
            type="button"
            className={styles.flip}
            onClick={() => setFlip((f) => !f)}
            aria-label="Flip card"
            aria-pressed={flip}
          >
            <div className={styles.inner} style={{ transform: `rotateY(${flip ? 180 : 0}deg)` }}>
              <div
                className={styles.face}
                aria-hidden={flip}
                style={{
                  background: C.white,
                  border: `2px solid ${C.pink}`,
                  boxShadow: "0 10px 30px rgba(43, 27, 107, 0.10)",
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    padding: "4px 10px",
                    borderRadius: 12,
                    background: ks.bg,
                    color: ks.fg,
                  }}
                >
                  {ks.label} · {topicName(cur.topic)}
                </span>
                <span
                  style={{
                    ...HEADING,
                    fontSize: "clamp(26px, 3.6vw, 40px)",
                    fontWeight: 700,
                    lineHeight: 1.2,
                    color: C.text,
                  }}
                >
                  {frontText}
                </span>
                <span style={{ fontSize: 14, color: C.muted }}>Tap to flip</span>
              </div>
              <div
                className={`${styles.face} ${styles.back}`}
                aria-hidden={!flip}
                style={{ background: C.pink, color: C.white }}
              >
                <span style={{ ...HEADING, fontSize: "clamp(22px, 3vw, 32px)", fontWeight: 700, lineHeight: 1.25 }}>
                  {backText}
                </span>
                {cur.example && (
                  <span style={{ fontSize: 16, lineHeight: 1.6, fontStyle: "italic", maxWidth: 560 }}>{cur.example}</span>
                )}
                {cur.vi && (
                  <span
                    lang="vi"
                    style={{
                      fontSize: 14,
                      padding: "4px 12px",
                      borderRadius: 12,
                      background: C.white,
                      color: "#C02C6C",
                    }}
                  >
                    {cur.vi}
                  </span>
                )}
              </div>
            </div>
          </button>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
            <button
              type="button"
              className="btn"
              onClick={() => mark("learn")}
              title="Press 1"
              style={{ minHeight: 52, background: C.redTint, borderColor: C.red, color: C.redDark, fontWeight: 600 }}
            >
              Still learning
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => mark("know")}
              title="Press 2"
              style={{ minHeight: 52, background: C.greenTint, borderColor: C.green, color: C.greenDark, fontWeight: 600 }}
            >
              I know it
            </button>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <button type="button" className="btn" onClick={prev} disabled={idx === 0}>
              ← Previous
            </button>
            <button type="button" className="btn" onClick={next}>
              Skip →
            </button>
          </div>
        </>
      )}

      {done && (
        <section
          style={{
            background: C.white,
            border: `1px solid ${C.line}`,
            borderTop: `6px solid ${C.pink}`,
            borderRadius: 14,
            padding: "36px 24px",
            textAlign: "center",
          }}
        >
          <div style={{ ...HEADING, fontSize: 26, fontWeight: 700 }}>Deck finished</div>
          <p style={{ margin: "8px 0 20px", color: C.muted }}>
            You know {knownN} of {ids.length} cards
            {learnIds.length ? ` and ${learnIds.length} need more practice.` : ". Great work!"}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
            {learnIds.length > 0 && (
              <button
                type="button"
                className="btn"
                onClick={() => onRestart(shuffle(learnIds))}
                style={{ background: C.pink, borderColor: C.pink, color: C.white }}
              >
                Study “still learning” again
              </button>
            )}
            <button type="button" className="btn" onClick={onShuffle}>
              Shuffle all again
            </button>
            <button
              type="button"
              className="btn"
              onClick={onQuiz}
              style={{ background: C.violet, borderColor: C.violet, color: C.white }}
            >
              Take a quick test
            </button>
          </div>
        </section>
      )}
    </>
  );
}
