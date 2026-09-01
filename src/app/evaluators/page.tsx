import { prisma } from "@/lib/prisma";
import { EvaluatorsView } from "@/components/evaluators/evaluators-view";
import { toEvaluatorRecord } from "@/lib/types";

export default async function EvaluatorsPage() {
  const evaluators = await prisma.evaluator.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return <EvaluatorsView evaluators={evaluators.map(toEvaluatorRecord)} />;
}
