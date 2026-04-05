import type { AppConfig, CrawlResult, MatchDiff, SnapshotState } from "./types.js";

export function computeIsMatched(
  result: Pick<CrawlResult, "rentYen" | "feeYen" | "totalPriceYen" | "isAvailable">,
  config: Pick<AppConfig, "priceMode" | "maxPriceYen">,
): boolean {
  if (!result.isAvailable) {
    return false;
  }

  if (config.priceMode === "rent_only") {
    return result.rentYen <= config.maxPriceYen;
  }

  return result.totalPriceYen <= config.maxPriceYen;
}

export function collectMatchedIds(results: CrawlResult[]): string[] {
  return Array.from(
    new Set(results.filter((result) => result.isMatched).map((result) => result.id)),
  );
}

export function diffMatches(
  previousSnapshot: SnapshotState | null,
  currentMatchedIds: string[],
  goneReportedIdsToday: string[],
): MatchDiff {
  const previousMatchedIds = previousSnapshot?.matchedIds ?? [];
  const currentIdSet = new Set(currentMatchedIds);
  const goneReportedSet = new Set(goneReportedIdsToday);

  const goneIds = previousMatchedIds.filter(
    (id) => !currentIdSet.has(id) && !goneReportedSet.has(id),
  );

  return {
    currentMatchedIds,
    goneIds,
  };
}
