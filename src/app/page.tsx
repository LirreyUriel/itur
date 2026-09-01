import { prisma } from "@/lib/prisma";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { toDocumentRecord, toEvaluatorRecord, toEventRecord, toTaskRecord } from "@/lib/types";

export default async function HomePage() {
  const [evaluators, events, tasks, documents] = await Promise.all([
    prisma.evaluator.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.event.findMany({
      include: { evaluators: { orderBy: { name: "asc" } } },
      orderBy: { date: "asc" },
    }),
    prisma.task.findMany({
      orderBy: [{ status: "asc" }, { dueDate: "asc" }],
    }),
    prisma.document.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
  ]);

  return (
    <DashboardView
      evaluators={evaluators.map(toEvaluatorRecord)}
      events={events.map(toEventRecord)}
      tasks={tasks.map(toTaskRecord)}
      documents={documents.map(toDocumentRecord)}
    />
  );
}
