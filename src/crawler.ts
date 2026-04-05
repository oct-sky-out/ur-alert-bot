import { chromium, type Page } from "playwright";

import {
  parseBuildingPageMetadata,
  parseBuildingRoomResults,
  parseRoomResultFromApi,
  parseRoomResultFromDom,
  type BuildingPageMetadata,
  type BuildingRoomApiRecord,
  type RoomApiRecord,
} from "./parser.js";
import type { AppConfig, CrawlResult, TargetConfig } from "./types.js";

const NAVIGATION_TIMEOUT_MS = 30_000;
const API_TIMEOUT_MS = 15_000;
const BUILDING_ROOM_API_URL =
  "https://chintai.r6.ur-net.go.jp/chintai/api/bukken/detail/detail_bukken_room/";

export async function crawlTargets(
  config: Pick<AppConfig, "targets" | "priceMode" | "maxPriceYen">,
  checkedAt: string,
): Promise<CrawlResult[]> {
  const enabledTargets = config.targets.filter((item) => item.enabled);
  const buildingTargets = enabledTargets.filter((item) => !isRoomDetailUrl(item.url));
  const roomTargets = enabledTargets.filter((item) => isRoomDetailUrl(item.url));
  const results: CrawlResult[] = [];

  for (const target of buildingTargets) {
    results.push(...(await crawlBuildingTarget(target, config, checkedAt)));
  }

  if (roomTargets.length === 0) {
    return results;
  }

  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      locale: "ja-JP",
      timezoneId: "Asia/Tokyo",
    });

    for (const target of roomTargets) {
      const page = await context.newPage();

      try {
        results.push(await crawlRoomDetailTarget(page, target, config, checkedAt));
      } finally {
        await page.close();
      }
    }

    await context.close();
  } finally {
    await browser.close();
  }

  return results;
}

async function crawlBuildingTarget(
  target: TargetConfig,
  config: Pick<AppConfig, "priceMode" | "maxPriceYen">,
  checkedAt: string,
): Promise<CrawlResult[]> {
  try {
    const response = await fetch(target.url);

    if (!response.ok) {
      return [buildFailureResult(target, checkedAt, `HTTP ${response.status()} while opening the building page.`)];
    }

    const html = await response.text();
    const metadata = parseBuildingPageMetadata(html, target);

    if (!metadata) {
      return [
        buildFailureResult(
          target,
          checkedAt,
          "Could not parse building identifiers from the target page.",
        ),
      ];
    }

    const records = await fetchAllBuildingRooms(metadata);

    return parseBuildingRoomResults(records, metadata, target, config, checkedAt);
  } catch (error) {
    return [buildFailureResult(target, checkedAt, toErrorMessage(error))];
  }
}

async function fetchAllBuildingRooms(
  metadata: BuildingPageMetadata,
): Promise<BuildingRoomApiRecord[] | null> {
  const firstPage = await fetchBuildingRoomPage(metadata, 0);

  if (firstPage === null) {
    return null;
  }

  if (firstPage.length === 0) {
    return [];
  }

  const allCount = toNumber(firstPage[0].allCount) ?? firstPage.length;
  const rowMax = toNumber(firstPage[0].rowMax) ?? firstPage.length;
  const pageCount = Math.max(1, Math.ceil(allCount / Math.max(1, rowMax)));
  const records = [...firstPage];

  for (let pageIndex = 1; pageIndex < pageCount; pageIndex += 1) {
    const nextPage = await fetchBuildingRoomPage(metadata, pageIndex);

    if (nextPage === null) {
      throw new Error(`Building room API returned null for pageIndex=${pageIndex}.`);
    }

    records.push(...nextPage);
  }

  return records;
}

async function fetchBuildingRoomPage(
  metadata: BuildingPageMetadata,
  pageIndex: number,
): Promise<BuildingRoomApiRecord[] | null> {
  const body = new URLSearchParams({
    shisya: metadata.shisya,
    danchi: metadata.danchi,
    shikibetu: metadata.shikibetu,
    orderByField: "0",
    orderBySort: "0",
    pageIndex: String(pageIndex),
    sp: "",
  });
  const response = await fetch(BUILDING_ROOM_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`Building room API failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as unknown;

  if (payload === null) {
    return null;
  }

  if (!Array.isArray(payload)) {
    throw new Error("Building room API returned a non-array payload.");
  }

  return payload as BuildingRoomApiRecord[];
}

async function crawlRoomDetailTarget(
  page: Page,
  target: TargetConfig,
  config: Pick<AppConfig, "priceMode" | "maxPriceYen">,
  checkedAt: string,
): Promise<CrawlResult> {
  const apiPayloadPromise = page
    .waitForResponse(
      (response) =>
        response.request().method().toUpperCase() === "POST" &&
        response.url().includes("/bukken/detail/detail_room/"),
      { timeout: API_TIMEOUT_MS },
    )
    .then(async (response) => (await response.json()) as unknown)
    .catch(() => null);

  const response = await page.goto(target.url, {
    waitUntil: "domcontentloaded",
    timeout: NAVIGATION_TIMEOUT_MS,
  });

  if (response && response.status() >= 400) {
    return {
      id: target.id,
      targetId: target.id,
      targetUrl: target.url,
      url: target.url,
      title: target.label || target.id,
      rentYen: 0,
      feeYen: 0,
      totalPriceYen: 0,
      isAvailable: false,
      isMatched: false,
      checkedAt,
      parseStatus: "parse_failed",
      parseMessage: `HTTP ${response.status()} while opening the room detail page.`,
    };
  }

  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);

  const apiPayload = await apiPayloadPromise;

  if (Array.isArray(apiPayload) && apiPayload.length > 0) {
    return parseRoomResultFromApi(
      apiPayload[0] as RoomApiRecord,
      target,
      config,
      checkedAt,
    );
  }

  const dom = await readRoomDom(page);

  return parseRoomResultFromDom(dom, target, config, checkedAt);
}

async function readRoomDom(page: Page) {
  return page.evaluate(() => {
    const text = (selector: string) =>
      document.querySelector<HTMLElement>(selector)?.innerText?.trim() ?? "";

    return {
      bodyText: document.body?.innerText ?? "",
      documentTitle: document.title ?? "",
      roomNameText: text(".rep_room-nm, .rep_roomNm, .js-roomname"),
      rentText: text(".rep_rent"),
      commonFeeText: text(".rep_commonfee"),
      availableDateText: text(".rep_availableDate"),
    };
  });
}

function buildFailureResult(
  target: TargetConfig,
  checkedAt: string,
  message: string,
): CrawlResult {
  return {
    id: `${target.id}:error`,
    targetId: target.id,
    targetUrl: target.url,
    url: target.url,
    title: target.label || target.id,
    rentYen: 0,
    feeYen: 0,
    totalPriceYen: 0,
    isAvailable: false,
    isMatched: false,
    checkedAt,
    parseStatus: "parse_failed",
    parseMessage: message,
  };
}

function isRoomDetailUrl(urlText: string): boolean {
  return new URL(urlText).pathname.includes("_room.html");
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function toNumber(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}
