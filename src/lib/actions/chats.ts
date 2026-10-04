"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function listChats() {
  return prisma.chat.findMany({
    orderBy: { updatedAt: "desc" },
    include: { messages: { orderBy: { id: "asc" } } },
  });
}

export async function getChat(id: number) {
  return prisma.chat.findUnique({
    where: { id },
    include: { messages: { orderBy: { id: "asc" } } },
  });
}

export async function deleteChat(id: number) {
  await prisma.chat.delete({ where: { id } }).catch(() => null);
  revalidatePath("/tutor");
  return { ok: true, message: "Conversation deleted." };
}
