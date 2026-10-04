"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { fmtBand, listeningBand, markAnswers } from "@/lib/ielts";

export type AudioTrack = { id: number; title: string; url: string };

export interface ListeningTestOption {
  id: number;
  title: string;
  source: string;
}

export interface ListeningTestData {
  id: number;
  title: string;
  source: string;
  sourceUrl: string | null;
  audioUrl: string | null;
  transcriptUrl: string | null;
  answerKey: string;
  note: string;
}

interface Props {
  audios: AudioTrack[];
  tests: ListeningTestOption[];
  selected: ListeningTestData | null;
}

/** Group the bank by source, keeping first-seen order. */
function groupBySource(tests: ListeningTestOption[]): Array<[string, ListeningTestOption[]]> {
  const map = new Map<string, ListeningTestOption[]>();
  for (const t of tests) {
    const list = map.get(t.source);
    if (list) list.push(t);
    else map.set(t.source, [t]);
  }
  return [...map.entries()];
}

function playableAudio(url: string | null): string | null {
  const u = (url ?? "").trim();
  if (!u || /^todo/i.test(u)) return null;
  return u;
}

export function Listening({ audios, tests, selected }: Props) {
  const router = useRouter();
  const [audioId, setAudioId] = useState<number | null>(null);
  const [myAns, setMyAns] = useState("");
  const [keyAns, setKeyAns] = useState(selected?.answerKey ?? "");
  const [result, setResult] = useState("");
  const [wrongList, setWrongList] = useState("");

  const current = audios.find((a) => a.id === audioId) ?? audios[0];
  const groups = groupBySource(tests);
  const testAudio = selected ? playableAudio(selected.audioUrl) : null;

  const mark = () => {
    const { total, correct, wrong } = markAnswers(myAns, keyAns);
    if (!total) {
      setResult("Paste the answer key first.");
      setWrongList("");
      return;
    }
    setResult(
      `${correct} / ${total} correct` + (total === 40 ? ` · about band ${fmtBand(listeningBand(correct))}` : ""),
    );
    setWrongList(wrong.join("\n"));
  };

  const chooseTest = (value: string) => {
    router.push(value ? `/listening?test=${value}` : "/listening");
  };

  return (
    <>
      <section className="card min-w-0 p-6">
        <h2 className="m-0 mb-1 font-heading text-xl font-semibold">Test bank</h2>
        <p className="m-0 mb-3.5 text-sm text-muted">
          Official sample tasks and full tests with answer keys. Pick one, listen, write your answers, then mark
          them below.
        </p>
        <label className="label block max-w-[520px]">
          Choose a test
          <select
            className="inp mt-1.5 font-normal"
            value={selected ? String(selected.id) : ""}
            onChange={(e) => chooseTest(e.target.value)}
          >
            <option value="">{tests.length ? "— none —" : "No tests in the bank yet"}</option>
            {groups.map(([source, items]) => (
              <optgroup key={source} label={source}>
                {items.map((t) => (
                  <option key={t.id} value={String(t.id)}>
                    {t.title}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        {tests.length === 0 && (
          <p className="mt-2.5 mb-0 text-sm text-muted">
            The test bank is empty for now. Upload your own recordings with “Add to Listening” above and use the
            answer checker with any key.
          </p>
        )}

        {selected && (
          <div className="mt-4 border-t border-line pt-4">
            <div className="text-xs uppercase tracking-[0.08em] text-muted">{selected.source}</div>
            <h3 className="mt-1 mb-2.5 font-heading text-lg font-semibold [overflow-wrap:anywhere]">
              {selected.title}
            </h3>
            {testAudio && <audio key={selected.id} controls src={testAudio} className="mb-3 w-full" />}
            {(selected.sourceUrl || selected.transcriptUrl) && (
              <div className="flex flex-wrap gap-2">
                {selected.sourceUrl && (
                  <a className="btn btn-p" href={selected.sourceUrl} target="_blank" rel="noopener">
                    Open test
                  </a>
                )}
                {selected.transcriptUrl && (
                  <a className="btn" href={selected.transcriptUrl} target="_blank" rel="noopener">
                    Transcript
                  </a>
                )}
              </div>
            )}
            {!testAudio && !selected.sourceUrl && (
              <p className="m-0 text-sm text-muted">
                No recording is linked for this test yet — use the question paper below with your own audio.
              </p>
            )}
            {selected.note && (
              <details className="mt-3.5 rounded-[10px] border border-line">
                <summary className="cursor-pointer px-4 py-2.5 text-sm font-semibold">
                  Question paper &amp; tapescript
                </summary>
                <div
                  className="overflow-y-auto border-t border-line px-4 py-3 text-sm leading-relaxed whitespace-pre-line"
                  style={{ maxHeight: 360 }}
                >
                  {selected.note}
                </div>
              </details>
            )}
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-start gap-4">
        <section className="card min-w-0 p-6" style={{ flex: "1 1 380px" }}>
          <h2 className="m-0 mb-1 font-heading text-xl font-semibold">Audio player</h2>
          <p className="m-0 mb-3.5 text-sm text-muted">Plays any audio file you uploaded.</p>
          {!current && (
            <div className="rounded-[10px] bg-ground p-5 text-sm text-muted">
              No audio yet. Upload an MP3, WAV or M4A track with “Add to Listening” above.
            </div>
          )}
          {current && (
            <>
              <div className="mb-2.5 font-semibold [overflow-wrap:anywhere]">{current.title}</div>
              <audio key={current.id} controls src={current.url} className="w-full" />
            </>
          )}
          {audios.length > 1 && (
            <div className="mt-3.5 flex flex-col gap-1.5">
              {audios.map((a) => {
                const on = current !== undefined && a.id === current.id;
                return (
                  <button
                    key={a.id}
                    type="button"
                    className="btn"
                    aria-pressed={on}
                    onClick={() => setAudioId(a.id)}
                    style={{
                      justifyContent: "flex-start",
                      background: on ? "#EEEAFE" : "#FFFFFF",
                      borderColor: on ? "#5B3FD9" : "#D3CCEE",
                    }}
                  >
                    {a.title}
                  </button>
                );
              })}
            </div>
          )}
          <p className="mt-3.5 mb-0 text-[13px] text-muted">
            Heard a useful phrase? Paste the transcript into <strong>Add phrase</strong> and highlight it.
          </p>
        </section>

        <section className="card min-w-0 p-6" style={{ flex: "1 1 380px" }}>
          <h2 className="m-0 mb-1 font-heading text-xl font-semibold">Answer checker</h2>
          <p className="m-0 mb-3.5 text-sm text-muted">
            One answer per line. Works for any test in your library; 40 answers gives a band estimate.
            {selected && selected.answerKey && " The key for the selected test is filled in for you."}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <label className="label min-w-0">
              Your answers
              <textarea
                className="inp mt-1.5 font-normal"
                rows={10}
                value={myAns}
                onChange={(e) => setMyAns(e.target.value)}
              />
            </label>
            <label className="label min-w-0">
              Answer key
              <textarea
                className="inp mt-1.5 font-normal"
                rows={10}
                value={keyAns}
                onChange={(e) => setKeyAns(e.target.value)}
              />
            </label>
          </div>
          <div className="mt-3.5 flex flex-wrap items-center gap-2">
            <button type="button" className="btn btn-p" onClick={mark}>
              Mark
            </button>
            {result && <span className="font-semibold">{result}</span>}
          </div>
          {wrongList && (
            <div
              className="mt-3 rounded-lg p-3 text-sm whitespace-pre-line"
              style={{ background: "#FFEBDA", color: "#7C2D12" }}
            >
              {wrongList}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
