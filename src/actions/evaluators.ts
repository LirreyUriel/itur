"use server";

import { prisma } from "@/lib/prisma";
import { revalidateApp, type ActionResult } from "@/lib/action-utils";

function readRoles(roles: unknown) {
  if (!Array.isArray(roles)) return [];
  return roles.filter((role): role is string => typeof role === "string" && role.trim().length > 0);
}

export async function createEvaluator(input: {
  name: string;
  roles: string[];
  year: string;
  tz: string;
  ma: string;
  email: string;
  relevantTo2026: boolean;
}): Promise<ActionResult> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "יש להזין שם מעריך." };

  const last = await prisma.evaluator.findFirst({
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const created = await prisma.evaluator.create({
    data: {
      name,
      roles: readRoles(input.roles),
      year: input.year.trim(),
      tz: input.tz.trim(),
      ma: input.ma.trim(),
      email: input.email.trim(),
      relevantTo2026: input.relevantTo2026,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });

  revalidateApp();
  return { ok: true, id: created.id };
}

export async function updateEvaluator(input: {
  id: string;
  name: string;
  roles: string[];
  year: string;
  tz: string;
  ma: string;
  email: string;
  relevantTo2026: boolean;
}): Promise<ActionResult> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "יש להזין שם מעריך." };

  await prisma.evaluator.update({
    where: { id: input.id },
    data: {
      name,
      roles: readRoles(input.roles),
      year: input.year.trim(),
      tz: input.tz.trim(),
      ma: input.ma.trim(),
      email: input.email.trim(),
      relevantTo2026: input.relevantTo2026,
    },
  });

  revalidateApp();
  return { ok: true, id: input.id };
}

export async function toggleEvaluatorRelevant(id: string, relevantTo2026: boolean): Promise<ActionResult> {
  await prisma.evaluator.update({
    where: { id },
    data: { relevantTo2026 },
  });
  revalidateApp();
  return { ok: true, id };
}

export async function deleteEvaluator(id: string): Promise<ActionResult> {
  await prisma.evaluator.delete({ where: { id } });
  revalidateApp();
  return { ok: true, id };
}
