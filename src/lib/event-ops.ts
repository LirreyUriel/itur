import { prisma } from "@/lib/prisma";
import {
  allowedEvaluatorRoles,
  EVENT_STATUS_MIGRATIONS,
  INTERVIEW_ASSIGNMENT_ASSIGNEE,
  INTERVIEW_ASSIGNMENT_TASK_PREFIX,
} from "@/lib/constants";
import { parseDateOnly, todayKey } from "@/lib/dates";
import { interviewAssignmentTaskTitle, needsInterviewAssignment } from "@/lib/event-rules";

export async function syncOperationalData() {
  await migrateEventStatuses();
  await stripRemovedEvaluatorRoles();
  await syncInterviewAssignmentTasks();
}

async function migrateEventStatuses() {
  for (const { from, to } of EVENT_STATUS_MIGRATIONS) {
    await prisma.event.updateMany({
      where: { status: from },
      data: { status: to },
    });
  }
}

async function stripRemovedEvaluatorRoles() {
  const evaluators = await prisma.evaluator.findMany({
    select: { id: true, roles: true },
  });

  for (const evaluator of evaluators) {
    const next = allowedEvaluatorRoles(evaluator.roles);
    const current = Array.isArray(evaluator.roles)
      ? evaluator.roles.filter((role): role is string => typeof role === "string")
      : [];
    if (next.length === current.length && next.every((role, index) => role === current[index])) {
      continue;
    }
    await prisma.evaluator.update({
      where: { id: evaluator.id },
      data: { roles: next },
    });
  }
}

async function syncInterviewAssignmentTasks() {
  const events = await prisma.event.findMany({
    where: { notes: "ריאיון" },
    include: { evaluators: { select: { id: true } } },
  });

  const relevantIds = events.map((event) => event.id);
  const existingTasks = relevantIds.length
    ? await prisma.task.findMany({
        where: {
          eventId: { in: relevantIds },
          title: { startsWith: INTERVIEW_ASSIGNMENT_TASK_PREFIX },
        },
      })
    : [];
  const taskByEventId = new Map(
    existingTasks
      .filter((task): task is typeof task & { eventId: string } => Boolean(task.eventId))
      .map((task) => [task.eventId, task]),
  );

  const today = parseDateOnly(todayKey());

  for (const event of events) {
    const needs = needsInterviewAssignment({
      notes: event.notes,
      date: event.date,
      evaluatorCount: event.evaluators.length,
    });
    const task = taskByEventId.get(event.id);

    if (needs && !task) {
      const already = await prisma.task.findFirst({
        where: {
          eventId: event.id,
          title: { startsWith: INTERVIEW_ASSIGNMENT_TASK_PREFIX },
        },
      });
      if (already) continue;
      await prisma.task.create({
        data: {
          title: interviewAssignmentTaskTitle(event.date),
          status: "לביצוע",
          assignee: INTERVIEW_ASSIGNMENT_ASSIGNEE,
          dueDate: today,
          eventId: event.id,
        },
      });
      continue;
    }

    if (needs && task && task.status === "בוצע") {
      await prisma.task.update({
        where: { id: task.id },
        data: {
          status: "לביצוע",
          dueDate: today,
          assignee: INTERVIEW_ASSIGNMENT_ASSIGNEE,
          title: interviewAssignmentTaskTitle(event.date),
        },
      });
      continue;
    }

    if (!needs && task && event.evaluators.length > 0 && task.status !== "בוצע") {
      await prisma.task.update({
        where: { id: task.id },
        data: { status: "בוצע" },
      });
    }
  }
}
