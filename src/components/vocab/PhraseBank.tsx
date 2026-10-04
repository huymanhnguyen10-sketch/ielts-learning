"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { PhraseWithSentences } from "@/lib/actions/phrases";
import { deletePhrase, togglePhraseKind } from "@/lib/actions/phrases";
import { diffDays, today } from "@/lib/dates";
import { intervalLabel, status, statusName } from "@/lib/srs";
import { SOURCES, TOPICS, topicName } from "@/lib/topics";
import { TOPIC_PALETTE } from "@/lib/page-colors";
import { FlagIcon } from "@/components/Icons";
import { useToast } from "@/components/Toast";
import { VietnamesePanel } from "./VietnamesePanel";

export function PhraseBank({ items }: { items: PhraseWithSentences[] }) {
  const router = useRouter();
  const toast = useToast();
  const [topic, setTopic] = useState("All");
  const [source, setSource] = useState("All");
  const [kind, setKind] = useState("All");
  const [stat, setStat] = useState("All");
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [viOpen, setViOpen] = useState<Record<number, boolean>>({});
  const [pending, start] = useTransition();

  const T = today();
  const q = query.trim().toLowerCase();
  const rows = items.filter(
    (i) =>
      (topic === "All" || i.topic === topic) &&
      (source === "All" || i.source === source) &&
      (kind === "All" || i.kind === kind) &&
      (stat === "All" || status(i) === stat) &&
      (!q || `${i.phrase} ${i.meaning} ${i.example} ${i.vi}`.toLowerCase().includes(q)),
  );

  // Topic cards cycle through 8 colour pairs [strong, tint]; solid when selected (prototype `topicCards`).
  const topicCards = [
    { k: "All", name: "All topics", n: items.length },
    ...TOPICS.map((t) => ({ k: t[0], name: t[1], n: items.filter((i) => i.topic === t[0]).length })),
  ].map((t, ix) => {
    const [strong, tint] = TOPIC_PALETTE[ix % TOPIC_PALETTE.length];
    const on = topic === t.k;
    return { ...t, bg: on ? strong : tint, fg: on ? "#FFFFFF" : strong, bd: strong };
  });

  const toggleKind = (id: number) => {
    setBusyId(id);
    start(async () => {
      const r = await togglePhraseKind(id);
      toast(r.message);
      router.refresh();
      setBusyId(null);
    });
  };

  const remove = (id: number) => {
    setBusyId(id);
    start(async () => {
      const r = await deletePhrase(id);
      toast(r.message);
      router.refresh();
      setBusyId(null);
    });
  };

  const toggleVi = (id: number) => setViOpen((s) => ({ ...s, [id]: !s[id] }));

  return (
    <div className="flex flex-col gap-6">
      <section className="card p-5" style={{ borderTop: "5px solid #E8488A" }}>
        <h2 className="mb-3 mt-0 font-heading text-lg">Topics</h2>
        <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(160px,1fr))]" role="group" aria-label="Filter by topic">
          {topicCards.map((tc) => (
            <button
              key={tc.k}
              type="button"
              className="btn min-h-[60px] flex-col items-start gap-0.5 text-left"
              aria-pressed={topic === tc.k}
              onClick={() => setTopic(tc.k)}
              style={{ background: tc.bg, color: tc.fg, borderColor: tc.bd }}
            >
              <span className="font-semibold">{tc.name}</span>
              <span className="text-xs font-normal opacity-85">{tc.n} phrases</span>
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="flex flex-wrap items-end gap-2.5 p-4">
          <label className="label" style={{ flex: "2 1 220px" }}>
            Search
            <input
              className="inp mt-1.5 font-normal"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Phrase, meaning, example…"
            />
          </label>
          <label className="label" style={{ flex: "1 1 140px" }}>
            Source
            <select className="inp mt-1.5 font-normal" value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="All">All</option>
              {SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="label" style={{ flex: "1 1 160px" }}>
            Type
            <select className="inp mt-1.5 font-normal" value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="All">All</option>
              <option value="academic">Academic</option>
              <option value="everyday">Everyday / spoken</option>
            </select>
          </label>
          <label className="label" style={{ flex: "1 1 140px" }}>
            Status
            <select className="inp mt-1.5 font-normal" value={stat} onChange={(e) => setStat(e.target.value)}>
              <option value="All">All</option>
              <option value="new">New</option>
              <option value="learning">Learning</option>
              <option value="known">Known</option>
            </select>
          </label>
        </div>
        <div className="px-4 pb-3 text-[13px] text-muted" aria-live="polite">
          {rows.length} {rows.length === 1 ? "phrase" : "phrases"}
        </div>
        {rows.length === 0 && (
          <div className="border-t border-line px-4 py-8 text-center text-muted">No phrases match these filters.</div>
        )}
        {rows.map((r) => {
          const ev = r.kind === "everyday";
          const busy = pending && busyId === r.id;
          const open = !!viOpen[r.id];
          const statusLabel =
            statusName(r) +
            (r.reps
              ? " · next review " + (r.due <= T ? "today" : "in " + intervalLabel(diffDays(T, r.due)))
              : "");
          return (
            <div key={r.id} className="flex flex-wrap items-start gap-x-4 gap-y-3 border-t border-line p-4">
              <div className="min-w-0" style={{ flex: "1 1 320px" }}>
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-heading text-[19px] font-bold">{r.phrase}</span>
                  <span className="text-[15px] text-muted-2">{r.meaning}</span>
                </div>
                <div className="mt-1 text-sm italic text-muted">{r.example}</div>
                <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                  <span className="rounded-[10px] bg-ground px-[9px] py-[3px]">{topicName(r.topic)}</span>
                  <span className="rounded-[10px] bg-ground px-[9px] py-[3px]">
                    {r.source + (r.sourceNote ? " · " + r.sourceNote : "")}
                  </span>
                  <span className="rounded-[10px] bg-ground px-[9px] py-[3px]">{statusLabel}</span>
                  <span className="rounded-[10px] bg-ground px-[9px] py-[3px]">
                    {r.sentences.length} {r.sentences.length === 1 ? "own sentence" : "own sentences"}
                  </span>
                </div>
                {open && (
                  <VietnamesePanel
                    className="mt-2.5"
                    phraseId={r.id}
                    vi={r.vi}
                    viNote={r.viNote}
                    open
                    compact
                    onSaved={() => router.refresh()}
                  />
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  className="btn"
                  aria-pressed={ev}
                  aria-label={`${ev ? "Everyday" : "Academic"} phrase. Toggle type`}
                  disabled={busy}
                  onClick={() => toggleKind(r.id)}
                  style={{
                    background: ev ? "#FFEBDA" : "#EEEAFE",
                    color: ev ? "#8A4209" : "#3B2799",
                    borderColor: ev ? "#E8B98E" : "#B7A8F5",
                  }}
                >
                  <FlagIcon />
                  {ev ? "Everyday" : "Academic"}
                </button>
                <button
                  type="button"
                  className="btn btn-vi"
                  aria-expanded={open}
                  onClick={() => toggleVi(r.id)}
                >
                  {open ? "Hide Vietnamese" : "Vietnamese"}
                </button>
                <Link href={`/sentence?phrase=${r.id}`} className="btn">
                  Practise
                </Link>
                <button
                  type="button"
                  className="btn"
                  aria-label="Delete phrase"
                  disabled={busy}
                  onClick={() => remove(r.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
