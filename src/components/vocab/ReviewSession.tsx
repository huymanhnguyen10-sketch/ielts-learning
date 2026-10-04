"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import type { Phrase } from "@prisma/client";
import { ratePhrase } from "@/lib/actions/phrases";
import { setReviewMode } from "@/lib/actions/settings";
import {
  blankOut,
  firstLetterHint,
  GRADES,
  intervalLabel,
  nextInterval,
  statusName,
  type Grade,
} from "@/lib/srs";
import { topicName } from "@/lib/topics";
import { kindStyle, onTab } from "@/lib/page-colors";
import { VietnamesePanel } from "./VietnamesePanel";

type Mode = "produce" | "recognize";

const MODES: ReadonlyArray<readonly [Mode, string]> = [
  ["produce", "Meaning → phrase"],
  ["recognize", "Phrase → meaning"],
];

const GR: Record<Grade, { label: string; bg: string; fg: string; bd: string }> = {
  again: { label: "Again", bg: "#FFFFFF", fg: "#8A4209", bd: "#E8B98E" },
  hard: { label: "Hard", bg: "#FFFFFF", fg: "#1E1B3A", bd: "#D3CCEE" },
  good: { label: "Good", bg: "#EEEAFE", fg: "#3B2799", bd: "#B7A8F5" },
  easy: { label: "Easy", bg: "#5B3FD9", fg: "#FFFFFF", bd: "#5B3FD9" },
};

export function ReviewSession({ queue: initialQueue, mode: initialMode }: { queue: Phrase[]; mode: Mode }) {
  const router = useRouter();
  const [queue, setQueue] = useState<Phrase[]>(initialQueue);
  const [pos, setPos] = useState(0);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [revealed, setRevealed] = useState(false);
  const [hint, setHint] = useState(false);
  const [showVi, setShowVi] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [pending, start] = useTransition();

  const inSession = pos < queue.length;
  const sessionDone = queue.length > 0 && pos >= queue.length;
  const noSession = queue.length === 0;
  const cur = inSession ? queue[pos] : null;

  const pickMode = (m: Mode) => {
    if (m === mode) return;
    setMode(m);
    setRevealed(false);
    setShowVi(false);
    start(async () => {
      await setReviewMode(m);
    });
  };

  const rate = useCallback(
    (g: Grade) => {
      const item = queue[pos];
      if (!item || pending) return;
      setQueue((q) => (g === "again" ? [...q, item] : q));
      setPos((p) => p + 1);
      setRevealed(false);
      setHint(false);
      setShowVi(false); // Vietnamese panel resets on the next card (SPEC §6)
      setReviewed((n) => n + 1);
      start(async () => {
        const upd = await ratePhrase(item.id, g);
        if (upd) setQueue((q) => q.map((x) => (x.id === upd.id ? upd : x)));
        router.refresh();
      });
    },
    [queue, pos, pending, router],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!inSession) return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName ?? "";
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) return;
      if (!revealed && (e.key === " " || e.key === "Enter")) {
        if (tag === "BUTTON" || tag === "A") return; // let the focused control handle it
        e.preventDefault();
        setRevealed(true);
        return;
      }
      if (revealed && /^[1-4]$/.test(e.key)) {
        e.preventDefault();
        rate(GRADES[Number(e.key) - 1]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inSession, revealed, rate]);

  // View model for the current card (prototype renderVals "Review card").
  let card: {
    bar: string;
    kind: ReturnType<typeof kindStyle>;
    topic: string;
    newLabel: string;
    prompt: string;
    front: string;
    frontSub: string;
    hint: string;
    back: string;
    example: string;
    related: string;
    source: string;
    canVi: boolean;
  } | null = null;
  if (cur) {
    const effMode: Mode = cur.kind === "everyday" ? "recognize" : mode;
    card = {
      bar: cur.kind === "everyday" ? "#FF9F43" : "#5B3FD9",
      kind: kindStyle(cur.kind),
      topic: topicName(cur.topic),
      newLabel: cur.reps ? statusName(cur) : "New phrase",
      prompt:
        effMode === "produce"
          ? "Recall the English phrase that means:"
          : cur.kind === "everyday" && mode === "produce"
            ? "Everyday phrase: recognising the meaning is enough"
            : "What does this phrase mean?",
      front: effMode === "produce" ? cur.meaning : cur.phrase,
      frontSub: effMode === "produce" ? blankOut(cur.example, cur.phrase) : cur.example,
      hint: firstLetterHint(cur.phrase),
      back: effMode === "produce" ? cur.phrase : cur.meaning,
      example: cur.example,
      related: cur.related,
      source: cur.source + (cur.sourceNote ? " · " + cur.sourceNote : ""),
      // Only after "Show answer" (or in Phrase → meaning mode) so it doesn't give the answer away.
      canVi: revealed || effMode === "recognize",
    };
  }
  const pct = queue.length ? (pos / queue.length) * 100 : 0;

  const onViSaved = (id: number, vi: string, viNote: string) =>
    setQueue((q) => q.map((x) => (x.id === id ? { ...x, vi, viNote } : x)));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Review direction">
          {MODES.map(([m, label]) => (
            <button
              key={m}
              type="button"
              className="btn"
              aria-pressed={mode === m}
              onClick={() => pickMode(m)}
              style={onTab(mode === m)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="text-sm text-muted" aria-live="polite">
          {inSession ? `Card ${pos + 1} of ${queue.length}` : ""}
        </div>
      </div>

      {noSession && (
        <section className="card px-6 py-10 text-center">
          <div className="font-heading text-2xl font-semibold">Nothing left to review today</div>
          <p className="mt-2 mb-5 text-muted">Add new phrases from your Writing, or practise making sentences.</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" className="btn btn-p" onClick={() => router.refresh()}>
              Check again
            </button>
            <Link href="/add" className="btn">
              Add phrases
            </Link>
          </div>
        </section>
      )}

      {inSession && card && cur && (
        <>
          <div
            className="h-1.5 overflow-hidden rounded-[3px] bg-track"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={queue.length}
            aria-valuenow={pos}
            aria-label="Session progress"
          >
            <div className="h-1.5 bg-primary" style={{ width: `${pct}%` }} />
          </div>
          <section
            className="flex min-h-[360px] flex-col gap-4 rounded-2xl border border-line bg-surface"
            style={{ padding: "32px clamp(20px, 4vw, 48px)", borderTop: `6px solid ${card.bar}` }}
          >
            <div className="flex flex-wrap gap-1.5">
              <span
                className="rounded-xl px-2.5 py-1 text-xs font-semibold"
                style={{ background: card.kind.bg, color: card.kind.fg }}
              >
                {card.kind.label}
              </span>
              <span className="rounded-xl bg-ground px-2.5 py-1 text-xs text-ink">{card.topic}</span>
              <span className="rounded-xl bg-ground px-2.5 py-1 text-xs text-ink">{card.newLabel}</span>
            </div>
            <div className="text-[13px] text-muted">{card.prompt}</div>
            <div
              className="font-heading font-bold leading-[1.2]"
              style={{ fontSize: "clamp(26px, 3.4vw, 38px)" }}
            >
              {card.front}
            </div>
            {card.frontSub && (
              <div className="text-[17px] italic leading-[1.6] text-muted-2">{card.frontSub}</div>
            )}
            {hint && !revealed && <div className="text-[15px] text-accent-text">Hint: {card.hint}</div>}
            {revealed && (
              <div className="flex flex-col gap-2 border-t border-dashed border-input pt-4">
                <div className="font-heading text-[26px] font-bold text-primary">{card.back}</div>
                <div className="text-base leading-[1.6]">{card.example}</div>
                {card.related && <div className="text-sm text-muted">Related: {card.related}</div>}
                <div className="text-[13px] text-muted">Source: {card.source}</div>
              </div>
            )}
            {card.canVi && (
              <VietnamesePanel
                key={cur.id}
                phraseId={cur.id}
                vi={cur.vi}
                viNote={cur.viNote}
                open={showVi}
                onToggle={() => setShowVi((v) => !v)}
                onSaved={(vi, viNote) => onViSaved(cur.id, vi, viNote)}
              />
            )}
            <div className="mt-auto pt-2">
              {!revealed && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn"
                    aria-pressed={hint}
                    onClick={() => setHint((h) => !h)}
                  >
                    Hint
                  </button>
                  <button
                    type="button"
                    className="btn btn-p flex-1 min-h-12"
                    onClick={() => setRevealed(true)}
                  >
                    Show answer
                  </button>
                </div>
              )}
              {revealed && (
                <div className="grid grid-cols-4 gap-2" role="group" aria-label="Grade this card">
                  {GRADES.map((g, i) => {
                    const c = GR[g];
                    return (
                      <button
                        key={g}
                        type="button"
                        className="btn flex-col gap-0.5 min-h-14"
                        disabled={pending}
                        onClick={() => rate(g)}
                        title={`Press ${i + 1}`}
                        style={{ background: c.bg, color: c.fg, borderColor: c.bd }}
                      >
                        <span className="font-semibold">{c.label}</span>
                        <span className="text-xs font-normal">{intervalLabel(nextInterval(cur, g))}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </>
      )}

      {sessionDone && (
        <section className="card px-6 py-10 text-center">
          <div className="font-heading text-[26px] font-bold">Review done for today</div>
          <p className="mt-2 mb-5 text-muted">
            You reviewed {reviewed} cards. Everyday phrases come back less often, so your time goes to academic
            ones.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Link href="/sentence" className="btn btn-p">
              Next: practise sentences
            </Link>
            <Link href="/" className="btn">
              Back to dashboard
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
