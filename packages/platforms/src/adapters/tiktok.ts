import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import type {
  AccountIdentity,
  ContentItem,
  DailyStat,
  NormalizedTokenResult,
  PlatformAdapter,
  PlatformAppCredentials,
  PostComment,
  PostMetrics,
  PublishablePostTarget,
  PublishResult,
} from "@social-suite/core";

const AUTHORIZE_URL = "https://www.tiktok.com/v2/auth/authorize/";
const TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const USER_URL = "https://open.tiktokapis.com/v2/user/info/";
const VIDEO_LIST_URL = "https://open.tiktokapis.com/v2/video/list/";
const VIDEO_QUERY_URL = "https://open.tiktokapis.com/v2/video/query/";
const PUBLISH_INIT_URL = "https://open.tiktokapis.com/v2/post/publish/video/init/";
const PUBLISH_STATUS_URL = "https://open.tiktokapis.com/v2/post/publish/status/fetch/";
const CREATOR_INFO_URL = "https://open.tiktokapis.com/v2/post/publish/creator_info/query/";
const VIDEO_FIELDS =
  "id,title,cover_image_url,video_description,duration,share_url,create_time,view_count,like_count,comment_count,share_count";

function redirectUri(): string {
  const base =
    process.env.OAUTH_PUBLIC_BASE_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/api/connections/tiktok/callback`;
}

async function requestTokens(body: Record<string, string>): Promise<NormalizedTokenResult> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache" },
    body: new URLSearchParams(body),
  });
  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    open_id?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description ?? data.error ?? `TikTok token request failed (${res.status})`);
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
    scopes: String(data.scope ?? "").split(",").filter(Boolean),
    accountId: data.open_id,
  };
}

async function tiktokJson<T>(
  url: string,
  accessToken: string,
  init?: { method?: string; body?: unknown; query?: Record<string, string> },
): Promise<T> {
  const target = new URL(url);
  for (const [key, value] of Object.entries(init?.query ?? {})) target.searchParams.set(key, value);
  const res = await fetch(target, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.body ? { "Content-Type": "application/json; charset=UTF-8" } : {}),
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const data = (await res.json()) as T & {
    error?: { code?: string; message?: string };
  };
  const code = data.error?.code;
  if (!res.ok || (code && code !== "ok")) {
    throw new TikTokApiError(code ?? `http_${res.status}`, data.error?.message ?? `TikTok API request failed (${res.status})`);
  }
  return data;
}

class TikTokApiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(explainTikTokError(code, message));
    this.name = "TikTokApiError";
    this.code = code;
  }
}

function explainTikTokError(code: string, message: string) {
  if (code === "unaudited_client_can_only_post_to_private_accounts") {
    return "TikTok sandbox/unaudited apps can only post to a PRIVATE TikTok account. In the TikTok app, open Profile → Menu → Settings and privacy → Privacy → Private account, turn it on, then publish again.";
  }
  if (code === "privacy_level_option_mismatch") {
    return "TikTok rejected this privacy level. Query creator_info first and use one of the returned privacy_level_options (sandbox should use SELF_ONLY).";
  }
  if (code === "spam_risk_too_many_posts") {
    return "TikTok daily posting cap reached for this account. Try again tomorrow.";
  }
  return message ? `${code}: ${message}` : code;
}

async function queryCreatorInfo(accessToken: string) {
  return tiktokJson<{
    data?: {
      privacy_level_options?: string[];
      comment_disabled?: boolean;
      duet_disabled?: boolean;
      stitch_disabled?: boolean;
    };
  }>(CREATOR_INFO_URL, accessToken, { method: "POST", body: {} });
}

function firstVideo(target: PublishablePostTarget) {
  return target.media.find((item) => item.mimeType.startsWith("video/")) ?? target.media[0];
}

function localMediaPath(url: string): string | null {
  const marker = "/api/media/file/";
  const index = url.indexOf(marker);
  if (index === -1) return null;
  const key = decodeURIComponent(url.slice(index + marker.length)).replace(/\.{2}/g, "");
  return path.resolve(process.cwd(), "../../data/media", key);
}

function isPublicHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1";
  } catch {
    return false;
  }
}

async function waitForPublish(accessToken: string, publishId: string): Promise<PublishResult> {
  // TikTok's upload endpoint only acknowledges receipt. Do not report the post as
  // published until the status endpoint explicitly confirms PUBLISH_COMPLETE.
  // Processing regularly takes longer than the old 40-second polling window.
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await sleep(2000);
    const status = await tiktokJson<{
      data?: {
        status?: string;
        fail_reason?: string;
        publicaly_available_post_id?: string[];
        publicly_available_post_id?: string[];
      };
    }>(PUBLISH_STATUS_URL, accessToken, {
      method: "POST",
      body: { publish_id: publishId },
    });
    const row = status.data;
    const postIds = row?.publicly_available_post_id ?? row?.publicaly_available_post_id ?? [];
    if (row?.status === "PUBLISH_COMPLETE") {
      return {
        success: true,
        externalPublishId: publishId,
        // Private/sandbox posts do not always expose a public video ID here.
        // Never substitute publish_id: TikTok's video/query API only accepts video IDs.
        externalPostId: postIds[0],
      };
    }
    if (row?.status === "FAILED") {
      throw new Error(row.fail_reason ?? "TikTok publish failed");
    }
  }
  return {
    success: false,
    errorKind: "permanent",
    errorCode: "publish_status_timeout",
    errorMessage: `TikTok accepted the upload (${publishId}) but did not confirm publication within 2 minutes. Check TikTok Studio/inbox for its final moderation result before retrying.`,
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}


type TikTokVideo = {
  id: string;
  title?: string;
  cover_image_url?: string;
  share_url?: string;
  create_time?: number;
  view_count?: number;
  like_count?: number;
  comment_count?: number;
  share_count?: number;
  duration?: number;
};

function toContentItem(video: TikTokVideo): ContentItem {
  return {
    externalId: video.id,
    title: video.title ?? video.id,
    thumbnailUrl: video.cover_image_url,
    publishedAt: video.create_time ? new Date(video.create_time * 1000).toISOString() : new Date(0).toISOString(),
    url: video.share_url ?? `https://www.tiktok.com/@/video/${video.id}`,
    views: video.view_count,
    likes: video.like_count,
    comments: video.comment_count,
    shares: video.share_count,
    durationSeconds: video.duration,
    isShortForm: true,
    mediaKind: "short",
  };
}

async function listTikTokVideos(accessToken: string, limit = 20): Promise<TikTokVideo[]> {
  const videos: TikTokVideo[] = [];
  let cursor: number | undefined;
  while (videos.length < limit) {
    const remaining = Math.min(20, limit - videos.length);
    const data = await tiktokJson<{
      data?: { videos?: TikTokVideo[]; cursor?: number; has_more?: boolean };
    }>(`${VIDEO_LIST_URL}?fields=${encodeURIComponent(VIDEO_FIELDS)}`, accessToken, {
      method: "POST",
      body: cursor === undefined ? { max_count: remaining } : { max_count: remaining, cursor },
    });
    const page = data.data?.videos ?? [];
    videos.push(...page);
    if (!data.data?.has_more || page.length === 0) break;
    cursor = data.data.cursor;
    if (cursor === undefined) break;
  }
  return videos;
}

async function resolvePublishedVideoId(accessToken: string): Promise<string | undefined> {
  const videos = await listTikTokVideos(accessToken, 5).catch(() => []);
  return videos[0]?.id;
}

export const tiktokAdapter: PlatformAdapter = {
  platform: "tiktok",

  getAuthorizationUrl(state, scopes, appCredentials) {
    const url = new URL(AUTHORIZE_URL);
    url.searchParams.set("client_key", appCredentials.clientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", scopes.join(","));
    url.searchParams.set("redirect_uri", redirectUri());
    url.searchParams.set("state", state);
    url.searchParams.set("disable_auto_auth", "1");
    return url.toString();
  },

  async exchangeCodeForTokens(code, appCredentials: PlatformAppCredentials) {
    return requestTokens({
      client_key: appCredentials.clientId,
      client_secret: appCredentials.clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri(),
    });
  },

  async refreshAccessToken(refreshToken, appCredentials) {
    return requestTokens({
      client_key: appCredentials.clientId,
      client_secret: appCredentials.clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });
  },

  async fetchAccountIdentity(accessToken): Promise<AccountIdentity> {
    const data = await tiktokJson<{
      data?: { user?: { open_id?: string; display_name?: string; avatar_url?: string } };
    }>(USER_URL, accessToken, { query: { fields: "open_id,display_name,avatar_url" } });
    const user = data.data?.user;
    if (!user?.open_id) throw new Error("Failed to load TikTok account");
    return {
      externalId: user.open_id,
      displayName: user.display_name ?? user.open_id,
      avatarUrl: user.avatar_url,
    };
  },

  async publish(target, credentials): Promise<PublishResult> {
    const video = firstVideo(target);
    const localPath = video?.url ? localMediaPath(video.url) : null;
    const canPull = video?.url ? isPublicHttpUrl(video.url) : false;
    if (!video || (!localPath && !canPull)) {
      return {
        success: false,
        errorKind: "permanent",
        errorCode: "no_video",
        errorMessage: "TikTok publish requires an uploaded video file.",
      };
    }

    const specific = (target.platformSpecific ?? {}) as { title?: string; privacyLevel?: string };
    const [fallbackTitle] = target.content.split("\n");
    const title = (specific.title || fallbackTitle || target.content || "Untitled").slice(0, 150);

    try {
      const creator = await queryCreatorInfo(credentials.accessToken);
      const options = creator.data?.privacy_level_options ?? [];
      const requested = specific.privacyLevel ?? "PUBLIC_TO_EVERYONE";
      const privacyLevel = options.includes(requested) ? requested : undefined;
      if (!privacyLevel) {
        return {
          success: false,
          errorKind: "permanent",
          errorCode: "public_posting_not_allowed",
          errorMessage: options.includes("SELF_ONLY")
            ? "TikTok has not approved this app for public posts. Product videos stay private (only you) until the Content Posting API audit is approved. Submit the app for review, then publish again."
            : "TikTok did not allow the public privacy level for this account. creator_info returned: " + (options.join(", ") || "no options") + ".",
        };
      }
      const postInfo = {
        title,
        privacy_level: privacyLevel,
        disable_duet: Boolean(creator.data?.duet_disabled),
        disable_comment: Boolean(creator.data?.comment_disabled),
        disable_stitch: Boolean(creator.data?.stitch_disabled),
      };

      if (localPath) {
        const info = await stat(localPath);
        const videoSize = info.size;
        const initiated = await tiktokJson<{ data?: { publish_id?: string; upload_url?: string } }>(
          PUBLISH_INIT_URL,
          credentials.accessToken,
          {
            method: "POST",
            body: {
              post_info: postInfo,
              source_info: {
                source: "FILE_UPLOAD",
                video_size: videoSize,
                chunk_size: videoSize,
                total_chunk_count: 1,
              },
            },
          },
        );
        const publishId = initiated.data?.publish_id;
        const uploadUrl = initiated.data?.upload_url;
        if (!publishId || !uploadUrl) throw new Error("TikTok publish init did not return upload_url");

        const bytes = await readFile(localPath);
        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": video.mimeType || "video/mp4",
            "Content-Length": String(videoSize),
            "Content-Range": `bytes 0-${videoSize - 1}/${videoSize}`,
          },
          body: bytes,
        });
        if (!uploadRes.ok) {
          const detail = await uploadRes.text().catch(() => "");
          throw new Error(detail || `TikTok video upload failed (${uploadRes.status})`);
        }
        return waitForPublish(credentials.accessToken, publishId);
      }

      const initiated = await tiktokJson<{ data?: { publish_id?: string } }>(PUBLISH_INIT_URL, credentials.accessToken, {
        method: "POST",
        body: {
          post_info: postInfo,
          source_info: {
            source: "PULL_FROM_URL",
            video_url: video.url,
          },
        },
      });
      const publishId = initiated.data?.publish_id;
      if (!publishId) throw new Error("TikTok publish init did not return publish_id");
      return waitForPublish(credentials.accessToken, publishId);
    } catch (err) {
      const message = err instanceof Error
        ? `${err.message}${err.cause instanceof Error ? ` (${err.cause.message})` : ""}`
        : "TikTok publish failed";
      const code = err instanceof TikTokApiError ? err.code : "publish_failed";
      const transient = /fetch failed|network|connection|reset|socket|temporarily|rate limit|timeout|processing|rate_limit_exceeded|try again/i.test(`${code} ${message}`);
      return {
        success: false,
        errorKind: transient ? "transient" : "permanent",
        errorCode: code,
        errorMessage: message,
      };
    }
  },

  async listContent(accessToken, limit = 20): Promise<ContentItem[]> {
    const videos = await listTikTokVideos(accessToken, limit);
    return videos.map(toContentItem);
  },

  async fetchDailyStats(accessToken, since): Promise<DailyStat[]> {
    const videos = await listTikTokVideos(accessToken, 40);
    const byDate = new Map<string, DailyStat>();
    const sinceMs = since.getTime();
    for (const video of videos) {
      const createdAt = video.create_time ? video.create_time * 1000 : 0;
      if (createdAt && createdAt < sinceMs) continue;
      const date = new Date(createdAt || Date.now()).toISOString().slice(0, 10);
      const current = byDate.get(date) ?? {
        date,
        views: 0,
        likes: 0,
        comments: 0,
        subscribersGained: 0,
        subscribersLost: 0,
        estimatedMinutesWatched: 0,
        shares: 0,
      };
      current.views += Number(video.view_count ?? 0);
      current.likes += Number(video.like_count ?? 0);
      current.comments += Number(video.comment_count ?? 0);
      current.shares = Number(current.shares ?? 0) + Number(video.share_count ?? 0);
      byDate.set(date, current);
    }
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  },

  async fetchPostMetrics(externalPostId, credentials): Promise<PostMetrics> {
    if (!/^\d+$/.test(externalPostId)) {
      throw new TikTokApiError(
        "invalid_video_id",
        `TikTok metrics require a numeric video ID, received ${externalPostId}.`,
      );
    }
    const data = await tiktokJson<{
      data?: {
        videos?: Array<{
          view_count?: number;
          like_count?: number;
          comment_count?: number;
          share_count?: number;
        }>;
      };
    }>(`${VIDEO_QUERY_URL}?fields=${encodeURIComponent(VIDEO_FIELDS)}`, credentials.accessToken, {
      method: "POST",
      body: { filters: { video_ids: [externalPostId] } },
    });
    const video = data.data?.videos?.[0];
    return {
      views: Number(video?.view_count ?? 0),
      likes: Number(video?.like_count ?? 0),
      comments: Number(video?.comment_count ?? 0),
      shares: Number(video?.share_count ?? 0),
      favorites: 0,
    };
  },

  async fetchComments(): Promise<PostComment[]> {
    return [];
  },
};
