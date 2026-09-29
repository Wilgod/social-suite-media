export const PLATFORMS = ["youtube", "facebook", "instagram", "threads", "x", "douyin", "bilibili", "weibo", "xiaohongshu", "tiktok"] as const;
export type Platform = (typeof PLATFORMS)[number];

/**
 * OAuth apps are registered once per provider. Meta covers facebook only — Instagram uses
 * "Instagram API with Instagram Login", which has its own separate app ID/secret from Facebook's.
 */
export const OAUTH_PROVIDERS = ["google", "meta", "instagram", "threads", "x", "douyin", "bilibili", "weibo", "xiaohongshu", "tiktok"] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

export const PROVIDER_BY_PLATFORM: Record<Platform, OAuthProvider> = {
  youtube: "google",
  facebook: "meta",
  instagram: "instagram",
  threads: "threads",
  x: "x",
  douyin: "douyin",
  bilibili: "bilibili",
  weibo: "weibo",
  xiaohongshu: "xiaohongshu",
  tiktok: "tiktok",
};

export const PLATFORM_LABELS: Record<Platform, string> = {
  youtube: "YouTube",
  facebook: "Facebook",
  instagram: "Instagram",
  threads: "Threads",
  x: "X",
  douyin: "抖音",
  bilibili: "哔哩哔哩",
  weibo: "微博",
  xiaohongshu: "小红书",
  tiktok: "TikTok",
};

/** Platforms kept in the schema/adapters but hidden from connect/settings until the API is reliable enough. */
export const PAUSED_PLATFORMS: ReadonlySet<Platform> = new Set(["douyin", "bilibili", "weibo", "xiaohongshu"]);
export const PAUSED_OAUTH_PROVIDERS: ReadonlySet<OAuthProvider> = new Set(["douyin", "bilibili", "weibo", "xiaohongshu"]);

export interface PlatformAppCredentials {
  clientId: string;
  clientSecret: string;
}

/** One day of aggregate performance for a connected account. */
export interface DailyStat {
  /** YYYY-MM-DD */
  date: string;
  views: number;
  likes: number;
  comments: number;
  subscribersGained: number;
  subscribersLost: number;
  estimatedMinutesWatched: number;
  shares?: number;
  favorites?: number;
}

/** Latest engagement for one published post/video on a platform. */
export interface PostMetrics {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  favorites: number;
  coins?: number;
  extra?: Record<string, number>;
}

export interface PostComment {
  externalId: string;
  parentExternalId?: string;
  authorExternalId?: string;
  authorName: string;
  body: string;
  likeCount?: number;
  publishedAt?: Date;
}

export type ContentFormat = "short" | "video" | "live" | "unspecified";

/** Aggregate performance attributed to one content format over a window (e.g. Shorts vs regular videos). */
export interface ContentFormatStat {
  contentFormat: ContentFormat;
  views: number;
  subscribersGained: number;
  subscribersLost: number;
  estimatedMinutesWatched: number;
}

/** One piece of content already published on the platform (not something created through this app). */
export interface ContentItem {
  externalId: string;
  title: string;
  thumbnailUrl?: string;
  /** ISO 8601 */
  publishedAt: string;
  url: string;
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  favorites?: number;
  durationSeconds?: number;
  /** Short-form content (e.g. YouTube Shorts) — currently inferred from duration, so treat as a heuristic. */
  isShortForm?: boolean;
  /** Set when the platform API says what kind of post this is. */
  mediaKind?: "text" | "image" | "video" | "short" | "live";
}

export type SocialAccountStatus = "active" | "expired" | "revoked" | "error";

export type PostStatus =
  | "draft"
  | "scheduled"
  | "publishing"
  | "partially_published"
  | "published"
  | "failed"
  | "canceled";

export type PostTargetStatus = "pending" | "queued" | "publishing" | "success" | "failed" | "skipped";

export interface NormalizedTokenResult {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scopes: string[];
  accountId?: string;
  accountName?: string;
}

export interface AccountIdentity {
  externalId: string;
  displayName: string;
  avatarUrl?: string;
  /** Per-account token when the platform issues one (Facebook Pages). */
  accessToken?: string;
  metadata?: Record<string, unknown>;
}

export interface PlatformCredentials {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  accountMetadata?: Record<string, unknown>;
}

export interface MediaRef {
  url: string;
  mimeType: string;
  order: number;
}

export interface PublishablePostTarget {
  postTargetId: string;
  externalAccountId: string;
  content: string;
  media: MediaRef[];
  platformSpecific?: Record<string, unknown>;
}

export type PublishErrorKind = "transient" | "permanent";

export interface PublishResult {
  success: boolean;
  /** Platform-side asynchronous publish/upload task identifier. Not a public post ID. */
  externalPublishId?: string;
  externalPostId?: string;
  errorKind?: PublishErrorKind;
  errorCode?: string;
  errorMessage?: string;
}

/** Minimal per-request tenant scope. Every DB query must be filtered by organizationId. */
export interface TenantContext {
  organizationId: string;
  userId: string;
}
