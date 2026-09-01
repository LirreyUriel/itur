import { prisma } from "@/lib/prisma";
import { EventsView } from "@/components/events/events-view";
import { toEvaluatorRecord, toEventRecord } from "@/lib/types";

export default async function EventsPage() {
  const [events, evaluators] = await Promise.all([
    prisma.event.findMany({
      include: { evaluators: { orderBy: { name: "asc" } } },
      orderBy: { date: "asc" },
    }),
    prisma.evaluator.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <EventsView
      events={events.map(toEventRecord)}
      evaluators={evaluators.map(toEvaluatorRecord)}
    />
  );
}
