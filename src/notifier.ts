import type { CrawlResult, Language, NotificationMessage } from "./types.js";

interface BuildNotificationsInput {
  language: Language;
  currentMatches: CrawlResult[];
  goneItems: CrawlResult[];
  runLabel: string;
}

const copy = {
  ko: {
    currentTitle: (runLabel: string) => `[UR 알림 ${runLabel}] 조건 만족 물건`,
    goneTitle: (runLabel: string) => `[UR 알림 ${runLabel}] 조건 제외 물건`,
    currentBlock: (item: CrawlResult) =>
      [
        `- **${escapeMarkdown(item.title)}**`,
        `  - 월세: ${formatYen(item.rentYen)}엔`,
        `  - 공익비: ${formatYen(item.feeYen)}엔`,
        `  - 합계: ${formatYen(item.totalPriceYen)}엔`,
        formatContactLine("ko", item),
        `  - [상세 보기](${item.url})`,
      ]
        .filter(Boolean)
        .join("\n"),
    goneBlock: (item: CrawlResult) =>
      [
        `- **${escapeMarkdown(item.title)}**`,
        "  - 상태: 이번 회차 기준 조건 미충족",
        formatContactLine("ko", item),
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
        `  - 家賃: ${formatYen(item.rentYen)}円`,
        `  - 共益費: ${formatYen(item.feeYen)}円`,
        `  - 合計: ${formatYen(item.totalPriceYen)}円`,
        formatContactLine("ja", item),
        `  - [詳細を見る](${item.url})`,
      ]
        .filter(Boolean)
        .join("\n"),
    goneBlock: (item: CrawlResult) =>
      [
        `- **${escapeMarkdown(item.title)}**`,
        "  - 状態: 今回実行時点で条件未達",
        formatContactLine("ja", item),
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
    messages.push({
      title: localeCopy.currentTitle(runLabel),
      body: currentMatches.map(localeCopy.currentBlock).join("\n\n"),
    });
  }

  if (goneItems.length > 0) {
    messages.push({
      title: localeCopy.goneTitle(runLabel),
      body: goneItems.map(localeCopy.goneBlock).join("\n\n"),
    });
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
      },
      body: JSON.stringify({
        topic,
        title: message.title,
        message: message.body,
        markdown: true,
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

function formatContactLine(language: Language, item: CrawlResult): string {
  const name = item.contactName ? escapeMarkdown(item.contactName) : "";
  const phone = item.contactPhone ? `[${item.contactPhone}](tel:${toDialable(item.contactPhone)})` : "";

  if (!name && !phone) {
    return "";
  }

  if (language === "ko") {
    if (name && phone) {
      return `  - 문의처: ${name} / ${phone}`;
    }

    return `  - 문의처: ${name || phone}`;
  }

  if (name && phone) {
    return `  - 問い合わせ先: ${name} / ${phone}`;
  }

  return `  - 問い合わせ先: ${name || phone}`;
}

function toDialable(phone: string): string {
  return phone.replace(/[^\d+]/g, "");
}

function escapeMarkdown(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\*/g, "\\*")
    .replace(/_/g, "\\_")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]");
}
