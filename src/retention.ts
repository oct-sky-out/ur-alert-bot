import { readdir, rm } from "node:fs/promises";
import path from "node:path";

const SNAPSHOTS_DIR = path.resolve("state/snapshots");
const DAILY_DIR = path.resolve("state/daily");

export async function pruneStateFiles(now: Date, retentionDays = 7): Promise<string[]> {
  const deleted: string[] = [];

  deleted.push(...(await pruneDirectory(SNAPSHOTS_DIR, now, retentionDays)));
  deleted.push(...(await pruneDirectory(DAILY_DIR, now, retentionDays)));

  return deleted;
}

async function pruneDirectory(
  directory: string,
  now: Date,
  retentionDays: number,
): Promise<string[]> {
  const filenames = await safeReadDir(directory);
  const deleted: string[] = [];
  const retentionMs = retentionDays * 24 * 60 * 60 * 1000;

  for (const filename of filenames) {
    if (!filename.endsWith(".json")) {
      continue;
    }

    const fullPath = path.join(directory, filename);
    const date = extractDate(filename);

    if (!date) {
      continue;
    }

    if (now.getTime() - date.getTime() > retentionMs) {
      await rm(fullPath, { force: true });
      deleted.push(fullPath);
    }
  }

  return deleted;
}

async function safeReadDir(directory: string): Promise<string[]> {
  try {
    return await readdir(directory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

function extractDate(filename: string): Date | null {
  const match = filename.match(/^(\d{4}-\d{2}-\d{2})/);

  if (!match) {
    return null;
  }

  const date = new Date(`${match[1]}T00:00:00+09:00`);

  return Number.isNaN(date.getTime()) ? null : date;
}
