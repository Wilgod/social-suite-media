import type {
  AccountIdentity,
  NormalizedTokenResult,
  PlatformAdapter,
  PostComment,
  PostMetrics,
  PublishResult,
} from "@social-suite/core";

const AUTHORIZE_URL = "https://account.bilibili.com/pc/account-pc/auth/oauth";
const TOKEN_URL = "https://api.bilibili.com/x/account-oauth2/v1/token";
const USER_URL = "https://api.bilibili.com/x/account-oauth2/v1/user/info";
const ARCHIVE_ADD_URL = "https://member.bilibili.com/arcopen/fn/archive/add-simple";

function redirectUri(): string {
  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  return `${base}/api/connections/bilibili/callback`;
}

interface BiliEnvelope<T> {
  code?: number;
  message?: string;
  data?: T;
}

async function biliPost<T>(url: string, body: Record<string, string>): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  const data = (await res.json()) as BiliEnvelope<T>;
  if (!res.ok || (data.code !== undefined && data.code !== 0) || !data.data) {
    throw new Error(data.message ?? `Bilibili API request failed (${res.status})`);
  }
  return data.data;
}

async function biliGet<T>(url: string, accessToken: string): Promise<T> {
  const target = new URL(url);
  target.searchParams.set("access_token", accessToken);
  const res = await fetch(target, { headers: { "Access-Token": accessToken } });
  const data = (await res.json()) as BiliEnvelope<T>;
  if (!res.ok || (data.code !== undefined && data.code !== 0) || !data.data) {
    throw new Error(data.message ?? `Bilibili API request failed (${res.status})`);
  }
  return data.data;
}

function toTokens(data: {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scopes?: string[] | string;
  openid?: string;
  name?: string;
}): NormalizedTokenResult {
  if (!data.access_token) throw new Error("Bilibili token response missing access_token");
  const scopes = Array.isArray(data.scopes) ? data.scopes : String(data.scopes ?? "").split(",").filter(Boolean);
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
    scopes,
    accountId: data.openid,
    accountName: data.name,
  };
}

export const bilibiliAdapter: PlatformAdapter = {
  platform: "bilibili",

  getAuthorizationUrl(state, scopes, appCredentials) {
    const url = new URL(AUTHORIZE_URL);
    url.searchParams.set("client_id", appCredentials.clientId);
    url.searchParams.set("return_url", redirectUri());
    url.searchParams.set("response_type", "code");
    url.searchParams.set("state", state);
    if (scopes.length > 0) url.searchParams.set("scope", scopes.join(","));
    return url.toString();
  },

  async exchangeCodeForTokens(code, appCredentials) {
    const data = await biliPost<{
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      scopes?: string[] | string;
      openid?: string;
      name?: string;
    }>(TOKEN_URL, {
      client_id: appCredentials.clientId,
      client_secret: appCredentials.clientSecret,
      grant_type: "authorization_code",
      code,
    });
    return toTokens(data);
  },

  async refreshAccessToken(refreshToken, appCredentials) {
    const data = await biliPost<{
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      scopes?: string[] | string;
      openid?: string;
      name?: string;
    }>(TOKEN_URL, {
      client_id: appCredentials.clientId,
      client_secret: appCredentials.clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });
    return toTokens(data);
  },

  async fetchAccountIdentity(accessToken): Promise<AccountIdentity> {
    try {
      const user = await biliGet<{ openid?: string; name?: string; face?: string; mid?: number }>(USER_URL, accessToken);
      const externalId = user.openid ?? (user.mid !== undefined ? String(user.mid) : undefined);
      if (!externalId) throw new Error("Bilibili user info missing account id");
      return {
        externalId,
        displayName: user.name ?? externalId,
        avatarUrl: user.face,
        metadata: { mid: user.mid, openid: user.openid },
      };
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : "Failed to load Bilibili account");
    }
  },

  async publish(): Promise<PublishResult> {
    return {
      success: false,
      errorKind: "permanent",
      errorCode: "upload_pipeline_pending",
      errorMessage: `Bilibili native publish needs the chunked upload pipeline (${ARCHIVE_ADD_URL}). Connect the account first; video submit lands in a follow-up change.`,
    };
  },

  async fetchPostMetrics(): Promise<PostMetrics> {
    return { views: 0, likes: 0, comments: 0, shares: 0, favorites: 0, coins: 0 };
  },

  async fetchComments(): Promise<PostComment[]> {
    return [];
  },
};
