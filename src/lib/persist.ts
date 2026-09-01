import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import {
  bundledDatabaseFile,
  dataDir,
  databaseFile,
  isVercel,
  projectBackupsDir,
  uploadsDir,
} from "./paths";

function copySidecars(fromDb: string, toDb: string) {
  for (const suffix of ["-wal", "-shm", "-journal"]) {
    if (existsSync(fromDb + suffix)) {
      copyFileSync(fromDb + suffix, toDb + suffix);
    }
  }
}

function copyDirIfPresent(from: string, to: string) {
  if (!existsSync(from) || path.resolve(from) === path.resolve(to)) return;
  mkdirSync(to, { recursive: true });
  for (const name of readdirSync(from)) {
    if (name === ".gitkeep") continue;
    copyFileSync(path.join(from, name), path.join(to, name));
  }
}

function seedFromBundle() {
  const live = databaseFile();
  const bundled = bundledDatabaseFile();
  mkdirSync(dataDir(), { recursive: true });
  mkdirSync(uploadsDir(), { recursive: true });
  if (!existsSync(live) && existsSync(bundled)) {
    copyFileSync(bundled, live);
  }
  copyDirIfPresent(path.join(process.cwd(), "data", "uploads"), uploadsDir());
}

/** Move leftover Prisma default DB into the durable data folder if it is newer. */
export function ensurePersistentStorage() {
  if (isVercel()) {
    seedFromBundle();
    return;
  }

  mkdirSync(dataDir(), { recursive: true });
  mkdirSync(uploadsDir(), { recursive: true });
  mkdirSync(projectBackupsDir(), { recursive: true });
  seedFromBundle();

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
