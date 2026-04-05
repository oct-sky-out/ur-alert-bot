import { crawlTargets } from "./crawler.js";
import { loadConfig } from "./config.js";
import { analyzeRunDiagnostics, logRunDiagnostics } from "./diagnostics.js";
import { buildNotifications, sendNtfyNotifications } from "./notifier.js";
import { collectMatchedIds, diffMatches } from "./matcher.js";
import {
  ensureStateDirs,
  loadDailyState,
  loadLatestState,
  loadSnapshot,
  saveDailyState,
  saveLatestState,
  saveSnapshot,
} from "./state-store.js";
import { pruneStateFiles } from "./retention.js";
import { getTokyoRunContext } from "./time.js";
import type { CrawlResult, SnapshotState } from "./types.js";

export async function main(): Promise<void> {
  const configPath = process.env.CONFIG_PATH ?? process.argv[2] ?? "config.json";
  const config = await loadConfig(configPath);
  const now = new Date();
  const runContext = getTokyoRunContext(now);

  await ensureStateDirs();

  const latestState = await loadLatestState();
  const previousSnapshot = await loadSnapshot(latestState.latestSnapshotPath);
  const dailyState = await loadDailyState(runContext.date);

  const results = await crawlTargets(config, runContext.runAtIso);
  const matchedIds = collectMatchedIds(results);
  const diagnostics = analyzeRunDiagnostics(results, matchedIds);
  logRunDiagnostics(runContext.runLabel, diagnostics);
  const diff = diffMatches(previousSnapshot, matchedIds, dailyState.goneReportedIds);

  const currentMatches = results.filter((result) => diff.currentMatchedIds.includes(result.id));
  const goneItems = resolveGoneItems(diff.goneIds, previousSnapshot);

  const messages = buildNotifications({
    language: config.language,
    currentMatches,
    goneItems,
    runLabel: runContext.runLabel,
  });

  const snapshot: SnapshotState = {
    runAt: runContext.runAtIso,
    priceMode: config.priceMode,
    maxPriceYen: config.maxPriceYen,
    discountFilter: config.discountFilter,
    language: config.language,
    matchedIds,
    results,
    diagnostics,
  };

  await sendNtfyNotifications(config.ntfy.serverUrl, config.ntfy.topic, messages);

  const snapshotPath = await saveSnapshot(snapshot);
  await saveDailyState({
    date: runContext.date,
    goneReportedIds: [...new Set([...dailyState.goneReportedIds, ...diff.goneIds])],
  });
  await saveLatestState({
    lastRunAt: runContext.runAtIso,
    latestSnapshotPath: snapshotPath,
  });

  await pruneStateFiles(now);
}

function resolveGoneItems(goneIds: string[], previousSnapshot: SnapshotState | null): CrawlResult[] {
  if (!previousSnapshot) {
    return [];
  }

  const previousMap = new Map(previousSnapshot.results.map((item) => [item.id, item]));

  return goneIds
    .map((id) => previousMap.get(id))
    .filter((item): item is CrawlResult => item !== undefined);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
