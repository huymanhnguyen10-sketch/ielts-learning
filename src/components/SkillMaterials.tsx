"use client";

import { useRouter } from "next/navigation";
import { useRef, useTransition } from "react";
import type { Material } from "@prisma/client";
import { uploadFiles } from "@/lib/actions/materials";
import { useToast } from "./Toast";

/** Strip of one skill's library materials with an "Add to {skill}" upload button. */
export function SkillMaterials({ skill, materials }: { skill: string; materials: Material[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const ref = useRef<HTMLInputElement>(null);

  const onFiles = (files: FileList | null) => {
    if (!files || !files.length) return;
    const fd = new FormData();
    fd.set("skill", skill);
    Array.from(files).forEach((f) => fd.append("files", f));
    start(async () => {
      const r = await uploadFiles(fd);
      toast(r.message);
      if (ref.current) ref.current.value = "";
      router.refresh();
    });
  };

  return (
    <section className="card px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 font-heading text-lg font-semibold">Your {skill} materials</h2>
        <label className="btn cursor-pointer">
          {pending ? "Uploading…" : `Add to ${skill}`}
          <input ref={ref} className="sr" type="file" multiple onChange={(e) => onFiles(e.target.files)} />
        </label>
      </div>
      {materials.length === 0 && (
        <p className="mt-2.5 mb-0 text-sm text-muted">
          Nothing filed under {skill} yet. Upload a file here or in My library.
        </p>
      )}
      {materials.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {materials.map((m) => (
            <div
              key={m.id}
              className="flex max-w-full items-center gap-2 rounded-lg border border-line py-1.5 pl-3 pr-1.5 text-sm"
            >
              <span className="text-[11px] font-semibold text-primary-text">{m.kind}</span>
              <span className="[overflow-wrap:anywhere]">{m.title}</span>
              {m.url && (
                <a className="btn btn-sm" href={m.url} target="_blank" rel="noopener">
                  Open
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
