"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createPhrase } from "@/lib/actions/phrases";
import { selectionIn } from "@/lib/selection";
import { KINDS, SOURCES, TOPICS, type Kind, type Source } from "@/lib/topics";
import { useToast } from "@/components/Toast";
import { TranslateIcon } from "@/components/Icons";

const KIND_OPTS: ReadonlyArray<readonly [Kind, string, string]> = [
  ["academic", "Academic", "Practise deeply, recall the phrase"],
  ["everyday", "Everyday / spoken", "Light review, recognition is enough"],
];

export interface AddPhrasePrefill {
  phrase?: string;
  example?: string;
  source?: string;
  note?: string;
  src?: string;
}

function asSource(s: string | undefined): Source {
  return SOURCES.includes(s as Source) ? (s as Source) : "Writing";
}

export function AddPhrase({ initial = {} }: { initial?: AddPhrasePrefill }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();

  const [srcText, setSrcText] = useState(initial.src ?? "");
  const [phrase, setPhrase] = useState(initial.phrase ?? "");
  const [meaning, setMeaning] = useState("");
  const [example, setExample] = useState(initial.example ?? "");
  const [source, setSource] = useState<Source>(asSource(initial.source));
  const [topic, setTopic] = useState<string>(TOPICS[0][0]);
  const [note, setNote] = useState(initial.note ?? "");
  const [related, setRelated] = useState("");
  const [kind, setKind] = useState<Kind>(KINDS[0]);
  const [vi, setVi] = useState("");
  const [viNote, setViNote] = useState("");
  const [translating, setTranslating] = useState(false);

  const autoVi = async () => {
    if (!phrase.trim()) {
      toast("Enter the phrase first.");
      return;
    }
    setTranslating(true);
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phrase: phrase.trim(), meaning: meaning.trim(), example: example.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { vi?: string; viNote?: string; message?: string; error?: string };
      if (!res.ok) {
        toast(data.error || `Translation failed (${res.status}).`);
        return;
      }
      if (data.vi || data.viNote) {
        setVi(data.vi || "");
        setViNote(data.viNote || "");
      } else {
        toast(data.message || "No translation available.");
      }
    } catch {
      toast("Could not reach the server. Please try again.");
    } finally {
      setTranslating(false);
    }
  };

  const grab = () => {
    const r = selectionIn(srcText);
    if (!r) return;
    setPhrase(r.sel);
    setExample(r.sentence);
    toast(`Captured “${r.sel}”. Add the meaning, then save.`);
  };

  const save = () => {
    start(async () => {
      const r = await createPhrase({ phrase, meaning, example, source, sourceNote: note, topic, kind, related, vi, viNote });
      toast(r.message);
      if (r.ok) {
        setPhrase("");
        setMeaning("");
        setExample("");
        setRelated("");
        setVi("");
        setViNote("");
        router.refresh();
      }
    });
  };

  return (
    <div className="flex flex-wrap items-start gap-4">
      <section className="card min-w-0 p-5" style={{ flex: "1 1 400px" }}>
        <h2 className="mb-1 mt-0 font-heading text-lg">1. Paste source text</h2>
        <p className="mb-3 mt-0 text-[13px] text-muted">
          Your essay, a Reading passage or a Listening transcript. Highlight a phrase to capture it; the sentence
          around it becomes the example.
        </p>
        <label className="sr" htmlFor="add-src">
          Source text
        </label>
        <textarea
          id="add-src"
          className="inp"
          rows={5}
          value={srcText}
          onChange={(e) => setSrcText(e.target.value)}
          placeholder="Paste text here…"
        />
        {srcText && (
          <>
            <div className="mb-1.5 mt-3 text-xs uppercase tracking-[0.08em] text-muted">Highlight a phrase below</div>
            <div
              onMouseUp={grab}
              className="cursor-text whitespace-pre-wrap rounded-[10px] border border-line bg-ground-2 px-4 py-3.5 text-base leading-[1.8]"
            >
              {srcText}
            </div>
          </>
        )}
      </section>

      <section className="card min-w-0 p-5" style={{ flex: "1 1 400px" }}>
        <h2 className="mb-3 mt-0 font-heading text-lg">2. Save the phrase</h2>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!pending) save();
          }}
        >
          <label className="label">
            Phrase (collocation)
            <input
              className="inp mt-1.5 text-base font-normal"
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              placeholder="e.g. have a detrimental effect on"
            />
          </label>
          <label className="label">
            Meaning
            <input
              className="inp mt-1.5 font-normal"
              value={meaning}
              onChange={(e) => setMeaning(e.target.value)}
              placeholder="In your own words"
            />
          </label>
          <label className="label">
            Example sentence
            <textarea
              className="inp mt-1.5 font-normal"
              rows={2}
              value={example}
              onChange={(e) => setExample(e.target.value)}
            />
          </label>
          <div className="flex flex-col gap-2.5 rounded-[10px] border border-vi-line bg-vi-bg p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[13px] font-semibold text-vi-text">Vietnamese (optional)</span>
              <button
                type="button"
                className="btn btn-vi text-[13px]"
                style={{ minHeight: 36, background: "#FFFFFF" }}
                onClick={autoVi}
                disabled={translating || pending}
              >
                <TranslateIcon />
                {translating ? "Translating…" : "Auto-fill in Vietnamese"}
              </button>
            </div>
            <label className="label">
              Vietnamese meaning
              <input
                className="inp mt-1.5 font-normal"
                lang="vi"
                value={vi}
                onChange={(e) => setVi(e.target.value)}
                placeholder="Nghĩa tiếng Việt"
              />
            </label>
            <label className="label">
              Explanation in Vietnamese
              <textarea
                className="inp mt-1.5 font-normal"
                lang="vi"
                rows={2}
                value={viNote}
                onChange={(e) => setViNote(e.target.value)}
                placeholder="Cách dùng, sắc thái, cấu trúc đi kèm…"
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="label">
              Source
              <select
                className="inp mt-1.5 font-normal"
                value={source}
                onChange={(e) => setSource(asSource(e.target.value))}
              >
                {SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="label">
              Topic
              <select className="inp mt-1.5 font-normal" value={topic} onChange={(e) => setTopic(e.target.value)}>
                {TOPICS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="label">
            Source note (optional)
            <input
              className="inp mt-1.5 font-normal"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. My Task 2 essay, Cambridge 18 Test 2"
            />
          </label>
          <label className="label">
            Related phrases (optional)
            <input
              className="inp mt-1.5 font-normal"
              value={related}
              onChange={(e) => setRelated(e.target.value)}
              placeholder="e.g. adverse effect, negative impact"
            />
          </label>
          <div>
            <div className="label mb-1.5">Type</div>
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Phrase type">
              {KIND_OPTS.map(([k, label, sub]) => {
                const on = kind === k;
                return (
                  <button
                    key={k}
                    type="button"
                    className="btn min-h-[60px] flex-col items-start gap-0.5 text-left"
                    aria-pressed={on}
                    onClick={() => setKind(k)}
                    style={{
                      background: on ? (k === "academic" ? "#EEEAFE" : "#FFEBDA") : "#FFFFFF",
                      borderColor: on ? (k === "academic" ? "#5B3FD9" : "#F0623A") : "#D3CCEE",
                    }}
                  >
                    <span className="font-semibold">{label}</span>
                    <span className="text-xs font-normal text-muted">{sub}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <button type="submit" className="btn btn-p min-h-12" disabled={pending}>
            {pending ? "Saving…" : "Save to phrase bank"}
          </button>
        </form>
      </section>
    </div>
  );
}
