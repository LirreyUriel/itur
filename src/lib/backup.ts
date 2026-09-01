import { copyFile, mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { externalBackupsDir, projectBackupsDir, uploadsDir } from "@/lib/paths";
import type { PrismaClient } from "@prisma/client";

const KEEP = 50;
const MIN_INTERVAL_MS = 10 * 60 * 1000;
let lastBackupAt = 0;
let inFlight: Promise<void> | null = null;

function stamp() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

async function prune(dir: string, prefix: string) {
  const entries = (await readdir(dir).catch(() => [])).filter((name) => name.startsWith(prefix));
  const dated = await Promise.all(
    entries.map(async (name) => ({
      name,
      mtime: (await stat(path.join(dir, name)).catch(() => null))?.mtimeMs ?? 0,
    })),
  );
  dated.sort((a, b) => b.mtime - a.mtime);
  for (const extra of dated.slice(KEEP)) {
    await rm(path.join(dir, extra.name), { recursive: true, force: true }).catch(() => undefined);
  }
}

async function copyUploads(destination: string) {
  const source = uploadsDir();
  const files = await readdir(source).catch(() => []);
  if (files.length === 0) return;
  await mkdir(destination, { recursive: true });
  for (const file of files) {
    if (file === ".gitkeep") continue;
    await copyFile(path.join(source, file), path.join(destination, file)).catch(() => undefined);
  }
}

async function runBackup(prisma: PrismaClient) {
  const projectDir = projectBackupsDir();
  const externalDir = externalBackupsDir();
  await mkdir(projectDir, { recursive: true });
  await mkdir(externalDir, { recursive: true });

  const label = stamp();
  const projectFile = path.join(projectDir, `itur-${label}.db`).split("\\").join("/");
  const escaped = projectFile.split("'").join("''");
  await prisma.$executeRawUnsafe(`VACUUM INTO '${escaped}'`);

  const latest = path.join(externalDir, "itur-latest.db");
  await copyFile(path.join(projectDir, `itur-${label}.db`), latest).catch(() => undefined);
  await copyFile(
    path.join(projectDir, `itur-${label}.db`),
    path.join(externalDir, `itur-${label}.db`),
  ).catch(() => undefined);

  await copyUploads(path.join(projectDir, `uploads-${label}`));
  await copyUploads(path.join(externalDir, "uploads-latest"));

  await prune(projectDir, "itur-");
  await prune(projectDir, "uploads-");
}

export async function backupNow(prisma: PrismaClient) {
  if (inFlight) await inFlight;
  lastBackupAt = Date.now();
  await runBackup(prisma);
}

export function maybeBackup(prisma: PrismaClient) {
  const now = Date.now();
  if (now - lastBackupAt < MIN_INTERVAL_MS && lastBackupAt !== 0) return;
  if (inFlight) return;
  lastBackupAt = now;
  inFlight = runBackup(prisma)
    .catch((error) => {
      console.error("Database backup failed", error);
    })
    .finally(() => {
      inFlight = null;
    });
}
