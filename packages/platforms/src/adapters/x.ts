import { createHash } from "node:crypto";
import type { AccountIdentity, NormalizedTokenResult, PlatformAdapter, PublishResult } from "@social-suite/core";

const AUTHORIZE_URL = "https://twitter.com/i/oauth2/authorize";
const TOKEN_URL = "https://api.x.com/2/oauth2/token";
const API = "https://api.x.com/2";

function redirectUri(): string {
  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  return `${base}/api/connections/x/callback`;
}

type XError = {
  title?: string;
  detail?: string;
  error?: string;
  error_description?: string;
  errors?: Array<{ message?: string }>;
};

async function readJson<T>(res: Response, operation: string): Promise<T> {
  const data = (await res.json()) as T & XError;
  if (!res.ok) {
    throw new Error(
      data.detail ?? data.error_description ?? data.errors?.[0]?.message ?? data.title ?? data.error ?? `${operation} failed (${res.status})`,
    );
  }
  return data;
}

function basicAuth(clientId: string, clientSecret: string): string {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

async function requestToken(
  params: Record<string, string>,
  appCredentials: { clientId: string; clientSecret: string },
): Promise<NormalizedTokenResult> {
  const data = await readJson<{
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  }>(
    await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: basicAuth(appCredentials.clientId, appCredentials.clientSecret),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(params),
    }),
    "X token request",
  );
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
    scopes: data.scope?.split(" ").filter(Boolean) ?? [],
  };
}

export const xAdapter: PlatformAdapter = {
  platform: "x",

  getAuthorizationUrl(state, scopes, appCredentials, pkceVerifier) {
    if (!pkceVerifier) throw new Error("X OAuth requires a PKCE verifier");
    const challenge = createHash("sha256").update(pkceVerifier).digest("base64url");
    const url = new URL(AUTHORIZE_URL);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", appCredentials.clientId);
    url.searchParams.set("redirect_uri", redirectUri());
    url.searchParams.set("scope", scopes.join(" "));
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", challenge);
    url.searchParams.set("code_challenge_method", "S256");
    return url.toString();
  },

  async exchangeCodeForTokens(code, appCredentials, pkceVerifier) {
    if (!pkceVerifier) throw new Error("Missing X OAuth PKCE verifier");
    return requestToken(
      {
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri(),
        code_verifier: pkceVerifier,
      },
      appCredentials,
    );
  },

  async refreshAccessToken(refreshToken, appCredentials) {
    return requestToken({ grant_type: "refresh_token", refresh_token: refreshToken }, appCredentials);
  },

  async fetchAccountIdentity(accessToken) {
    const url = new URL(`${API}/users/me`);
    url.searchParams.set("user.fields", "id,name,username,profile_image_url");
    const profile = await readJson<{
      data: { id: string; name: string; username: string; profile_image_url?: string };
    }>(await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } }), "X profile request");
    return {
      externalId: profile.data.id,
      displayName: `@${profile.data.username}`,
      avatarUrl: profile.data.profile_image_url,
      metadata: { name: profile.data.name, username: profile.data.username },
    } satisfies AccountIdentity;
  },

  async publish(target, credentials): Promise<PublishResult> {
    if (target.media.length > 0) {
      return {
        success: false,
        errorKind: "permanent",
        errorCode: "media_upload_not_configured",
        errorMessage: "X media upload requires separate paid media-upload access. Publish this target without media or enable that access first.",
      };
    }
    if (!target.content.trim()) {
      return {
        success: false,
        errorKind: "permanent",
        errorCode: "empty_post",
        errorMessage: "X posts require text when no media is attached.",
      };
    }

    try {
      const result = await readJson<{ data: { id: string; text: string } }>(
        await fetch(`${API}/tweets`, {
          method: "POST",
          headers: { Authorization: `Bearer ${credentials.accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ text: target.content }),
        }),
        "X post creation",
      );
      return { success: true, externalPostId: result.data.id };
    } catch (err) {
      const message = err instanceof Error ? err.message : "X publish failed";
      const transient = /temporar|timeout|rate limit|try again|network|fetch failed|too many requests/i.test(message);
      return {
        success: false,
        errorKind: transient ? "transient" : "permanent",
        errorCode: "publish_failed",
        errorMessage: message,
      };
    }
  },
};
