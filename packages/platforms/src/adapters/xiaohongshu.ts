import { createHash } from "node:crypto";
import type {
  AccountIdentity,
  NormalizedTokenResult,
  PlatformAdapter,
  PostComment,
  PostMetrics,
  PublishResult,
} from "@social-suite/core";

const AUTHORIZE_URL = "https://ark.xiaohongshu.com/ark/authorization";
const API_URL = "https://ark.xiaohongshu.com/ark/open_api/v3/common_controller";
const GATEWAY_VERSION = "2.0";

function redirectUri(): string {
  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  return `${base}/api/connections/xiaohongshu/callback`;
}

function signRequest(method: string, appId: string, appSecret: string, timestamp: string): string {
  const query = [`appId=${appId}`, `timestamp=${timestamp}`, `version=${GATEWAY_VERSION}`].sort().join("&");
  return createHash("md5").update(`${method}?${query}${appSecret}`).digest("hex");
}

interface ArkEnvelope<T> {
  success?: boolean;
  error_code?: number;
  error_msg?: string;
  data?: T;
}

async function arkCall<T>(
  method: string,
  appCredentials: { clientId: string; clientSecret: string },
  extra: Record<string, unknown> = {},
): Promise<T> {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const body = {
    appId: appCredentials.clientId,
    timestamp,
    version: GATEWAY_VERSION,
    method,
    sign: signRequest(method, appCredentials.clientId, appCredentials.clientSecret, timestamp),
    ...extra,
  };
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await res.json()) as ArkEnvelope<T>;
  if (!res.ok || payload.success === false || (payload.error_code !== undefined && payload.error_code !== 0) || !payload.data) {
    throw new Error(payload.error_msg ?? `Xiaohongshu API request failed (${res.status})`);
  }
  return payload.data;
}

function toTokens(data: {
  accessToken?: string;
  accessTokenExpiresAt?: number;
  refreshToken?: string;
  sellerId?: string | number;
  sellerName?: string;
}): NormalizedTokenResult {
  if (!data.accessToken) throw new Error("Xiaohongshu token response missing accessToken");
  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    expiresAt: data.accessTokenExpiresAt ? new Date(data.accessTokenExpiresAt) : undefined,
    scopes: [],
    accountId: data.sellerId !== undefined ? String(data.sellerId) : undefined,
    accountName: data.sellerName,
  };
}

export const xiaohongshuAdapter: PlatformAdapter = {
  platform: "xiaohongshu",

  getAuthorizationUrl(state, _scopes, appCredentials) {
    const url = new URL(AUTHORIZE_URL);
    url.searchParams.set("appId", appCredentials.clientId);
    url.searchParams.set("redirectUri", redirectUri());
    url.searchParams.set("state", state);
    return url.toString();
  },

  async exchangeCodeForTokens(code, appCredentials) {
    const data = await arkCall<{
      accessToken?: string;
      accessTokenExpiresAt?: number;
      refreshToken?: string;
      sellerId?: string | number;
      sellerName?: string;
    }>("oauth.getAccessToken", appCredentials, { code });
    return toTokens(data);
  },

  async refreshAccessToken(refreshToken, appCredentials) {
    const data = await arkCall<{
      accessToken?: string;
      accessTokenExpiresAt?: number;
      refreshToken?: string;
      sellerId?: string | number;
      sellerName?: string;
    }>("oauth.refreshToken", appCredentials, { refreshToken });
    return toTokens(data);
  },

  async fetchAccountIdentity(): Promise<AccountIdentity> {
    throw new Error("Xiaohongshu account identity is returned with the OAuth token (sellerId)");
  },

  async publish(): Promise<PublishResult> {
    return {
      success: false,
      errorKind: "permanent",
      errorCode: "capability_required",
      errorMessage:
        "Xiaohongshu server-side note publish requires approved content capabilities on the open platform. Until then, connect the account only; mini-app xhs.postNote is in-app share, not silent publish.",
    };
  },

  async fetchPostMetrics(): Promise<PostMetrics> {
    return { views: 0, likes: 0, comments: 0, shares: 0, favorites: 0 };
  },

  async fetchComments(): Promise<PostComment[]> {
    return [];
  },
};
