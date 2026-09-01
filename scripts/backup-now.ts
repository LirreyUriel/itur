import { prisma } from "../src/lib/prisma";
import { backupNow } from "../src/lib/backup";

backupNow(prisma)
  .then(async () => {
    await prisma.$disconnect();
    console.log("Backup completed.");
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
