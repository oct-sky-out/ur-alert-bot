export type Language = "ko" | "ja";
export type PriceMode = "rent_only" | "rent_plus_fee";
export const SUPPORTED_DISCOUNT_SYSTEMS = ["近居割", "U35割", "すくすく割", "子育て割"] as const;
export type DiscountSystem = (typeof SUPPORTED_DISCOUNT_SYSTEMS)[number];
export type DiscountFilterMode = "ignore" | "include" | "exclude";
export type RentBasis = "listed_rent" | "discount_pre_rent";

export interface DiscountFilterConfig {
  mode: DiscountFilterMode;
  systems: DiscountSystem[];
}

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
  discountFilter: DiscountFilterConfig;
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
  discountSystems: DiscountSystem[];
  rentBasis: RentBasis;
  priceInquiryRequired: boolean;
  rentYen: number;
  feeYen: number;
  totalPriceYen: number;
  isAvailable: boolean;
  isMatched: boolean;
  checkedAt: string;
  parseStatus: "ok" | "parse_failed";
  parseMessage?: string;
  parseEvidence?: string[];
}

export interface RunDiagnostics {
  totalResults: number;
  matchedCount: number;
  parseFailureCount: number;
  structureChangeSuspected: boolean;
  warnings: string[];
  parseFailureIds: string[];
}

export interface SnapshotState {
  runAt: string;
  priceMode: PriceMode;
  maxPriceYen: number;
  discountFilter: DiscountFilterConfig;
  language: Language;
  matchedIds: string[];
  results: CrawlResult[];
  diagnostics: RunDiagnostics;
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
