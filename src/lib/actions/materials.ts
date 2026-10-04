"use server";

import { prisma } from "@/lib/db";
import { kindOf } from "@/lib/ielts";
import { SKILLS } from "@/lib/topics";
import { revalidatePath } from "next/cache";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Material } from "@prisma/client";
import { UPLOAD_ROOT } from "@/lib/uploads";

export async function listMaterials(): Promise<Material[]> {
  return prisma.material.findMany({ orderBy: { id: "desc" } });
}

function safeSkill(s: string) {
  return SKILLS.includes(s as never) ? s : "General";
}

function safeName(name: string) {
  const base = path.basename(name).replace(/[^\w.\-() ]+/g, "_").slice(0, 120);
  return base || "file";
}

/** Upload one or more files from a FormData ("files" entries) under a skill. */
export async function uploadFiles(formData: FormData) {
  const skill = safeSkill(String(formData.get("skill") || "General"));
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return { ok: false, message: "No files selected." };

  const stamp = new Date();
  const sub = `${stamp.getFullYear()}-${String(stamp.getMonth() + 1).padStart(2, "0")}`;
  const dir = path.join(UPLOAD_ROOT, sub);
  await mkdir(dir, { recursive: true });

  for (const f of files) {
    const fname = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName(f.name)}`;
    const rel = path.posix.join(sub, fname);
    await writeFile(path.join(dir, fname), Buffer.from(await f.arrayBuffer()));
    await prisma.material.create({
      data: {
        title: f.name,
        skill,
        kind: kindOf(f.name, f.type),
        size: f.size,
        mimeType: f.type || null,
        url: `/uploads/${rel}`,
        filePath: rel,
      },
    });
  }
  revalidatePath("/", "layout");
  return {
    ok: true,
    message: `${files.length} ${files.length === 1 ? "file" : "files"} added to ${skill}.`,
  };
}

export async function addLinkOrNote(input: { title: string; url?: string; note?: string; skill: string }) {
  const title = (input.title || "").trim();
  if (!title) return { ok: false, message: "Give it a title first." };
  let url = (input.url || "").trim();
  if (url && !/^https?:\/\//i.test(url)) url = "https://" + url;
  const skill = safeSkill(input.skill);
  await prisma.material.create({
    data: { title, skill, kind: url ? "Link" : "Note", url: url || null, note: (input.note || "").trim() },
  });
  revalidatePath("/", "layout");
  return { ok: true, message: `Saved to ${skill}.` };
}

export async function toggleStudied(id: number) {
  const m = await prisma.material.findUnique({ where: { id } });
  if (!m) return { ok: false, message: "Not found." };
  await prisma.material.update({ where: { id }, data: { studied: !m.studied } });
  revalidatePath("/", "layout");
  return { ok: true, message: m.studied ? "Marked unstudied." : "Marked studied." };
}

export async function removeMaterial(id: number) {
  const m = await prisma.material.findUnique({ where: { id } });
  if (!m) return { ok: false, message: "Not found." };
  if (m.filePath) {
    await unlink(path.join(UPLOAD_ROOT, m.filePath)).catch(() => null);
  }
  await prisma.material.delete({ where: { id } });
  revalidatePath("/", "layout");
  return { ok: true, message: "Removed from library." };
}
