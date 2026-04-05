import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { DailyState, LatestState, SnapshotState } from "./types.js";

const STATE_DIR = path.resolve("state");
const STATE_RELATIVE_DIR = "state";
const SNAPSHOTS_DIR = path.join(STATE_DIR, "snapshots");
const SNAPSHOTS_RELATIVE_DIR = path.join(STATE_RELATIVE_DIR, "snapshots");
const DAILY_DIR = path.join(STATE_DIR, "daily");
const DAILY_RELATIVE_DIR = path.join(STATE_RELATIVE_DIR, "daily");
const LATEST_PATH = path.join(STATE_DIR, "latest.json");

export async function ensureStateDirs(): Promise<void> {
  await mkdir(SNAPSHOTS_DIR, { recursive: true });
  await mkdir(DAILY_DIR, { recursive: true });
}

export function buildSnapshotFilename(runAtIso: string): string {
  return `${runAtIso.replace(/:/g, "-")}.json`;
}

export function buildDailyFilename(date: string): string {
  return `${date}.json`;
}

export function getSnapshotPath(filename: string): string {
  return path.join(SNAPSHOTS_DIR, filename);
}

export function getSnapshotRelativePath(filename: string): string {
  return path.join(SNAPSHOTS_RELATIVE_DIR, filename);
}

export function getDailyPath(filename: string): string {
  return path.join(DAILY_DIR, filename);
}

export function getDailyRelativePath(filename: string): string {
  return path.join(DAILY_RELATIVE_DIR, filename);
}

export async function loadLatestState(): Promise<LatestState> {
  const state = await readJsonOrDefault<LatestState>(LATEST_PATH, {
    lastRunAt: null,
    latestSnapshotPath: null,
  });

  return {
    ...state,
    latestSnapshotPath: normalizeStoredSnapshotPath(state.latestSnapshotPath),
  };
}

export async function loadSnapshot(snapshotPath: string | null): Promise<SnapshotState | null> {
  if (!snapshotPath) {
    return null;
  }

  const normalizedSnapshotPath = normalizeStoredSnapshotPath(snapshotPath);

  if (!normalizedSnapshotPath) {
    return null;
  }

  return readJsonOrDefault<SnapshotState | null>(
    path.resolve(normalizedSnapshotPath),
    null,
  );
}

export async function loadDailyState(date: string): Promise<DailyState> {
  const filePath = getDailyPath(buildDailyFilename(date));

  return readJsonOrDefault<DailyState>(filePath, {
    date,
    goneReportedIds: [],
  });
}

export async function saveSnapshot(snapshot: SnapshotState): Promise<string> {
  await ensureStateDirs();

  const filename = buildSnapshotFilename(snapshot.runAt);
  const filePath = getSnapshotPath(filename);
  const relativePath = getSnapshotRelativePath(filename);

  await writeJson(filePath, snapshot);

  return relativePath;
}

export async function saveDailyState(state: DailyState): Promise<string> {
  await ensureStateDirs();

  const filePath = getDailyPath(buildDailyFilename(state.date));
  await writeJson(filePath, state);

  return filePath;
}

export async function saveLatestState(state: LatestState): Promise<string> {
  await ensureStateDirs();
  await writeJson(LATEST_PATH, state);

  return LATEST_PATH;
}

async function readJsonOrDefault<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return fallback;
    }

    throw error;
  }
}

async function writeJson(filePath: string, payload: unknown): Promise<void> {
  await writeFile(filePath, JSON.stringify(payload, null, 2) + "\n", "utf8");
}

function normalizeStoredSnapshotPath(snapshotPath: string | null): string | null {
  if (!snapshotPath) {
    return null;
  }

  if (!path.isAbsolute(snapshotPath)) {
    return snapshotPath;
  }

  return getSnapshotRelativePath(path.basename(snapshotPath));
}
