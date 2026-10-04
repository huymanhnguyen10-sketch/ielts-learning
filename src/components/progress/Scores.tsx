"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useToast } from "@/components/Toast";
import { addScore, removeScore } from "@/lib/actions/scores";
import { fmtBand, isValidBand } from "@/lib/ielts";

export interface ScoreItem {
  id: number;
  date: string;
  listening: number;
  reading: number;
  writing: number;
  speaking: number;
  overall: number;
}

interface Props {
  today: string;
  scores: ScoreItem[];
}

type BandField = "listening" | "reading" | "writing" | "speaking";

const FIELDS: Array<[BandField, string]> = [
  ["listening", "Listening"],
  ["reading", "Reading"],
  ["writing", "Writing"],
  ["speaking", "Speaking"],
];

const EMPTY: Record<BandField, string> = { listening: "", reading: "", writing: "", speaking: "" };

export function Scores({ today, scores }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [date, setDate] = useState(today);
  const [bands, setBands] = useState<Record<BandField, string>>(EMPTY);

  const save = () => {
    const vals = FIELDS.map(([f]) => bands[f]);
    if (!vals.every(isValidBand)) {
      toast("Enter all four bands (0–9, steps of 0.5).");
      return;
    }
    start(async () => {
      const r = await addScore({
        date,
        listening: parseFloat(bands.listening),
        reading: parseFloat(bands.reading),
        writing: parseFloat(bands.writing),
        speaking: parseFloat(bands.speaking),
      });
      toast(r.message);
      if (r.ok) {
        setBands(EMPTY);
        router.refresh();
      }
    });
  };

  const remove = (id: number) => {
    start(async () => {
      const r = await removeScore(id);
      toast(r.message);
      router.refresh();
    });
  };

  return (
    <>
      <section className="card p-6">
        <h2 className="m-0 mb-1 font-heading text-xl">Log a mock test</h2>
        <p className="m-0 mb-3.5 text-sm text-muted">
          Bands 0–9 in steps of 0.5. Overall is the average, rounded the IELTS way.
        </p>
        <div
          className="grid items-end gap-3"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))" }}
        >
          <label className="text-[13px] font-semibold">
            Date
            <input
              className="inp mt-1.5 font-normal"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          {FIELDS.map(([f, label]) => (
            <label key={f} className="text-[13px] font-semibold">
              {label}
              <input
                className="inp mt-1.5 font-normal"
                type="number"
                min={0}
                max={9}
                step={0.5}
                inputMode="decimal"
                value={bands[f]}
                onChange={(e) => {
                  const v = e.target.value;
                  setBands((b) => ({ ...b, [f]: v }));
                }}
              />
            </label>
          ))}
          <button type="button" className="btn btn-p" onClick={save} disabled={pending}>
            Save score
          </button>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="m-0 mb-3.5 font-heading text-xl">Score history</h2>
        {scores.length === 0 && (
          <p className="m-0 text-sm text-muted">No scores yet. Your first mock test sets the baseline.</p>
        )}
        {scores.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[15px]" style={{ minWidth: 520 }}>
              <thead>
                <tr className="text-left text-[13px] text-muted">
                  <th className="p-2">Date</th>
                  <th className="p-2">L</th>
                  <th className="p-2">R</th>
                  <th className="p-2">W</th>
                  <th className="p-2">S</th>
                  <th className="p-2">Overall</th>
                  <th className="p-2">
                    <span className="sr">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {scores.map((r) => (
                  <tr key={r.id} className="border-t border-line">
                    <td className="px-2 py-2.5 tabular">{r.date}</td>
                    <td className="px-2 py-2.5 tabular">{fmtBand(r.listening)}</td>
                    <td className="px-2 py-2.5 tabular">{fmtBand(r.reading)}</td>
                    <td className="px-2 py-2.5 tabular">{fmtBand(r.writing)}</td>
                    <td className="px-2 py-2.5 tabular">{fmtBand(r.speaking)}</td>
                    <td className="px-2 py-2.5 font-bold tabular">{fmtBand(r.overall)}</td>
                    <td className="px-2 py-1.5 text-right">
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => remove(r.id)}
                        disabled={pending}
                        aria-label={`Delete score from ${r.date}`}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
