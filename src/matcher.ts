import type { AppConfig, CrawlResult, MatchDiff, SnapshotState } from "./types.js";

export function computeIsMatched(
  result: Pick<CrawlResult, "rentYen" | "feeYen" | "totalPriceYen" | "isAvailable" | "discountSystems">,
  config: Pick<AppConfig, "priceMode" | "maxPriceYen" | "discountFilter">,
): boolean {
  if (!result.isAvailable) {
    return false;
  }

  const isPriceMatched =
    config.priceMode === "rent_only"
      ? result.rentYen <= config.maxPriceYen
      : result.totalPriceYen <= config.maxPriceYen;

  if (!isPriceMatched) {
    return false;
  }

  return matchesDiscountFilter(result.discountSystems, config.discountFilter);
}

function matchesDiscountFilter(
  discountSystems: CrawlResult["discountSystems"],
  filter: Pick<AppConfig, "discountFilter">["discountFilter"],
): boolean {
  if (filter.mode === "ignore" || filter.systems.length === 0) {
    return true;
  }

  const selectedSystems = new Set(filter.systems);
  const hasSelectedSystem = discountSystems.some((system) => selectedSystems.has(system));

  if (filter.mode === "include") {
    return hasSelectedSystem;
  }

  return !hasSelectedSystem;
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
