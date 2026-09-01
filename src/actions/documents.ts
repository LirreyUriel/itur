"use server";

import { prisma } from "@/lib/prisma";
import { maybeBackup } from "@/lib/backup";
import { revalidateApp, type ActionResult } from "@/lib/action-utils";

export async function createDocument(input: {
  title: string;
  content?: string;
}): Promise<ActionResult> {
  const title = input.title.trim() || "מסמך חדש";
  const first = await prisma.document.findFirst({
    orderBy: { sortOrder: "asc" },
    select: { sortOrder: true },
  });

  const created = await prisma.document.create({
    data: {
      title,
      content: input.content ?? "",
      sortOrder: (first?.sortOrder ?? 0) - 1,
    },
  });
  revalidateApp();
  return { ok: true, id: created.id };
}

export async function updateDocument(input: {
  id: string;
  title: string;
  content: string;
  revalidate?: boolean;
}): Promise<ActionResult> {
  const existing = await prisma.document.findUnique({ where: { id: input.id } });
  if (!existing) return { ok: false, error: "המסמך לא נמצא." };

  const title = input.title.trim() || existing.title || "מסמך חדש";

  await prisma.document.update({
    where: { id: input.id },
    data: {
      title,
      content: input.content,
    },
  });
  maybeBackup(prisma);
  if (input.revalidate !== false) {
    revalidateApp();
  }
  return { ok: true, id: input.id };
}

export async function reorderDocuments(ids: string[]): Promise<ActionResult> {
  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.document.update({
        where: { id },
        data: { sortOrder: index },
      }),
    ),
  );
  revalidateApp();
  return { ok: true };
}

export async function deleteDocument(id: string): Promise<ActionResult> {
  await prisma.document.delete({ where: { id } });
  revalidateApp();
  return { ok: true, id };
}
