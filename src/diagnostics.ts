import type { CrawlResult, RunDiagnostics } from "./types.js";

export function analyzeRunDiagnostics(
  results: CrawlResult[],
  matchedIds: string[],
): RunDiagnostics {
  const parseFailures = results.filter((result) => result.parseStatus === "parse_failed");
  const warnings = parseFailures.map((result) => buildParseFailureWarning(result));
  const totalResults = results.length;
  const parseFailureCount = parseFailures.length;
  const structureChangeSuspected =
    totalResults === 0 ||
    (parseFailureCount > 0 &&
      (parseFailureCount === totalResults ||
        parseFailureCount >= Math.max(2, Math.ceil(totalResults / 2))));

  if (totalResults === 0) {
    warnings.unshift("Crawler returned zero results. UR page structure or fetch flow may have changed.");
  } else if (structureChangeSuspected) {
    warnings.unshift(
      `High parse failure ratio detected (${parseFailureCount}/${totalResults}). UR page structure may have changed.`,
    );
  }

  return {
    totalResults,
    matchedCount: matchedIds.length,
    parseFailureCount,
    structureChangeSuspected,
    warnings,
    parseFailureIds: parseFailures.map((result) => result.id),
  };
}

export function logRunDiagnostics(runLabel: string, diagnostics: RunDiagnostics): void {
  console.log(
    `[run:${runLabel}] results=${diagnostics.totalResults} matched=${diagnostics.matchedCount} parse_failed=${diagnostics.parseFailureCount}`,
  );

  if (!diagnostics.structureChangeSuspected && diagnostics.warnings.length === 0) {
    return;
  }

  if (diagnostics.structureChangeSuspected) {
    console.warn(`[run:${runLabel}] structure-change-suspected=yes`);
  }

  for (const warning of diagnostics.warnings) {
    console.warn(`[run:${runLabel}] ${warning}`);
  }
}

function buildParseFailureWarning(result: CrawlResult): string {
  const evidence = result.parseEvidence?.length
    ? ` evidence=${result.parseEvidence.join(" | ")}`
    : "";

  return `parse_failed target=${result.targetId} result=${result.id} title="${result.title}" reason="${result.parseMessage ?? "unknown"}"${evidence}`;
}
