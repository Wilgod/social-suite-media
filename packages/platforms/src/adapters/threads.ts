import type { AccountIdentity, NormalizedTokenResult, PlatformAdapter, PublishResult } from "@social-suite/core";

const API_VERSION = "v21.0";
const GRAPH = `https://graph.threads.net/${API_VERSION}`;
const AUTHORIZE_URL = "https://threads.net/oauth/authorize";
const TOKEN_URL = "https://graph.threads.net/oauth/access_token";

function redirectUri(): string {
  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  return `${base}/api/connections/threads/callback`;
}

type ThreadsError = { error?: { message?: string; code?: number }; error_message?: string };

async function readJson<T>(res: Response, operation: string): Promise<T> {
  const data = (await res.json()) as T & ThreadsError;
  if (!res.ok || data.error) {
    throw new Error(data.error?.message ?? data.error_message ?? `${operation} failed (${res.status})`);
  }
  return data;
}

async function graphGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${GRAPH}${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return readJson<T>(await fetch(url), "Threads API request");
}

async function graphPost<T>(path: string, params: Record<string, string>): Promise<T> {
  return readJson<T>(
    await fetch(`${GRAPH}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params),
    }),
    "Threads API request",
  );
}

async function waitForContainer(containerId: string, accessToken: string, timeoutMs = 120_000): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const result = await graphGet<{ status?: string; error_message?: string }>(`/${containerId}`, {
      fields: "status,error_message",
      access_token: accessToken,
    });
    if (result.status === "FINISHED") return;
    if (result.status === "ERROR" || result.status === "EXPIRED") {
      throw new Error(result.error_message ?? `Threads media container ${result.status.toLowerCase()}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 3_000));
  }
  throw new Error("Threads media processing timed out");
}

function tokenResult(data: { access_token: string; expires_in?: number }): NormalizedTokenResult {
  return {
    accessToken: data.access_token,
    // Threads refreshes the long-lived access token itself rather than issuing a separate refresh token.
    refreshToken: data.access_token,
    expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
    scopes: [],
  };
}

export const threadsAdapter: PlatformAdapter = {
  platform: "threads",

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
    const shortLived = await readJson<{ access_token: string; user_id?: string }>(
      await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: appCredentials.clientId,
          client_secret: appCredentials.clientSecret,
          grant_type: "authorization_code",
          redirect_uri: redirectUri(),
          code,
        }),
      }),
      "Threads token exchange",
    );

    const longLived = await graphGet<{ access_token: string; expires_in?: number }>("/access_token", {
      grant_type: "th_exchange_token",
      client_secret: appCredentials.clientSecret,
      access_token: shortLived.access_token,
    });
    return { ...tokenResult(longLived), accountId: shortLived.user_id };
  },

  async refreshAccessToken(refreshToken) {
    const refreshed = await graphGet<{ access_token: string; expires_in?: number }>("/refresh_access_token", {
      grant_type: "th_refresh_token",
      access_token: refreshToken,
    });
    return tokenResult(refreshed);
  },

  async fetchAccountIdentity(accessToken) {
    const profile = await graphGet<{
      id: string;
      username?: string;
      name?: string;
      threads_profile_picture_url?: string;
    }>("/me", {
      fields: "id,username,name,threads_profile_picture_url",
      access_token: accessToken,
    });
    return {
      externalId: profile.id,
      displayName: profile.username ? `@${profile.username}` : (profile.name ?? profile.id),
      avatarUrl: profile.threads_profile_picture_url,
    } satisfies AccountIdentity;
  },

  async publish(target, credentials): Promise<PublishResult> {
    if (target.media.length > 1) {
      return { success: false, errorKind: "permanent", errorCode: "unsupported_media_count", errorMessage: "Threads publishing currently supports one image or video per post." };
    }
    if (target.media[0] && !/^video\/|^image\//.test(target.media[0].mimeType)) {
      return { success: false, errorKind: "permanent", errorCode: "unsupported_media", errorMessage: "Threads posts support an image or video." };
    }
    if (!target.media.length && !target.content.trim()) {
      return { success: false, errorKind: "permanent", errorCode: "empty_post", errorMessage: "Threads posts require text or media." };
    }
    try {
      const media = target.media[0];
      const params: Record<string, string> = {
        media_type: media ? (media.mimeType.startsWith("video/") ? "VIDEO" : "IMAGE") : "TEXT",
        text: target.content,
        access_token: credentials.accessToken,
      };
      if (media?.mimeType.startsWith("video/")) params.video_url = media.url;
      else if (media) params.image_url = media.url;

      const container = await graphPost<{ id: string }>(`/${target.externalAccountId}/threads`, params);
      if (media?.mimeType.startsWith("video/")) {
        await waitForContainer(container.id, credentials.accessToken);
      }
      const published = await graphPost<{ id: string }>(`/${target.externalAccountId}/threads_publish`, {
        creation_id: container.id,
        access_token: credentials.accessToken,
      });
      return { success: true, externalPostId: published.id };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Threads publish failed";
      const transient = /temporar|timeout|rate limit|try again|network|fetch failed/i.test(message);
      return {
        success: false,
        errorKind: transient ? "transient" : "permanent",
        errorCode: "publish_failed",
        errorMessage: message,
      };
    }
  },
};
