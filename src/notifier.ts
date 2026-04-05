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
    currentLine: (item: CrawlResult) =>
      `- ${item.title} | 월세 ${formatYen(item.rentYen)}엔 | 공익비 ${formatYen(item.feeYen)}엔 | 합계 ${formatYen(item.totalPriceYen)}엔 | ${item.url}`,
    goneLine: (item: CrawlResult) =>
      `- ${item.title} | 이번 회차 기준 조건 미충족 | ${item.url}`,
    noItems: "대상 없음",
  },
  ja: {
    currentTitle: (runLabel: string) => `[UR通知 ${runLabel}] 条件一致物件`,
    goneTitle: (runLabel: string) => `[UR通知 ${runLabel}] 対象外になった物件`,
    currentLine: (item: CrawlResult) =>
      `- ${item.title} | 家賃 ${formatYen(item.rentYen)}円 | 共益費 ${formatYen(item.feeYen)}円 | 合計 ${formatYen(item.totalPriceYen)}円 | ${item.url}`,
    goneLine: (item: CrawlResult) =>
      `- ${item.title} | 今回実行時点で条件未達 | ${item.url}`,
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
      body: currentMatches.map(localeCopy.currentLine).join("\n"),
    });
  }

  if (goneItems.length > 0) {
    messages.push({
      title: localeCopy.goneTitle(runLabel),
      body: goneItems.map(localeCopy.goneLine).join("\n"),
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
