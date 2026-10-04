"use client";

import { useEffect, useState, useTransition } from "react";
import { saveVietnamese } from "@/lib/actions/phrases";
import { TranslateIcon } from "@/components/Icons";

export interface VietnamesePanelProps {
  phraseId: number;
  vi: string;
  viNote: string;
  /** Whether the panel body is shown. */
  open: boolean;
  /** When given, a toggle button is rendered above the panel. */
  onToggle?: () => void;
  /** Labels for the toggle button [closed, open]. */
  toggleLabels?: [string, string];
  /** Called after a translation was fetched or edited and saved on the server. */
  onSaved?: (vi: string, viNote: string) => void;
  /** Smaller text (phrase-bank rows). */
  compact?: boolean;
  className?: string;
}

type TranslateResponse = {
  vi?: string;
  viNote?: string;
  source?: string;
  message?: string;
  error?: string;
};

/**
 * "Translate & explain in Vietnamese" panel (SPEC §6): soft-orange box with
 * **Nghĩa** (meaning) and **Giải thích** (explanation). Fetches from /api/translate
 * on demand (cached on the Phrase) and lets the learner edit the text.
 */
export function VietnamesePanel({
  phraseId,
  vi: initialVi,
  viNote: initialViNote,
  open,
  onToggle,
  toggleLabels = ["Translate & explain in Vietnamese", "Hide Vietnamese"],
  onSaved,
  compact,
  className,
}: VietnamesePanelProps) {
  const [vi, setVi] = useState(initialVi);
  const [viNote, setViNote] = useState(initialViNote);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState(false);
  const [draftVi, setDraftVi] = useState(initialVi);
  const [draftNote, setDraftNote] = useState(initialViNote);
  const [saving, startSave] = useTransition();

  // Follow server data when the phrase (or its stored translation) changes.
  useEffect(() => {
    setVi(initialVi);
    setViNote(initialViNote);
    setDraftVi(initialVi);
    setDraftNote(initialViNote);
    setMessage("");
    setEditing(false);
  }, [phraseId, initialVi, initialViNote]);

  const empty = !vi && !viNote;

  const translate = async () => {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phraseId }),
      });
      const data = (await res.json().catch(() => ({}))) as TranslateResponse;
      if (!res.ok) {
        setMessage(data.error || `Translation failed (${res.status}).`);
        return;
      }
      const nv = data.vi || "";
      const nn = data.viNote || "";
      if (nv || nn) {
        setVi(nv);
        setViNote(nn);
        setDraftVi(nv);
        setDraftNote(nn);
        onSaved?.(nv, nn);
      } else {
        setMessage(data.message || "No translation available.");
      }
    } catch {
      setMessage("Could not reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const save = () => {
    startSave(async () => {
      const r = await saveVietnamese(phraseId, draftVi, draftNote);
      if (r.ok) {
        const nv = "vi" in r ? r.vi : draftVi.trim();
        const nn = "viNote" in r ? r.viNote : draftNote.trim();
        setVi(nv);
        setViNote(nn);
        setEditing(false);
        setMessage("");
        onSaved?.(nv, nn);
      } else {
        setMessage(r.message);
      }
    });
  };

  const fs = compact ? "text-sm" : "text-[15px]";

  return (
    <div className={`flex flex-col gap-2.5 ${className ?? ""}`}>
      {onToggle && (
        <button type="button" className="btn btn-vi self-start" aria-expanded={open} onClick={onToggle}>
          <TranslateIcon />
          {open ? toggleLabels[1] : toggleLabels[0]}
        </button>
      )}
      {open && (
        <div lang="vi" className={`vi-panel ${fs}`} style={compact ? { padding: "10px 14px" } : undefined}>
          {!editing && (
            <>
              {vi && (
                <div>
                  <strong>Nghĩa:</strong> {vi}
                </div>
              )}
              {viNote && (
                <div className={vi ? "mt-1" : ""}>
                  <strong>Giải thích:</strong> {viNote}
                </div>
              )}
              {empty && !message && (
                <div lang="en" className="flex flex-wrap items-center gap-2.5">
                  <span className="text-sm text-muted">
                    {loading ? "Translating…" : "No Vietnamese yet for this phrase."}
                  </span>
                  <button type="button" className="btn btn-sm btn-vi" onClick={translate} disabled={loading}>
                    <TranslateIcon size={14} />
                    {loading ? "Translating…" : "Translate"}
                  </button>
                </div>
              )}
              {message && (
                <div lang="en" className="text-sm text-muted" role="status">
                  {message}
                </div>
              )}
              <div lang="en" className="mt-2 flex flex-wrap gap-1.5">
                {!empty && (
                  <button type="button" className="btn btn-sm" onClick={() => setEditing(true)}>
                    Edit
                  </button>
                )}
                {!empty && !viNote && (
                  <button type="button" className="btn btn-sm btn-vi" onClick={translate} disabled={loading}>
                    <TranslateIcon size={14} />
                    {loading ? "Translating…" : "Explain in Vietnamese"}
                  </button>
                )}
                {empty && message && (
                  <button type="button" className="btn btn-sm" onClick={() => setEditing(true)}>
                    Write it myself
                  </button>
                )}
              </div>
            </>
          )}
          {editing && (
            <div className="flex flex-col gap-2.5" lang="en">
              <label className="label">
                Vietnamese meaning
                <input
                  className="inp mt-1.5 font-normal"
                  lang="vi"
                  value={draftVi}
                  onChange={(e) => setDraftVi(e.target.value)}
                  placeholder="Nghĩa tiếng Việt"
                />
              </label>
              <label className="label">
                Explanation in Vietnamese
                <textarea
                  className="inp mt-1.5 font-normal"
                  lang="vi"
                  rows={3}
                  value={draftNote}
                  onChange={(e) => setDraftNote(e.target.value)}
                  placeholder="Cách dùng, sắc thái, cấu trúc đi kèm…"
                />
              </label>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" className="btn btn-sm btn-p" onClick={save} disabled={saving}>
                  {saving ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => {
                    setDraftVi(vi);
                    setDraftNote(viNote);
                    setEditing(false);
                  }}
                  disabled={saving}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
