import { writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();
  const payload = {
    evaluators: await prisma.evaluator.findMany(),
    events: await prisma.event.findMany({
      include: { evaluators: { select: { id: true } } },
    }),
    tasks: await prisma.task.findMany(),
    documents: await prisma.document.findMany(),
  };

  writeFileSync("data/export.json", JSON.stringify(payload));
  console.log({
    evaluators: payload.evaluators.length,
    events: payload.events.length,
    tasks: payload.tasks.length,
    documents: payload.documents.length,
  });
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
