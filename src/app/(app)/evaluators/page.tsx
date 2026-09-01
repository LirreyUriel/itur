import { prisma } from "@/lib/prisma";
import { EvaluatorsView } from "@/components/evaluators/evaluators-view";
import { utcDateKey } from "@/lib/dates";
import { toEvaluatorRecord } from "@/lib/types";

export default async function EvaluatorsPage() {
  const [evaluators, events] = await Promise.all([
    prisma.evaluator.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.event.findMany({
      select: {
        date: true,
        evaluators: { select: { id: true } },
      },
    }),
  ]);

  const daysByEvaluator = new Map<string, Set<string>>();
  for (const event of events) {
    const day = utcDateKey(event.date);
    for (const evaluator of event.evaluators) {
      const days = daysByEvaluator.get(evaluator.id) ?? new Set<string>();
      days.add(day);
      daysByEvaluator.set(evaluator.id, days);
    }
  }

  return (
    <EvaluatorsView
      evaluators={evaluators.map((evaluator) => ({
        ...toEvaluatorRecord(evaluator),
        totalDays: daysByEvaluator.get(evaluator.id)?.size ?? 0,
      }))}
    />
  );
}
