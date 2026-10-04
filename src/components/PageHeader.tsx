"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useTransition } from "react";
import { SKILL_OF_PATH, TITLES } from "@/lib/nav";
import { pageColor } from "@/lib/page-colors";
import { uploadFiles } from "@/lib/actions/materials";
import { useToast } from "./Toast";
import { PlusIcon, UploadIcon } from "./Icons";
import { FlashLine } from "./Toast";

export function PageHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const [eyebrow, heading] = TITLES[pathname] ?? ["", "Band Up"];
  const skill = SKILL_OF_PATH[pathname] ?? "General";

  const onFiles = (files: FileList | null) => {
    if (!files || !files.length) return;
    const fd = new FormData();
    fd.set("skill", skill);
    Array.from(files).forEach((f) => fd.append("files", f));
    start(async () => {
      const r = await uploadFiles(fd);
      toast(r.message);
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    });
  };

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          {eyebrow && (
            <div className="eyebrow-pill" style={{ background: pageColor(pathname) }}>
              {eyebrow}
            </div>
          )}
          <h1 className="mt-1 font-heading text-[34px] leading-[1.15] font-bold">{heading}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/add" className="btn">
            <PlusIcon /> Add phrase
          </Link>
          <label className="btn btn-p cursor-pointer">
            <UploadIcon /> {pending ? "Uploading…" : "Upload material"}
            <input ref={fileRef} className="sr" type="file" multiple onChange={(e) => onFiles(e.target.files)} />
          </label>
        </div>
      </header>
      <FlashLine />
    </>
  );
}
