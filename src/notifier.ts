import type { CrawlResult, Language, NotificationMessage } from "./types.js";

interface BuildNotificationsInput {
  language: Language;
  currentMatches: CrawlResult[];
  goneItems: CrawlResult[];
  runLabel: string;
}

const MAX_ITEMS_PER_NOTIFICATION = 5;

const copy = {
  ko: {
    currentTitle: (runLabel: string) => `[UR 알림 ${runLabel}] 조건 만족 물건`,
    goneTitle: (runLabel: string) => `[UR 알림 ${runLabel}] 조건 제외 물건`,
    currentBlock: (item: CrawlResult) =>
      [
        `- **${escapeMarkdown(item.title)}**`,
        formatDiscountLine("ko", item),
        formatPriceGuidanceLine("ko", item),
        formatContactNameLine("ko", item),
        formatContactPhoneLine("ko", item),
        formatRentLine("ko", item),
        `  - 공익비: ${formatYen(item.feeYen)}엔`,
        formatTotalLine("ko", item),
        `  - [상세 보기](${item.url})`,
      ]
        .filter(Boolean)
        .join("\n"),
    goneBlock: (item: CrawlResult) =>
      [
        `- **${escapeMarkdown(item.title)}**`,
        formatDiscountLine("ko", item),
        formatPriceGuidanceLine("ko", item),
        formatContactNameLine("ko", item),
        formatContactPhoneLine("ko", item),
        "  - 상태: 이번 회차 기준 조건 미충족",
        `  - [상세 보기](${item.url})`,
      ]
        .filter(Boolean)
        .join("\n"),
    noItems: "대상 없음",
  },
  ja: {
    currentTitle: (runLabel: string) => `[UR通知 ${runLabel}] 条件一致物件`,
    goneTitle: (runLabel: string) => `[UR通知 ${runLabel}] 対象外になった物件`,
    currentBlock: (item: CrawlResult) =>
      [
        `- **${escapeMarkdown(item.title)}**`,
        formatDiscountLine("ja", item),
        formatPriceGuidanceLine("ja", item),
        formatContactNameLine("ja", item),
        formatContactPhoneLine("ja", item),
        formatRentLine("ja", item),
        `  - 共益費: ${formatYen(item.feeYen)}円`,
        formatTotalLine("ja", item),
        `  - [詳細を見る](${item.url})`,
      ]
        .filter(Boolean)
        .join("\n"),
    goneBlock: (item: CrawlResult) =>
      [
        `- **${escapeMarkdown(item.title)}**`,
        formatDiscountLine("ja", item),
        formatPriceGuidanceLine("ja", item),
        formatContactNameLine("ja", item),
        formatContactPhoneLine("ja", item),
        "  - 状態: 今回実行時点で条件未達",
        `  - [詳細を見る](${item.url})`,
      ]
        .filter(Boolean)
        .join("\n"),
    noItems: "対象なし",
  },
} as const;

export function buildNotifications({
  language,
  currentMatches,
  goneItems,
  runLabel,
}: BuildNotificationsInput): NotificationMessage[] {
  const localeCopy = copy[language];
  const messages: NotificationMessage[] = [];

  if (currentMatches.length > 0) {
    messages.push(
      ...buildSplitMessages(
        localeCopy.currentTitle(runLabel),
        currentMatches.map(localeCopy.currentBlock),
      ),
    );
  }

  if (goneItems.length > 0) {
    messages.push(
      ...buildSplitMessages(
        localeCopy.goneTitle(runLabel),
        goneItems.map(localeCopy.goneBlock),
      ),
    );
  }

  if (messages.length === 0) {
    messages.push({
      title: language === "ko" ? `[UR 알림 ${runLabel}] 조회 결과` : `[UR通知 ${runLabel}] 実行結果`,
      body: localeCopy.noItems,
    });
  }

  return messages;
}

export async function sendNtfyNotifications(
  serverUrl: string,
  topic: string,
  messages: NotificationMessage[],
): Promise<void> {
  if (process.env.NTFY_DRY_RUN === "1") {
    for (const message of messages) {
      console.log(`[ntfy dry-run] ${message.title}`);
      console.log(message.body);
    }

    return;
  }

  const baseUrl = serverUrl.replace(/\/$/, "");

  for (const message of messages) {
    const response = await fetch(`${baseUrl}/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Markdown: "yes",
      },
      body: JSON.stringify({
        topic,
        title: message.title,
        message: message.body,
      }),
    });

    if (!response.ok) {
      throw new Error(`ntfy request failed with status ${response.status}`);
    }
  }
}

function formatYen(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function buildSplitMessages(baseTitle: string, blocks: string[]): NotificationMessage[] {
  const groupedBlocks = groupBlocks(blocks);

  return groupedBlocks.map((group, index) => ({
    title: withPartSuffix(baseTitle, index, groupedBlocks.length),
    body: group.join("\n\n"),
  }));
}

function groupBlocks(blocks: string[]): string[][] {
  const groups: string[][] = [];
  let currentGroup: string[] = [];

  for (const block of blocks) {
    if (currentGroup.length >= MAX_ITEMS_PER_NOTIFICATION) {
      groups.push(currentGroup);
      currentGroup = [block];
      continue;
    }

    currentGroup.push(block);
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
}

function withPartSuffix(baseTitle: string, index: number, total: number): string {
  if (total <= 1) {
    return baseTitle;
  }

  return `${baseTitle} (${index + 1}/${total})`;
}

function formatContactNameLine(language: Language, item: CrawlResult): string {
  const name = item.contactName ? escapeMarkdown(item.contactName) : "";

  if (!name) {
    return "";
  }

  if (language === "ko") {
    return `  - 문의처: ${name}`;
  }

  return `  - 問い合わせ先: ${name}`;
}

function formatDiscountLine(language: Language, item: CrawlResult): string {
  if (item.discountSystems.length === 0) {
    return "";
  }

  const value = item.discountSystems.map(escapeMarkdown).join(", ");

  if (language === "ko") {
    return `  - 할인 제도: ${value}`;
  }

  return `  - 割引制度: ${value}`;
}

function formatPriceGuidanceLine(language: Language, item: CrawlResult): string {
  if (!item.priceInquiryRequired) {
    return "";
  }

  if (language === "ko") {
    return "  - 금액 안내: 할인 적용 후 월세는 문의 필요";
  }

  return "  - 金額案内: 割引適用後の家賃は要問い合わせ";
}

function formatRentLine(language: Language, item: CrawlResult): string {
  const label =
    item.rentBasis === "discount_pre_rent"
      ? language === "ko"
        ? "월세(할인 적용 전)"
        : "家賃(割引適用前)"
      : language === "ko"
        ? "월세"
        : "家賃";

  return `  - ${label}: ${formatYen(item.rentYen)}${language === "ko" ? "엔" : "円"}`;
}

function formatTotalLine(language: Language, item: CrawlResult): string {
  const label =
    item.rentBasis === "discount_pre_rent"
      ? language === "ko"
        ? "합계(할인 적용 전)"
        : "合計(割引適用前)"
      : language === "ko"
        ? "합계"
        : "合計";

  return `  - ${label}: ${formatYen(item.totalPriceYen)}${language === "ko" ? "엔" : "円"}`;
}

function formatContactPhoneLine(language: Language, item: CrawlResult): string {
  if (!item.contactPhone) {
    return "";
  }

  if (language === "ko") {
    return `  - 전화: ${item.contactPhone}`;
  }

  return `  - 電話: ${item.contactPhone}`;
}

function escapeMarkdown(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\*/g, "\\*")
    .replace(/_/g, "\\_")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]");
}
