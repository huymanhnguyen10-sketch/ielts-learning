"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface TimerPhase {
  seconds: number;
  label: string;
}

export interface TimerProps {
  seconds: number;
  label: string;
  /** Phase to roll into automatically when the countdown reaches zero. */
  next?: TimerPhase;
  /** Changing this (or `seconds`) resets the timer to its initial phase. */
  resetKey?: string | number;
}

function fmt(secs: number): string {
  const mm = Math.floor(secs / 60);
  const ss = secs % 60;
  return `${mm}:${ss < 10 ? "0" : ""}${ss}`;
}

/** Dark countdown bar shared by Writing and Speaking (prototype "TIMER" block). */
export function Timer({ seconds, label, next, resetKey }: TimerProps) {
  const [secs, setSecs] = useState(seconds);
  const [text, setText] = useState(label);
  const [running, setRunning] = useState(false);
  const secsRef = useRef(seconds);
  const nextRef = useRef<TimerPhase | null>(next ?? null);
  const interval = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (interval.current) clearInterval(interval.current);
    interval.current = null;
  }, []);

  const reset = useCallback(() => {
    stop();
    setRunning(false);
    secsRef.current = seconds;
    setSecs(seconds);
    setText(label);
    nextRef.current = next ?? null;
  }, [stop, seconds, label, next]);

  // Reset whenever the initial phase changes.
  const nextSeconds = next?.seconds;
  const nextLabel = next?.label;
  useEffect(() => {
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds, label, nextSeconds, nextLabel, resetKey]);

  // Drive the countdown while running.
  useEffect(() => {
    if (!running) return;
    interval.current = setInterval(() => {
      const s = secsRef.current;
      if (s <= 1) {
        const n = nextRef.current;
        if (n) {
          nextRef.current = null;
          secsRef.current = n.seconds;
          setSecs(n.seconds);
          setText(n.label);
          return;
        }
        stop();
        secsRef.current = 0;
        setSecs(0);
        setRunning(false);
        setText((t) => (t.endsWith(" · time up") ? t : t + " · time up"));
        return;
      }
      secsRef.current = s - 1;
      setSecs(s - 1);
    }, 1000);
    return stop;
  }, [running, stop]);

  // Clear on unmount.
  useEffect(() => stop, [stop]);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl bg-ink px-5 py-3.5 text-white">
      <div className="text-[13px] uppercase tracking-[0.08em] text-on-dark">{text}</div>
      <div aria-live="polite" className="flex-1 font-heading text-[32px] font-bold tabular">
        {fmt(secs)}
      </div>
      {running ? (
        <button
          type="button"
          className="btn btn-dark"
          onClick={() => {
            stop();
            setRunning(false);
          }}
        >
          Pause
        </button>
      ) : secs > 0 ? (
        <button type="button" className="btn btn-dark" onClick={() => setRunning(true)}>
          Start
        </button>
      ) : null}
      <button type="button" className="btn btn-dark" onClick={reset}>
        Reset
      </button>
    </div>
  );
}
