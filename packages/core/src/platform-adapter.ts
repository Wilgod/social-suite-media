import type {
  AccountIdentity,
  ContentFormatStat,
  ContentItem,
  DailyStat,
  NormalizedTokenResult,
  Platform,
  PlatformAppCredentials,
  PlatformCredentials,
  PublishablePostTarget,
  PublishResult,
} from "./types";

/**
 * One implementation per platform (youtube/facebook/instagram/threads/x).
 * The OAuth connect/callback routes, token refresh scheduler, and publish worker
 * are all written once against this interface.
 *
 * Each organization registers its own OAuth app (see PlatformAppCredential), so the
 * client id/secret are passed in per call rather than baked into the adapter instance.
 */
export interface PlatformAdapter {
  readonly platform: Platform;

  getAuthorizationUrl(state: string, scopes: string[], appCredentials: PlatformAppCredentials): string;

  exchangeCodeForTokens(
    code: string,
    appCredentials: PlatformAppCredentials,
    pkceVerifier?: string,
  ): Promise<NormalizedTokenResult>;

  refreshAccessToken(refreshToken: string, appCredentials: PlatformAppCredentials): Promise<NormalizedTokenResult>;

  fetchAccountIdentity(accessToken: string): Promise<AccountIdentity | AccountIdentity[]>;

  publish(target: PublishablePostTarget, credentials: PlatformCredentials): Promise<PublishResult>;

  /** Not every platform/adapter supports historical performance stats yet. */
  fetchDailyStats?(accessToken: string, since: Date): Promise<DailyStat[]>;

  /** Not every platform/adapter supports listing already-published content yet. */
  listContent?(accessToken: string, limit?: number): Promise<ContentItem[]>;

  /** Not every platform/adapter can break performance down by content format (e.g. Shorts vs regular videos) yet. */
  fetchContentFormatBreakdown?(accessToken: string, since: Date): Promise<ContentFormatStat[]>;
}
