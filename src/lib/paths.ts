import { homedir } from "node:os";
import path from "node:path";

export function isVercel() {
  return Boolean(process.env.VERCEL);
}

export function isBuildTime() {
  return process.env.NEXT_PHASE === "phase-production-build" || process.env.CI === "1";
}

export function dataDir() {
  if (isVercel()) return path.join("/tmp", "itur-data");
  return path.join(process.cwd(), "data");
}

export function bundledDatabaseFile() {
  return path.join(process.cwd(), "data", "itur.db");
}

export function databaseFile() {
  return path.join(dataDir(), "itur.db");
}

export function databaseUrl() {
  return `file:${databaseFile().split("\\").join("/")}`;
}

export function uploadsDir() {
  if (isVercel()) return path.join("/tmp", "itur-data", "uploads");
  return path.join(dataDir(), "uploads");
}

export function projectBackupsDir() {
  if (isVercel()) return path.join("/tmp", "itur-data", "backups");
  return path.join(dataDir(), "backups");
}

export function externalBackupsDir() {
  return path.join(homedir(), "Documents", "Itur-backups");
}
