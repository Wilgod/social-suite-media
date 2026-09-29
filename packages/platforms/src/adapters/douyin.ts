import type {
  AccountIdentity,
  NormalizedTokenResult,
  PlatformAdapter,
  PostComment,
  PostMetrics,
  PublishResult,
} from "@social-suite/core";

const AUTHORIZE_URL = "https://open.douyin.com/platform/oauth/connect";
const TOKEN_URL = "https://open.douyin.com/oauth/access_token/";
const REFRESH_URL = "https://open.douyin.com/oauth/refresh_token/";
const USER_URL = "https://open.douyin.com/oauth/userinfo/";

function redirectUri(): string {
  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  return `${base}/api/connections/douyin/callback`;
}

interface DouyinEnvelope<T> {
  message?: string;
  data?: T & { error_code?: number; description?: string };
}

async function douyinPost<T>(url: string, body: Record<string, string>): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await res.json()) as DouyinEnvelope<T>;
  const data = payload.data;
  if (!res.ok || !data || (data.error_code !== undefined && data.error_code !== 0)) {
    throw new Error(data?.description ?? payload.message ?? `Douyin API request failed (${res.status})`);
  }
  return data as T;
}

function toTokens(data: {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  open_id?: string;
}): NormalizedTokenResult {
  if (!data.access_token) throw new Error("Douyin token response missing access_token");
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
    scopes: String(data.scope ?? "").split(",").filter(Boolean),
    accountId: data.open_id,
  };
}

export const douyinAdapter: PlatformAdapter = {
  platform: "douyin",

  getAuthorizationUrl(state, scopes, appCredentials) {
    const url = new URL(AUTHORIZE_URL);
    url.searchParams.set("client_key", appCredentials.clientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", scopes.join(","));
    url.searchParams.set("redirect_uri", redirectUri());
    url.searchParams.set("state", state);
    return url.toString();
  },

  async exchangeCodeForTokens(code, appCredentials) {
    const data = await douyinPost<{
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
      open_id?: string;
    }>(TOKEN_URL, {
      client_key: appCredentials.clientId,
      client_secret: appCredentials.clientSecret,
      code,
      grant_type: "authorization_code",
    });
    return toTokens(data);
  },

  async refreshAccessToken(refreshToken, appCredentials) {
    const data = await douyinPost<{
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
      open_id?: string;
    }>(REFRESH_URL, {
      client_key: appCredentials.clientId,
      client_secret: appCredentials.clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });
    return toTokens(data);
  },

  async fetchAccountIdentity(accessToken): Promise<AccountIdentity> {
    const target = new URL(USER_URL);
    target.searchParams.set("access_token", accessToken);
    const res = await fetch(target);
    const payload = (await res.json()) as DouyinEnvelope<{
      open_id?: string;
      nickname?: string;
      avatar?: string;
      error_code?: number;
      description?: string;
    }>;
    const data = payload.data;
    if (!res.ok || !data?.open_id || (data.error_code !== undefined && data.error_code !== 0)) {
      throw new Error(data?.description ?? payload.message ?? "Failed to load Douyin account");
    }
    return {
      externalId: data.open_id,
      displayName: data.nickname ?? data.open_id,
      avatarUrl: data.avatar,
    };
  },

  async publish(): Promise<PublishResult> {
    return {
      success: false,
      errorKind: "permanent",
      errorCode: "capability_required",
      errorMessage:
        "Douyin server-side publish requires the approved video.create.bind capability. Until then, connect the account and use confirmed/share publishing.",
    };
  },

  async fetchPostMetrics(): Promise<PostMetrics> {
    return { views: 0, likes: 0, comments: 0, shares: 0, favorites: 0 };
  },

  async fetchComments(): Promise<PostComment[]> {
    return [];
  },
};
