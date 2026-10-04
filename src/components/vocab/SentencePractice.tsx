"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { PhraseWithSentences } from "@/lib/actions/phrases";
import { saveSentence } from "@/lib/actions/phrases";
import { checkSentence } from "@/lib/srs";
import { topicName } from "@/lib/topics";
import { kindStyle } from "@/lib/page-colors";
import { useToast } from "@/components/Toast";
import { VietnamesePanel } from "./VietnamesePanel";

export function SentencePractice({
  queue,
  writtenToday,
  goal,
  initialId,
}: {
  queue: PhraseWithSentences[];
  writtenToday: number;
  goal: number;
  initialId: number | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [curId, setCurId] = useState<number | null>(initialId);
  const [text, setText] = useState("");
  const [feedback, setFeedback] = useState("");
  const [showVi, setShowVi] = useState(false);
  const [pending, start] = useTransition();

  const item = queue.find((i) => i.id === curId) ?? queue[0];

  if (!item) {
    return (
      <section className="card p-8 text-center text-muted">Your phrase bank is empty. Add some phrases first.</section>
    );
  }

  const kind = kindStyle(item.kind);
  const topic = topicName(item.topic);
  const task = `Write one sentence about ${topic.toLowerCase()}${
    item.sentences.length ? " (try a different angle from last time)" : ""
  } using “${item.phrase}”, as if you were writing Task 2.`;

  const nextPhrase = () => {
    const idx = queue.findIndex((i) => i.id === item.id);
    const nx = queue[(idx + 1) % queue.length];
    setCurId(nx ? nx.id : null);
    setText("");
    setFeedback("");
    setShowVi(false);
  };

  const check = () => setFeedback(checkSentence(item, text).msg);

  const save = () => {
    start(async () => {
      const r = await saveSentence(item.id, text);
      if (r.ok) {
        setText("");
        setFeedback("");
        toast(r.message);
        router.refresh();
      } else {
        setFeedback(r.message);
      }
    });
  };

  return (
    <div className="flex flex-wrap items-start gap-4">
      <section
        className="min-w-0 rounded-[14px] border border-line bg-surface p-7"
        style={{ flex: "999 1 460px" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-[13px] text-muted">
            Written today:{" "}
            <strong className="text-ink">
              {writtenToday} / {goal}
            </strong>{" "}
            sentences
          </div>
          <button type="button" className="btn min-h-9 text-[13px]" onClick={nextPhrase}>
            Another phrase
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          <span
            className="rounded-xl px-2.5 py-1 text-xs font-semibold"
            style={{ background: kind.bg, color: kind.fg }}
          >
            {kind.label}
          </span>
          <span className="rounded-xl bg-ground px-2.5 py-1 text-xs">{topic}</span>
        </div>
        <div className="mt-3 font-heading text-[32px] font-bold">{item.phrase}</div>
        <div className="mt-1 text-base text-muted-2">{item.meaning}</div>
        <div className="mt-2.5 text-[15px] italic text-muted">Example: {item.example}</div>
        <VietnamesePanel
          key={item.id}
          className="mt-3"
          phraseId={item.id}
          vi={item.vi}
          viNote={item.viNote}
          open={showVi}
          onToggle={() => setShowVi((v) => !v)}
          onSaved={() => router.refresh()}
        />
        <div className="mt-5 rounded-[10px] bg-accent-soft px-4 py-3.5 text-[15px] text-accent-deep">{task}</div>
        <label className="sr" htmlFor="sent-input">
          Your sentence
        </label>
        <textarea
          id="sent-input"
          className="inp mt-3.5 text-base"
          rows={4}
          placeholder="Write your sentence…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="btn" onClick={check} disabled={pending}>
            Check
          </button>
          <button type="button" className="btn btn-p" onClick={save} disabled={pending}>
            {pending ? "Saving…" : "Save sentence"}
          </button>
        </div>
        {feedback && (
          <div
            className="mt-3 whitespace-pre-line rounded-lg bg-ground px-3.5 py-3 text-sm leading-[1.7]"
            role="status"
          >
            {feedback}
          </div>
        )}
      </section>
      <aside className="min-w-0 rounded-[14px] border border-line bg-surface p-5" style={{ flex: "1 1 280px" }}>
        <h2 className="mb-2.5 mt-0 font-heading text-lg">Your sentences with this phrase</h2>
        {item.sentences.length === 0 && (
          <p className="m-0 text-sm text-muted">
            None yet. Write at least 2 sentences on 2 different topics so it sticks.
          </p>
        )}
        <div className="flex flex-col gap-2">
          {item.sentences.map((s) => (
            <div key={s.id} className="rounded-lg bg-ground px-3 py-2.5 text-sm leading-[1.55]">
              {s.text}
              <div className="mt-1 text-xs text-muted">{s.date}</div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
