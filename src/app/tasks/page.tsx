import { prisma } from "@/lib/prisma";
import { TasksView } from "@/components/tasks/tasks-view";
import { toEventRecord, toTaskRecord } from "@/lib/types";

export default async function TasksPage() {
  const [tasks, events] = await Promise.all([
    prisma.task.findMany({
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    }),
    prisma.event.findMany({
      include: { evaluators: true },
      orderBy: { date: "asc" },
    }),
  ]);

  return (
    <TasksView
      tasks={tasks.map(toTaskRecord)}
      events={events.map(toEventRecord)}
    />
  );
}
