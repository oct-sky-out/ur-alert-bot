import { computeIsMatched } from "./matcher.js";
import type { AppConfig, ContactInfo, CrawlResult, TargetConfig } from "./types.js";

export interface BuildingPageMetadata extends ContactInfo {
  buildingName: string;
  shisya: string;
  danchi: string;
  shikibetu: string;
}

export interface BuildingRoomApiRecord {
  allCount?: string;
  rowMax?: string;
  pageIndex?: string;
  id?: string;
  name?: string;
  roomDetailLink?: string;
  roomDetailLinkSp?: string;
  rent?: string;
  commonfee?: string;
  commonfee_sp?: string;
  type?: string;
  floor?: string;
  floorspace?: string;
}

export interface RoomApiRecord {
  id?: string;
  roomNm?: string;
  rent?: string;
  rent_sp?: string;
  commonfee?: string;
  commonfee_sp?: string;
  availableDate?: string;
}

export interface RoomDomSnapshot {
  bodyText: string;
  documentTitle: string;
  roomNameText: string;
  rentText: string;
  commonFeeText: string;
  availableDateText: string;
}

export function parseBuildingPageMetadata(
  html: string,
  target: TargetConfig,
): BuildingPageMetadata | null {
  const initSearchMatch = html.match(
    /ur\.api\.bukken_detail\.initSearch\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'/m,
  );

  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  const fallback = parseIdsFromUrl(target.url);

  if (!initSearchMatch && !fallback) {
    return null;
  }

  const buildingName =
    target.label ||
    cleanTitle(decodeHtmlEntities(titleMatch?.[1])) ||
    target.id;
  const contactInfo = parseContactInfoFromHtml(html);

  return {
    buildingName,
    shisya: initSearchMatch?.[1] ?? fallback?.shisya ?? "",
    danchi: initSearchMatch?.[2] ?? fallback?.danchi ?? "",
    shikibetu: initSearchMatch?.[3] ?? fallback?.shikibetu ?? "",
    contactName: contactInfo.contactName,
    contactPhone: contactInfo.contactPhone,
  };
}

export function parseBuildingRoomResults(
  records: BuildingRoomApiRecord[] | null,
  metadata: BuildingPageMetadata,
  target: TargetConfig,
  config: Pick<AppConfig, "priceMode" | "maxPriceYen">,
  checkedAt: string,
): CrawlResult[] {
  if (records === null) {
    return [];
  }

  return records.map((record, index) => {
    const roomId =
      cleanText(record.id) ||
      extractJkss(record.roomDetailLink) ||
      extractJkss(record.roomDetailLinkSp) ||
      `room-${index + 1}`;
    const roomName = cleanText(record.name) || roomId;
    const rentYen = parseYen(record.rent);
    const feeYen = parseYen(record.commonfee_sp) ?? parseYen(record.commonfee) ?? 0;

    if (rentYen === null) {
      return buildParseFailureResult(
        target,
        checkedAt,
        "Could not parse rent from building room API response.",
        `${metadata.buildingName} ${roomName}`.trim(),
        `${target.id}:${roomId}`,
      );
    }

    const totalPriceYen = rentYen + feeYen;
    const isMatched = computeIsMatched(
      {
        rentYen,
        feeYen,
        totalPriceYen,
        isAvailable: true,
      },
      config,
    );

    return {
      id: `${target.id}:${roomId}`,
      targetId: target.id,
      targetUrl: target.url,
      url: toAbsoluteUrl(record.roomDetailLink ?? record.roomDetailLinkSp, target.url),
      title: `${metadata.buildingName} ${roomName}`.trim(),
      buildingName: metadata.buildingName,
      roomId,
      contactName: metadata.contactName,
      contactPhone: metadata.contactPhone,
      rentYen,
      feeYen,
      totalPriceYen,
      isAvailable: true,
      isMatched,
      checkedAt,
      parseStatus: "ok",
      parseMessage: [cleanText(record.type), cleanText(record.floor)]
        .filter(Boolean)
        .join(" | ") || undefined,
    };
  });
}

export function parseRoomResultFromApi(
  record: RoomApiRecord | null,
  target: TargetConfig,
  config: Pick<AppConfig, "priceMode" | "maxPriceYen">,
  checkedAt: string,
  contactInfo: ContactInfo = {},
): CrawlResult {
  if (!record) {
    return buildParseFailureResult(
      target,
      checkedAt,
      "Room detail API returned no data. This often means the URL has no valid JKSS or the room is no longer available.",
    );
  }

  const title = cleanText(record.roomNm) || target.label || target.id;
  const roomId = cleanText(record.id) || extractJkss(target.url) || target.id;
  const rentText = cleanText(record.rent_sp) || cleanText(record.rent);
  const commonFeeText = cleanText(record.commonfee_sp) || cleanText(record.commonfee);
  const rentYen = parseYen(rentText);
  const feeYen = parseYen(commonFeeText);

  if (rentYen === null) {
    return buildParseFailureResult(
      target,
      checkedAt,
      "Could not parse rent from room detail API response.",
      title,
      `${target.id}:${roomId}`,
    );
  }

  const totalPriceYen = rentYen + (feeYen ?? 0);
  const isAvailable = Boolean(cleanText(record.id));
  const isMatched = computeIsMatched(
    {
      rentYen,
      feeYen: feeYen ?? 0,
      totalPriceYen,
      isAvailable,
    },
    config,
  );

  return {
    id: `${target.id}:${roomId}`,
    targetId: target.id,
    targetUrl: target.url,
    url: target.url,
    title,
    roomId,
    contactName: contactInfo.contactName,
    contactPhone: contactInfo.contactPhone,
    rentYen,
    feeYen: feeYen ?? 0,
    totalPriceYen,
    isAvailable,
    isMatched,
    checkedAt,
    parseStatus: "ok",
    parseMessage: cleanText(record.availableDate) || undefined,
  };
}

export function parseRoomResultFromDom(
  dom: RoomDomSnapshot,
  target: TargetConfig,
  config: Pick<AppConfig, "priceMode" | "maxPriceYen">,
  checkedAt: string,
  contactInfo: ContactInfo = {},
): CrawlResult {
  const bodyText = cleanText(dom.bodyText);

  if (
    bodyText.includes("お探しのページがみつかりませんでした")
  ) {
    return buildParseFailureResult(
      target,
      checkedAt,
      "Room detail page did not expose active room data in the rendered DOM.",
      cleanTitle(dom.documentTitle) || target.label || target.id,
      `${target.id}:${extractJkss(target.url) || "dom-error"}`,
    );
  }

  const title =
    cleanText(dom.roomNameText) || cleanTitle(dom.documentTitle) || target.label || target.id;
  const roomId = extractJkss(target.url) || target.id;
  const rentYen = parseYen(dom.rentText);
  const feeYen = parseYen(dom.commonFeeText);

  if (rentYen === null) {
    return buildParseFailureResult(
      target,
      checkedAt,
      "Could not parse rent from rendered DOM.",
      title,
      `${target.id}:${roomId}`,
    );
  }

  const totalPriceYen = rentYen + (feeYen ?? 0);
  const isAvailable = true;
  const isMatched = computeIsMatched(
    {
      rentYen,
      feeYen: feeYen ?? 0,
      totalPriceYen,
      isAvailable,
    },
    config,
  );

  return {
    id: `${target.id}:${roomId}`,
    targetId: target.id,
    targetUrl: target.url,
    url: target.url,
    title,
    roomId,
    contactName: contactInfo.contactName,
    contactPhone: contactInfo.contactPhone,
    rentYen,
    feeYen: feeYen ?? 0,
    totalPriceYen,
    isAvailable,
    isMatched,
    checkedAt,
    parseStatus: "ok",
    parseMessage: cleanText(dom.availableDateText) || undefined,
  };
}

export function parseContactInfoFromHtml(html: string): ContactInfo {
  const contactName = extractPrimaryContactName(html);
  const contactPhone = extractPrimaryContactPhone(html);

  return {
    contactName: contactName || undefined,
    contactPhone: contactPhone || undefined,
  };
}

function buildParseFailureResult(
  target: TargetConfig,
  checkedAt: string,
  message: string,
  title = target.label || target.id,
  resultId = `${target.id}:error`,
): CrawlResult {
  return {
    id: resultId,
    targetId: target.id,
    targetUrl: target.url,
    url: target.url,
    title,
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

function parseYen(rawText: string | undefined): number | null {
  const text = cleanText(rawText);

  if (!text || text === "-" || text === "－") {
    return null;
  }

  const manMatch = text.match(/([0-9]+(?:\.[0-9]+)?)\s*万/);

  if (manMatch) {
    return Math.round(Number(manMatch[1]) * 10000);
  }

  const digits = text.replace(/[^\d]/g, "");

  if (!digits) {
    return null;
  }

  return Number(digits);
}

function cleanTitle(rawTitle: string | undefined): string {
  return cleanText(rawTitle)
    .replace(/（.*?）/g, "")
    .replace(/｜UR賃貸住宅/g, "")
    .replace(/の賃貸物件/g, "")
    .trim();
}

function parseIdsFromUrl(urlText: string): BuildingPageMetadata | null {
  const pathname = new URL(urlText).pathname;
  const match = pathname.match(/\/(\d+)_([0-9]+)([0-9])\.html$/);

  if (!match) {
    return null;
  }

  return {
    buildingName: "",
    shisya: match[1],
    danchi: match[2],
    shikibetu: match[3],
  };
}

function extractJkss(urlText: string | undefined): string | null {
  if (!urlText) {
    return null;
  }

  const match = urlText.match(/[?&]JKSS=([^&]+)/i);

  return match?.[1] ?? null;
}

function toAbsoluteUrl(urlText: string | undefined, baseUrl: string): string {
  if (!urlText) {
    return baseUrl;
  }

  return new URL(urlText, baseUrl).href;
}

function decodeHtmlEntities(raw: string | undefined): string {
  return (raw ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ");
}

function cleanText(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function extractPrimaryContactName(html: string): string | null {
  const noteMatch = html.match(/<div class="contactblock_item_note">([\s\S]*?)<\/div>/i);

  if (!noteMatch) {
    return null;
  }

  const noteText = decodeHtmlEntities(noteMatch[1])
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  const firstLine = noteText
    .split("\n")
    .map((line) => cleanText(line))
    .find(Boolean);

  return firstLine || null;
}

function extractPrimaryContactPhone(html: string): string | null {
  const patterns = [
    /button_contact--tel[\s\S]*?<span>[\s\S]*?<br>\s*([0-9０-９]{2,4}[-－][0-9０-９]{2,4}[-－][0-9０-９]{3,4})\s*<\/span>/i,
    /class="item_tel_number">\s*([0-9０-９]{2,4}[-－][0-9０-９]{2,4}[-－][0-9０-９]{3,4})\s*<\/span>/i,
    /class="item_tel">\s*([0-9０-９]{2,4}[-－][0-9０-９]{2,4}[-－][0-9０-９]{3,4})\s*<\/strong>/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    const phone = normalizePhone(match?.[1]);

    if (phone) {
      return phone;
    }
  }

  return null;
}

function normalizePhone(value: string | undefined): string {
  const text = cleanText(value)
    .replace(/[０-９]/g, (digit) => String(digit.charCodeAt(0) - 0xff10))
    .replace(/－/g, "-");

  return /^[0-9]{2,4}-[0-9]{2,4}-[0-9]{3,4}$/.test(text) ? text : "";
}
