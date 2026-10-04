"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import type { DragEvent } from "react";
import type { Material } from "@prisma/client";
import { addLinkOrNote, removeMaterial, toggleStudied, uploadFiles } from "@/lib/actions/materials";
import { fmtSize } from "@/lib/ielts";
import { ymd } from "@/lib/dates";
import { SKILLS } from "@/lib/topics";
import { onTab } from "@/lib/page-colors";
import { useToast } from "@/components/Toast";
import { UploadIcon } from "@/components/Icons";

const FILTERS = ["All", ...SKILLS] as const;
type Filter = (typeof FILTERS)[number];

export function Library({ materials }: { materials: Material[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const [uploadSkill, setUploadSkill] = useState<string>("Reading");
  const [dragging, setDragging] = useState(false);
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkNote, setLinkNote] = useState("");
  const [filter, setFilter] = useState<Filter>("All");
  const [query, setQuery] = useState("");

  const addFiles = (list: FileList | null | undefined) => {
    const files = Array.from(list || []);
    setDragging(false);
    if (!files.length) return;
    const fd = new FormData();
    fd.set("skill", uploadSkill);
    files.forEach((f) => fd.append("files", f));
    start(async () => {
      const r = await uploadFiles(fd);
      toast(r.message);
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    });
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!dragging) setDragging(true);
  };
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    addFiles(e.dataTransfer?.files);
  };

  const addLink = () => {
    const title = linkTitle.trim();
    if (!title) {
      toast("Give it a title first.");
      return;
    }
    start(async () => {
      const r = await addLinkOrNote({ title, url: linkUrl.trim(), note: linkNote.trim(), skill: uploadSkill });
      toast(r.message);
      if (r.ok) {
        setLinkTitle("");
        setLinkUrl("");
        setLinkNote("");
      }
      router.refresh();
    });
  };

  const toggle = (id: number) =>
    start(async () => {
      const r = await toggleStudied(id);
      toast(r.message);
      router.refresh();
    });
  const remove = (id: number) =>
    start(async () => {
      const r = await removeMaterial(id);
      toast(r.message);
      router.refresh();
    });

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return materials.filter(
      (m) =>
        (filter === "All" || m.skill === filter) &&
        (!q || `${m.title} ${m.note || ""}`.toLowerCase().includes(q)),
    );
  }, [materials, filter, query]);

  const emptyText = materials.length
    ? "No materials match this filter."
    : "Your library is empty. Upload test books, audio and notes to build your own course.";

  return (
    <>
      <div className="flex flex-wrap items-start gap-4">
        <section className="card min-w-0 p-5" style={{ flex: "1 1 360px" }}>
          <h2 className="m-0 mb-1 font-heading text-xl font-semibold">Upload files</h2>
          <p className="m-0 mb-3.5 text-sm text-muted">PDF test books, audio tracks, Word docs, images or video.</p>
          <label className="label mb-1.5 block" htmlFor="lib-upload-skill">
            File it under
          </label>
          <select
            id="lib-upload-skill"
            className="inp"
            aria-label="Skill for uploads"
            value={uploadSkill}
            onChange={(e) => setUploadSkill(e.target.value)}
          >
            {SKILLS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <div
            onDragOver={onDragOver}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className="mt-3.5 rounded-xl px-4 py-7 text-center"
            style={{
              border: `2px dashed ${dragging ? "#5B3FD9" : "#D3CCEE"}`,
              background: dragging ? "#EEEAFE" : "#FAF9FF",
            }}
          >
            <UploadIcon size={32} stroke="#5B3FD9" className="mx-auto" />
            <div className="mt-2 font-semibold">Drag files here</div>
            <div className="mt-1 mb-3 text-[13px] text-muted">or</div>
            <label className={`btn btn-p cursor-pointer ${pending ? "opacity-55 pointer-events-none" : ""}`}>
              {pending ? "Uploading…" : "Choose files"}
              <input
                ref={fileRef}
                className="sr"
                type="file"
                multiple
                disabled={pending}
                onChange={(e) => addFiles(e.target.files)}
              />
            </label>
          </div>
        </section>

        <section className="card min-w-0 p-5" style={{ flex: "1 1 360px" }}>
          <h2 className="m-0 mb-1 font-heading text-xl font-semibold">Add a link or note</h2>
          <p className="m-0 mb-3.5 text-sm text-muted">Save a YouTube lesson, a website article or your own notes.</p>
          <div className="flex flex-col gap-2.5">
            <label className="label">
              Title
              <input
                className="inp mt-1.5 font-normal"
                value={linkTitle}
                onChange={(e) => setLinkTitle(e.target.value)}
                placeholder="e.g. Task 2 opinion essay structure"
              />
            </label>
            <label className="label">
              Link (optional)
              <input
                className="inp mt-1.5 font-normal"
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://"
              />
            </label>
            <label className="label">
              Notes (optional)
              <textarea
                className="inp mt-1.5 font-normal"
                rows={3}
                value={linkNote}
                onChange={(e) => setLinkNote(e.target.value)}
              />
            </label>
            <button type="button" className="btn btn-p self-start" onClick={addLink} disabled={pending}>
              Save to library
            </button>
          </div>
        </section>
      </div>

      <section className="card">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 pb-3">
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => {
              const on = filter === f;
              return (
                <button
                  key={f}
                  type="button"
                  className="btn"
                  aria-pressed={on}
                  onClick={() => setFilter(f)}
                  style={{
                    minHeight: 36,
                    padding: "6px 12px",
                    borderRadius: 18,
                    ...onTab(on),
                  }}
                >
                  {f}
                </button>
              );
            })}
          </div>
          <input
            className="inp"
            type="search"
            aria-label="Search library"
            placeholder="Search materials"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ maxWidth: 260 }}
          />
        </div>

        {items.length === 0 && (
          <div className="border-t border-line px-4 py-10 text-center text-muted">{emptyText}</div>
        )}

        {items.map((m) => {
          const size = fmtSize(m.size);
          const meta =
            m.skill +
            (size ? ` · ${size}` : "") +
            ` · Added ${ymd(new Date(m.createdAt))}` +
            (m.studied ? " · Studied" : "");
          return (
            <div key={m.id} className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-3.5">
              <span
                className="rounded-md px-2 py-1 text-center text-xs font-semibold"
                style={{ minWidth: 52, background: "#EEEAFE", color: "#3B2799" }}
              >
                {m.kind}
              </span>
              <div className="min-w-0" style={{ flex: "1 1 240px" }}>
                <div
                  className="font-semibold [overflow-wrap:anywhere]"
                  style={{ textDecoration: m.studied ? "line-through" : "none" }}
                >
                  {m.title}
                </div>
                <div className="text-[13px] text-muted">{meta}</div>
                {m.note && <div className="mt-1 text-sm whitespace-pre-line">{m.note}</div>}
              </div>
              {m.url && (
                <a className="btn" href={m.url} target="_blank" rel="noopener">
                  Open
                </a>
              )}
              <button type="button" className="btn" onClick={() => toggle(m.id)} disabled={pending}>
                {m.studied ? "Mark unstudied" : "Mark studied"}
              </button>
              <button
                type="button"
                className="btn"
                aria-label="Remove material"
                onClick={() => remove(m.id)}
                disabled={pending}
              >
                Remove
              </button>
            </div>
          );
        })}
      </section>
    </>
  );
}
