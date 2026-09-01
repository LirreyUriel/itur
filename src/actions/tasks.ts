"use server";

import { prisma } from "@/lib/prisma";
import { isTaskStatus } from "@/lib/constants";
import { parseDateOnly } from "@/lib/dates";
import { revalidateApp, type ActionResult } from "@/lib/action-utils";
import { toTaskLinks, type TaskLink } from "@/lib/types";

export async function createTask(input: {
  title: string;
  status: string;
  assignee: string;
  notes: string;
  links: TaskLink[];
  dueDate: string | null;
  eventId: string | null;
}): Promise<ActionResult> {
  const title = input.title.trim();
  if (!title) return { ok: false, error: "יש להזין כותרת משימה." };
  if (!isTaskStatus(input.status)) return { ok: false, error: "סטטוס לא תקין." };

  const created = await prisma.task.create({
    data: {
      title,
      status: input.status,
      assignee: input.assignee.trim(),
      notes: input.notes.trim(),
      links: toTaskLinks(input.links),
      dueDate: input.dueDate ? parseDateOnly(input.dueDate) : null,
      eventId: input.eventId || null,
    },
  });

  revalidateApp();
  return { ok: true, id: created.id };
}

export async function updateTask(input: {
  id: string;
  title: string;
  status: string;
  assignee: string;
  notes: string;
  links: TaskLink[];
  dueDate: string | null;
  eventId: string | null;
}): Promise<ActionResult> {
  const title = input.title.trim();
  if (!title) return { ok: false, error: "יש להזין כותרת משימה." };
  if (!isTaskStatus(input.status)) return { ok: false, error: "סטטוס לא תקין." };

  await prisma.task.update({
    where: { id: input.id },
    data: {
      title,
      status: input.status,
      assignee: input.assignee.trim(),
      notes: input.notes.trim(),
      links: toTaskLinks(input.links),
      dueDate: input.dueDate ? parseDateOnly(input.dueDate) : null,
      eventId: input.eventId || null,
    },
  });

  revalidateApp();
  return { ok: true, id: input.id };
}

export async function updateTaskStatus(id: string, status: string): Promise<ActionResult> {
  if (!isTaskStatus(status)) return { ok: false, error: "סטטוס לא תקין." };
  await prisma.task.update({ where: { id }, data: { status } });
  revalidateApp();
  return { ok: true, id };
}

export async function deleteTask(id: string): Promise<ActionResult> {
  await prisma.task.delete({ where: { id } });
  revalidateApp();
  return { ok: true, id };
}
