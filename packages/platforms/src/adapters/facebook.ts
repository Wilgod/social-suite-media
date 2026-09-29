import type {
  AccountIdentity,
  NormalizedTokenResult,
  PlatformAdapter,
  PlatformCredentials,
  PostComment,
  PostMetrics,
  PublishablePostTarget,
  PublishResult,
} from "@social-suite/core";

const GRAPH_VERSION = "v21.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;
const AUTH_URL = `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`;

function redirectUri(): string {
  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  return `${base}/api/connections/facebook/callback`;
}

function pageToken(credentials: PlatformCredentials): string {
  // New connections store the Page token only in the encrypted credential.
  // Support previously connected Pages whose metadata still contains it.
  const legacy = credentials.accountMetadata?.pageAccessToken;
  return typeof legacy === "string" && legacy.length > 0 ? legacy : credentials.accessToken;
}

async function graphGet<T>(path: string, accessToken: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${GRAPH}${path}`);
  url.searchParams.set("access_token", accessToken);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const res = await fetch(url);
  const data = (await res.json()) as T & { error?: { message: string; code?: number; type?: string } };
  if (!res.ok || data.error) {
    throw new Error(data.error?.message ?? `Facebook API request failed (${res.status})`);
  }
  return data;
}

async function graphPost<T>(path: string, accessToken: string, body: Record<string, string>): Promise<T> {
  const res = await fetch(`${GRAPH}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...body, access_token: accessToken }),
  });
  const data = (await res.json()) as T & { error?: { message: string } };
  if (!res.ok || data.error) {
    throw new Error(data.error?.message ?? `Facebook API request failed (${res.status})`);
  }
  return data;
}

async function exchangeToken(params: Record<string, string>): Promise<NormalizedTokenResult> {
  const url = new URL(`${GRAPH}/oauth/access_token`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const res = await fetch(url);
  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: { message: string };
  };
  if (!res.ok || !data.access_token) {
    throw new Error(data.error?.message ?? `Facebook token request failed (${res.status})`);
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.access_token,
    expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
    scopes: [],
  };
}

export const facebookAdapter: PlatformAdapter = {
  platform: "facebook",

  getAuthorizationUrl(state, scopes, appCredentials) {
    const url = new URL(AUTH_URL);
    url.searchParams.set("client_id", appCredentials.clientId);
    url.searchParams.set("redirect_uri", redirectUri());
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", scopes.join(","));
    url.searchParams.set("state", state);
    return url.toString();
  },

  async exchangeCodeForTokens(code, appCredentials) {
    const shortLived = await exchangeToken({
      client_id: appCredentials.clientId,
      client_secret: appCredentials.clientSecret,
      redirect_uri: redirectUri(),
      code,
    });
    return exchangeToken({
      grant_type: "fb_exchange_token",
      client_id: appCredentials.clientId,
      client_secret: appCredentials.clientSecret,
      fb_exchange_token: shortLived.accessToken,
    });
  },

  async refreshAccessToken(refreshToken, appCredentials) {
    return exchangeToken({
      grant_type: "fb_exchange_token",
      client_id: appCredentials.clientId,
      client_secret: appCredentials.clientSecret,
      fb_exchange_token: refreshToken,
    });
  },

  async fetchAccountIdentity(accessToken) {
    const data = await graphGet<{
      data?: Array<{
        id: string;
        name: string;
        access_token?: string;
        picture?: { data?: { url?: string } };
      }>;
    }>("/me/accounts", accessToken, { fields: "id,name,access_token,picture{url}" });

    const pages = data.data ?? [];
    if (pages.length === 0) {
      throw new Error("No Facebook Pages available. Video publishing requires a Page, not a personal profile.");
    }
    if (pages.some((page) => !page.access_token)) {
      throw new Error("Facebook did not grant a Page access token. Check Page admin access and pages_show_list/pages_manage_posts permissions.");
    }

    return pages.map(
      (page) =>
        ({
          externalId: page.id,
          displayName: page.name,
          avatarUrl: page.picture?.data?.url,
          accessToken: page.access_token,
          metadata: { pageId: page.id },
        }) satisfies AccountIdentity,
    );
  },

  async publish(target, credentials): Promise<PublishResult> {
    if (target.media.length > 1) {
      return {
        success: false,
        errorKind: "permanent",
        errorCode: "unsupported_media_count",
        errorMessage: "Facebook publishing currently supports one media file per post.",
      };
    }

    const media = target.media[0];
    if (media && !/^video\/|^image\//.test(media.mimeType)) {
      return { success: false, errorKind: "permanent", errorCode: "unsupported_media", errorMessage: "Facebook posts support an image or video." };
    }
    if (!media && !target.content.trim()) {
      return { success: false, errorKind: "permanent", errorCode: "empty_post", errorMessage: "Facebook posts require text or media." };
    }

    try {
      const published = media?.mimeType.startsWith("video/")
        ? await graphPost<{ id: string }>(`/${target.externalAccountId}/videos`, pageToken(credentials), {
            file_url: media.url, description: target.content, published: "true",
          })
        : media
          ? await graphPost<{ id: string; post_id?: string }>(`/${target.externalAccountId}/photos`, pageToken(credentials), {
              url: media.url, caption: target.content, published: "true",
            })
          : await graphPost<{ id: string }>(`/${target.externalAccountId}/feed`, pageToken(credentials), {
              message: target.content,
            });
      return { success: true, externalPostId: published.id };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Facebook publish failed";
      const transient = /try again|temporarily|rate limit|timeout/i.test(message);
      return {
        success: false,
        errorKind: transient ? "transient" : "permanent",
        errorCode: "publish_failed",
        errorMessage: message,
      };
    }
  },

  async fetchPostMetrics(externalPostId, credentials): Promise<PostMetrics> {
    const token = pageToken(credentials);
    const post = await graphGet<{
      comments?: { summary?: { total_count?: number } };
      reactions?: { summary?: { total_count?: number } };
      shares?: { count?: number };
    }>(`/${externalPostId}`, token, {
      fields: "comments.summary(true),reactions.summary(true),shares",
    });

    let views = 0;
    try {
      const insights = await graphGet<{ data?: Array<{ name: string; values?: Array<{ value?: number }> }> }>(
        `/${externalPostId}/video_insights`,
        token,
        { metric: "total_video_views,post_video_views" },
      );
      for (const row of insights.data ?? []) {
        const value = Number(row.values?.[0]?.value ?? 0);
        if (value > views) views = value;
      }
    } catch {
      views = 0;
    }

    return {
      views,
      likes: Number(post.reactions?.summary?.total_count ?? 0),
      comments: Number(post.comments?.summary?.total_count ?? 0),
      shares: Number(post.shares?.count ?? 0),
      favorites: 0,
    };
  },

  async fetchComments(externalPostId, credentials): Promise<PostComment[]> {
    const data = await graphGet<{
      data?: Array<{
        id: string;
        message?: string;
        created_time?: string;
        like_count?: number;
        from?: { id?: string; name?: string };
        parent?: { id?: string };
      }>;
    }>(`/${externalPostId}/comments`, pageToken(credentials), {
      fields: "id,message,created_time,like_count,from,parent",
      filter: "stream",
      limit: "50",
    });

    return (data.data ?? []).map((comment) => ({
      externalId: comment.id,
      parentExternalId: comment.parent?.id,
      authorExternalId: comment.from?.id,
      authorName: comment.from?.name ?? "Facebook user",
      body: comment.message ?? "",
      likeCount: comment.like_count,
      publishedAt: comment.created_time ? new Date(comment.created_time) : undefined,
    }));
  },
};
