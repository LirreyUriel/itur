import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";
import { dataDir, databaseFile, projectBackupsDir, uploadsDir } from "./paths";

function copySidecars(fromDb: string, toDb: string) {
  for (const suffix of ["-wal", "-shm", "-journal"]) {
    if (existsSync(fromDb + suffix)) {
      copyFileSync(fromDb + suffix, toDb + suffix);
    }
  }
}

/** Move leftover Prisma default DB into the durable data folder if it is newer. */
export function ensurePersistentStorage() {
  mkdirSync(dataDir(), { recursive: true });
  mkdirSync(uploadsDir(), { recursive: true });
  mkdirSync(projectBackupsDir(), { recursive: true });

  const live = databaseFile();
  const legacy = path.join(process.cwd(), "prisma", "dev.db");
  if (!existsSync(legacy)) return;

  if (!existsSync(live)) {
    copyFileSync(legacy, live);
    copySidecars(legacy, live);
    return;
  }

  if (statSync(legacy).mtimeMs > statSync(live).mtimeMs + 2000) {
    copyFileSync(live, path.join(projectBackupsDir(), `itur-before-adopt-${Date.now()}.db`));
    copyFileSync(legacy, live);
    copySidecars(legacy, live);
  }
}
