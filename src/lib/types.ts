import { allowedEvaluatorRoles, normalizeEventStatus } from "@/lib/constants";
import type { Document, Evaluator, Event, Task } from "@prisma/client";

export type EvaluatorRecord = {
  id: string;
  name: string;
  roles: string[];
  year: string;
  tz: string;
  ma: string;
  email: string;
  relevantTo2026: boolean;
};

export type EventRecord = {
  id: string;
  date: string;
  notes: string;
  status: string;
  internal: boolean;
  evaluators: EvaluatorRecord[];
};

export type TaskLink = {
  label: string;
  url: string;
};

export type TaskRecord = {
  id: string;
  title: string;
  status: string;
  assignee: string;
  notes: string;
  links: TaskLink[];
  dueDate: string | null;
  eventId: string | null;
};

export type DocumentRecord = {
  id: string;
  title: string;
  content: string;
  sortOrder: number;
  updatedAt: string;
};

export function toEvaluatorRecord(evaluator: Evaluator): EvaluatorRecord {
  return {
    id: evaluator.id,
    name: evaluator.name,
    roles: allowedEvaluatorRoles(evaluator.roles),
    year: evaluator.year,
    tz: evaluator.tz,
    ma: evaluator.ma,
    email: evaluator.email,
    relevantTo2026: evaluator.relevantTo2026,
  };
}

export function toEventRecord(
  event: Event & { evaluators: Evaluator[] },
): EventRecord {
  return {
    id: event.id,
    date: event.date.toISOString(),
    notes: event.notes,
    status: normalizeEventStatus(event.status) ?? event.status,
    internal: event.internal,
    evaluators: event.evaluators.map(toEvaluatorRecord),
  };
}

export function toTaskLinks(value: unknown): TaskLink[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as { label?: unknown; url?: unknown };
      const url = typeof record.url === "string" ? record.url.trim() : "";
      if (!url) return null;
      const label = typeof record.label === "string" ? record.label.trim() : "";
      return { label, url };
    })
    .filter((item): item is TaskLink => item !== null);
}

export function toTaskRecord(task: Task): TaskRecord {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    assignee: task.assignee,
    notes: task.notes,
    links: toTaskLinks(task.links),
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    eventId: task.eventId,
  };
}

export function toDocumentRecord(document: Document): DocumentRecord {
  return {
    id: document.id,
    title: document.title,
    content: document.content,
    sortOrder: document.sortOrder,
    updatedAt: document.updatedAt.toISOString(),
  };
}
