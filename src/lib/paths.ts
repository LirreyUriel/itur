import { homedir } from "node:os";
import path from "node:path";

export function dataDir() {
  return path.join(process.cwd(), "data");
}

export function databaseFile() {
  return path.join(dataDir(), "itur.db");
}

export function uploadsDir() {
  return path.join(dataDir(), "uploads");
}

export function projectBackupsDir() {
  return path.join(dataDir(), "backups");
}

export function externalBackupsDir() {
  return path.join(homedir(), "Documents", "Itur-backups");
}
