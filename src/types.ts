export type Language = "ko" | "ja";
export type PriceMode = "rent_only" | "rent_plus_fee";

export interface TargetConfig {
  id: string;
  label?: string;
  url: string;
  enabled: boolean;
}

export interface NtfyConfig {
  serverUrl: string;
  topic: string;
}

export interface AppConfig {
  timezone: string;
  scheduleTimes: string[];
  language: Language;
  priceMode: PriceMode;
  maxPriceYen: number;
  ntfy: NtfyConfig;
  targets: TargetConfig[];
}

export interface ContactInfo {
  contactName?: string;
  contactPhone?: string;
}

export interface CrawlResult extends ContactInfo {
  id: string;
  targetId: string;
  targetUrl: string;
  url: string;
  title: string;
  buildingName?: string;
  roomId?: string;
  rentYen: number;
  feeYen: number;
  totalPriceYen: number;
  isAvailable: boolean;
  isMatched: boolean;
  checkedAt: string;
  parseStatus: "ok" | "parse_failed";
  parseMessage?: string;
}

export interface SnapshotState {
  runAt: string;
  priceMode: PriceMode;
  maxPriceYen: number;
  language: Language;
  matchedIds: string[];
  results: CrawlResult[];
}

export interface DailyState {
  date: string;
  goneReportedIds: string[];
}

export interface LatestState {
  lastRunAt: string | null;
  latestSnapshotPath: string | null;
}

export interface MatchDiff {
  currentMatchedIds: string[];
  goneIds: string[];
}

export interface NotificationMessage {
  title: string;
  body: string;
}
