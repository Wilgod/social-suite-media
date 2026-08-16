import type { AccountIdentity, ContentItem, DailyStat, NormalizedTokenResult, PlatformAdapter } from "@social-suite/core";

const AUTHORIZE_URL = "https://api.instagram.com/oauth/authorize";
const TOKEN_URL = "https://api.instagram.com/oauth/access_token";
const GRAPH_BASE = "https://graph.instagram.com";

function redirectUri(): string {
  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  return `${base}/api/connections/instagram/callback`;
}

interface GraphErrorResponse {
  error?: { message: string; type?: string; code?: number };
  error_message?: string;
}

async function graphGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${GRAPH_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const res = await fetch(url);
  const data = (await res.json()) as T & GraphErrorResponse;
  if (!res.ok || data.error) {
    throw new Error(data.error?.message ?? data.error_message ?? `Instagram API request failed (${res.status})`);
  }
  return data;
}

async function graphPost<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${GRAPH_BASE}${path}`);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  const data = (await res.json()) as T & GraphErrorResponse;
  if (!res.ok || data.error) {
    throw new Error(data.error?.message ?? data.error_message ?? `Instagram API request failed (${res.status})`);
  }
  return data;
}

async function getIgUserId(accessToken: string): Promise<string> {
  const profile = await graphGet<{ user_id: string }>("/me", { fields: "user_id", access_token: accessToken });
  return profile.user_id;
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function waitForContainerReady(containerId: string, accessToken: string, timeoutMs = 60000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const status = await graphGet<{ status_code: string }>(`/${containerId}`, {
      fields: "status_code",
      access_token: accessToken,
    });
    if (status.status_code === "FINISHED") return true;
    if (status.status_code === "ERROR" || status.status_code === "EXPIRED") return false;
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  return false;
}

export const instagramAdapter: PlatformAdapter = {
  platform: "instagram",

  getAuthorizationUrl(state, scopes, appCredentials) {
    const url = new URL(AUTHORIZE_URL);
    url.searchParams.set("client_id", appCredentials.clientId);
    url.searchParams.set("redirect_uri", redirectUri());
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", scopes.join(","));
    url.searchParams.set("state", state);
    return url.toString();
  },

  async exchangeCodeForTokens(code, appCredentials) {
    // Instagram's short-lived token exchange specifically expects multipart/form-data.
    const form = new FormData();
    form.set("client_id", appCredentials.clientId);
    form.set("client_secret", appCredentials.clientSecret);
    form.set("grant_type", "authorization_code");
    form.set("redirect_uri", redirectUri());
    form.set("code", code);

    const shortLivedRes = await fetch(TOKEN_URL, { method: "POST", body: form });
    const shortLivedData = (await shortLivedRes.json()) as
      | { access_token: string; user_id: string }
      | GraphErrorResponse;

    if (!shortLivedRes.ok || !("access_token" in shortLivedData)) {
      const message = "error" in shortLivedData ? (shortLivedData.error?.message ?? shortLivedData.error_message) : undefined;
      throw new Error(message ?? `Instagram token exchange failed (${shortLivedRes.status})`);
    }
    const shortLived = shortLivedData;

    const longLived = await graphGet<{ access_token: string; expires_in: number }>("/access_token", {
      grant_type: "ig_exchange_token",
      client_secret: appCredentials.clientSecret,
      access_token: shortLived.access_token,
    });

    return {
      accessToken: longLived.access_token,
      refreshToken: longLived.access_token, // Instagram has no distinct refresh token — see refreshAccessToken.
      expiresAt: new Date(Date.now() + longLived.expires_in * 1000),
      scopes: [],
    } satisfies NormalizedTokenResult;
  },

  async refreshAccessToken(refreshToken) {
    // Extends an existing long-lived token — must be >24h old and not yet expired.
    const refreshed = await graphGet<{ access_token: string; expires_in: number }>("/refresh_access_token", {
      grant_type: "ig_refresh_token",
      access_token: refreshToken,
    });

    return {
      accessToken: refreshed.access_token,
      refreshToken: refreshed.access_token,
      expiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
      scopes: [],
    } satisfies NormalizedTokenResult;
  },

  async fetchAccountIdentity(accessToken) {
    const profile = await graphGet<{ user_id: string; username: string; account_type?: string }>("/me", {
      fields: "user_id,username,account_type",
      access_token: accessToken,
    });

    return {
      externalId: profile.user_id,
      displayName: `@${profile.username}`,
    } satisfies AccountIdentity;
  },

  async publish(target, credentials) {
    const asset = target.media[0];
    if (!asset) {
      return {
        success: false,
        errorKind: "permanent",
        errorCode: "no_media",
        errorMessage: "Instagram posts require an image or video.",
      };
    }

    const isVideo = asset.mimeType.startsWith("video/");

    try {
      const containerParams: Record<string, string> = {
        caption: target.content,
        access_token: credentials.accessToken,
      };
      if (isVideo) {
        containerParams.media_type = "REELS";
        containerParams.video_url = asset.url;
      } else {
        containerParams.image_url = asset.url;
      }

      const container = await graphPost<{ id: string }>(`/${target.externalAccountId}/media`, containerParams);

      if (isVideo) {
        const ready = await waitForContainerReady(container.id, credentials.accessToken);
        if (!ready) {
          return {
            success: false,
            errorKind: "transient",
            errorCode: "container_timeout",
            errorMessage: "Instagram video processing timed out or failed.",
          };
        }
      }

      const published = await graphPost<{ id: string }>(`/${target.externalAccountId}/media_publish`, {
        creation_id: container.id,
        access_token: credentials.accessToken,
      });

      return { success: true, externalPostId: published.id };
    } catch (err) {
      return {
        success: false,
        errorKind: "transient",
        errorCode: "publish_failed",
        errorMessage: err instanceof Error ? err.message : "Unknown error",
      };
    }
  },

  /**
   * Instagram's Insights API only supports true daily time-series data for "reach" — every other
   * account-level metric (engagement, follower count, etc.) is total-value-only over a date range,
   * not a daily breakdown. So this maps reach → views and leaves the rest at 0 rather than guessing.
   */
  async fetchDailyStats(accessToken, since) {
    const igUserId = await getIgUserId(accessToken);

    const data = await graphGet<{
      data?: Array<{ name: string; values: Array<{ value: number; end_time: string }> }>;
    }>(`/${igUserId}/insights`, {
      metric: "reach",
      metric_type: "time_series",
      period: "day",
      since: toDateString(since),
      until: toDateString(new Date()),
      access_token: accessToken,
    });

    const reachSeries = data.data?.find((m) => m.name === "reach")?.values ?? [];

    return reachSeries.map(
      (point) =>
        ({
          date: point.end_time.slice(0, 10),
          views: point.value,
          likes: 0,
          comments: 0,
          subscribersGained: 0,
          subscribersLost: 0,
          estimatedMinutesWatched: 0,
        }) satisfies DailyStat,
    );
  },

  async listContent(accessToken, limit = 25) {
    const igUserId = await getIgUserId(accessToken);

    const media = await graphGet<{
      data?: Array<{
        id: string;
        caption?: string;
        media_type: string;
        media_product_type?: string;
        media_url?: string;
        thumbnail_url?: string;
        permalink: string;
        timestamp: string;
        like_count?: number;
        comments_count?: number;
      }>;
    }>(`/${igUserId}/media`, {
      fields:
        "id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count",
      limit: String(Math.min(limit, 50)),
      access_token: accessToken,
    });

    return (media.data ?? []).map((item) => {
      const [firstLine] = (item.caption ?? "").split("\n");
      return {
        externalId: item.id,
        title: firstLine || "Untitled",
        thumbnailUrl: item.thumbnail_url ?? item.media_url,
        publishedAt: item.timestamp,
        url: item.permalink,
        likes: item.like_count,
        comments: item.comments_count,
        isShortForm: item.media_product_type === "REELS",
      } satisfies ContentItem;
    });
  },
};
