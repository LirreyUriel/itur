"use server";

import { prisma } from "@/lib/prisma";
import { maybeBackup } from "@/lib/backup";
import { revalidateApp, type ActionResult } from "@/lib/action-utils";

async function nextSortOrder(folderId: string | null) {
  const first = await prisma.document.findFirst({
    where: { folderId },
    orderBy: { sortOrder: "asc" },
    select: { sortOrder: true },
  });
  return (first?.sortOrder ?? 0) - 1;
}

export async function createDocument(input: {
  title: string;
  content?: string;
  folderId?: string | null;
}): Promise<ActionResult> {
  const title = input.title.trim() || "מסמך חדש";
  const folderId = input.folderId || null;
  if (folderId) {
    const folder = await prisma.folder.findUnique({ where: { id: folderId }, select: { id: true } });
    if (!folder) return { ok: false, error: "התיקייה לא נמצאה." };
  }

  const created = await prisma.document.create({
    data: {
      title,
      content: input.content ?? "",
      folderId,
      sortOrder: await nextSortOrder(folderId),
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

export async function moveDocument(input: {
  id: string;
  folderId: string | null;
}): Promise<ActionResult> {
  const existing = await prisma.document.findUnique({ where: { id: input.id } });
  if (!existing) return { ok: false, error: "המסמך לא נמצא." };

  const folderId = input.folderId || null;
  if (folderId) {
    const folder = await prisma.folder.findUnique({ where: { id: folderId }, select: { id: true } });
    if (!folder) return { ok: false, error: "התיקייה לא נמצאה." };
  }

  if (existing.folderId === folderId) return { ok: true, id: input.id };

  await prisma.document.update({
    where: { id: input.id },
    data: {
      folderId,
      sortOrder: await nextSortOrder(folderId),
    },
  });
  revalidateApp();
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

export async function createFolder(input: { name?: string }): Promise<ActionResult> {
  const name = input.name?.trim() || "תיקייה חדשה";
  const first = await prisma.folder.findFirst({
    orderBy: { sortOrder: "asc" },
    select: { sortOrder: true },
  });
  const created = await prisma.folder.create({
    data: {
      name,
      sortOrder: (first?.sortOrder ?? 0) - 1,
    },
  });
  revalidateApp();
  return { ok: true, id: created.id };
}

export async function renameFolder(input: { id: string; name: string }): Promise<ActionResult> {
  const existing = await prisma.folder.findUnique({ where: { id: input.id } });
  if (!existing) return { ok: false, error: "התיקייה לא נמצאה." };
  const name = input.name.trim() || existing.name;
  await prisma.folder.update({
    where: { id: input.id },
    data: { name },
  });
  revalidateApp();
  return { ok: true, id: input.id };
}

export async function deleteFolder(id: string): Promise<ActionResult> {
  const existing = await prisma.folder.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "התיקייה לא נמצאה." };
  await prisma.folder.delete({ where: { id } });
  revalidateApp();
  return { ok: true, id };
}
