import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

type Exported = {
  evaluators: Array<{
    id: string;
    name: string;
    roles: unknown;
    year: string;
    tz: string;
    ma: string;
    email: string;
    relevantTo2026: boolean;
    sortOrder: number;
    createdAt: string;
    updatedAt: string;
  }>;
  events: Array<{
    id: string;
    date: string;
    notes: string;
    status: string;
    internal: boolean;
    createdAt: string;
    updatedAt: string;
    evaluators: Array<{ id: string }>;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    assignee: string;
    notes: string;
    links: unknown;
    dueDate: string | null;
    eventId: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  documents: Array<{
    id: string;
    title: string;
    content: string;
    sortOrder: number;
    createdAt: string;
    updatedAt: string;
  }>;
};

async function main() {
  const prisma = new PrismaClient();
  const data = JSON.parse(readFileSync("data/export.json", "utf8")) as Exported;

  for (const evaluator of data.evaluators) {
    await prisma.evaluator.upsert({
      where: { id: evaluator.id },
      update: {
        name: evaluator.name,
        roles: evaluator.roles as object,
        year: evaluator.year,
        tz: evaluator.tz,
        ma: evaluator.ma,
        email: evaluator.email,
        relevantTo2026: evaluator.relevantTo2026,
        sortOrder: evaluator.sortOrder,
      },
      create: {
        id: evaluator.id,
        name: evaluator.name,
        roles: evaluator.roles as object,
        year: evaluator.year,
        tz: evaluator.tz,
        ma: evaluator.ma,
        email: evaluator.email,
        relevantTo2026: evaluator.relevantTo2026,
        sortOrder: evaluator.sortOrder,
        createdAt: new Date(evaluator.createdAt),
        updatedAt: new Date(evaluator.updatedAt),
      },
    });
  }

  for (const event of data.events) {
    await prisma.event.upsert({
      where: { id: event.id },
      update: {
        date: new Date(event.date),
        notes: event.notes,
        status: event.status,
        internal: event.internal,
        evaluators: { set: event.evaluators.map((evaluator) => ({ id: evaluator.id })) },
      },
      create: {
        id: event.id,
        date: new Date(event.date),
        notes: event.notes,
        status: event.status,
        internal: event.internal,
        createdAt: new Date(event.createdAt),
        updatedAt: new Date(event.updatedAt),
        evaluators: { connect: event.evaluators.map((evaluator) => ({ id: evaluator.id })) },
      },
    });
  }

  for (const task of data.tasks) {
    await prisma.task.upsert({
      where: { id: task.id },
      update: {
        title: task.title,
        status: task.status,
        assignee: task.assignee,
        notes: task.notes,
        links: task.links as object,
        dueDate: task.dueDate ? new Date(task.dueDate) : null,
        eventId: task.eventId,
      },
      create: {
        id: task.id,
        title: task.title,
        status: task.status,
        assignee: task.assignee,
        notes: task.notes,
        links: task.links as object,
        dueDate: task.dueDate ? new Date(task.dueDate) : null,
        eventId: task.eventId,
        createdAt: new Date(task.createdAt),
        updatedAt: new Date(task.updatedAt),
      },
    });
  }

  for (const document of data.documents) {
    await prisma.document.upsert({
      where: { id: document.id },
      update: {
        title: document.title,
        content: document.content,
        sortOrder: document.sortOrder,
      },
      create: {
        id: document.id,
        title: document.title,
        content: document.content,
        sortOrder: document.sortOrder,
        createdAt: new Date(document.createdAt),
        updatedAt: new Date(document.updatedAt),
      },
    });
  }

  console.log({
    evaluators: await prisma.evaluator.count(),
    events: await prisma.event.count(),
    tasks: await prisma.task.count(),
    documents: await prisma.document.count(),
  });
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
