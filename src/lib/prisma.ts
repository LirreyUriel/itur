import { PrismaClient } from "@prisma/client";
import { maybeBackup } from "@/lib/backup";
import { ensurePersistentStorage } from "@/lib/persist";

ensurePersistentStorage();

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaReady?: Promise<void>;
  backupTimer?: ReturnType<typeof setInterval>;
};

function createClient() {
  const client = new PrismaClient();
  const ready = client
    .$queryRawUnsafe("PRAGMA journal_mode=WAL")
    .then(() => client.$queryRawUnsafe("PRAGMA synchronous=FULL"))
    .then(() => client.$queryRawUnsafe("PRAGMA foreign_keys=ON"))
    .then(() => client.$queryRawUnsafe("PRAGMA busy_timeout=8000"))
    .then(() => {
      maybeBackup(client);
    })
    .catch((error) => {
      console.error("Failed to initialize SQLite persistence", error);
    });

  globalForPrisma.prismaReady = ready;
  return client;
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

if (!globalForPrisma.backupTimer) {
  globalForPrisma.backupTimer = setInterval(() => {
    maybeBackup(prisma);
  }, 10 * 60 * 1000);
  globalForPrisma.backupTimer.unref?.();
}

export async function ensureDbReady() {
  await globalForPrisma.prismaReady;
}
