"use server";

import { prisma } from "@/lib/prisma";
import { normalizeEventStatus } from "@/lib/constants";
import { parseDateOnly } from "@/lib/dates";
import { revalidateApp, type ActionResult } from "@/lib/action-utils";

export async function createEvent(input: {
  date: string;
  notes: string;
  status: string;
  evaluatorIds: string[];
  internal: boolean;
}): Promise<ActionResult> {
  if (!input.date) return { ok: false, error: "יש לבחור תאריך." };
  const status = normalizeEventStatus(input.status);
  if (!status) return { ok: false, error: "סטטוס לא תקין." };

  const created = await prisma.event.create({
    data: {
      date: parseDateOnly(input.date),
      notes: input.notes.trim(),
      status,
      internal: input.internal,
      evaluators: {
        connect: input.evaluatorIds.map((id) => ({ id })),
      },
    },
  });

  revalidateApp();
  return { ok: true, id: created.id };
}

export async function updateEvent(input: {
  id: string;
  date: string;
  notes: string;
  status: string;
  evaluatorIds: string[];
  internal: boolean;
}): Promise<ActionResult> {
  if (!input.date) return { ok: false, error: "יש לבחור תאריך." };
  const status = normalizeEventStatus(input.status);
  if (!status) return { ok: false, error: "סטטוס לא תקין." };

  await prisma.event.update({
    where: { id: input.id },
    data: {
      date: parseDateOnly(input.date),
      notes: input.notes.trim(),
      status,
      internal: input.internal,
      evaluators: {
        set: input.evaluatorIds.map((id) => ({ id })),
      },
    },
  });

  revalidateApp();
  return { ok: true, id: input.id };
}

export async function updateEventStatus(id: string, status: string): Promise<ActionResult> {
  const next = normalizeEventStatus(status);
  if (!next) return { ok: false, error: "סטטוס לא תקין." };
  await prisma.event.update({ where: { id }, data: { status: next } });
  revalidateApp();
  return { ok: true, id };
}

export async function updateEventInternal(id: string, internal: boolean): Promise<ActionResult> {
  await prisma.event.update({ where: { id }, data: { internal } });
  revalidateApp();
  return { ok: true, id };
}

export async function deleteEvent(id: string): Promise<ActionResult> {
  await prisma.event.delete({ where: { id } });
  revalidateApp();
  return { ok: true, id };
}
