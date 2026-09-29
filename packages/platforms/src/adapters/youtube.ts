import type { ContentFormat, ContentFormatStat, ContentItem, DailyStat, NormalizedTokenResult, PlatformAdapter } from "@social-suite/core";
import { readFile } from "node:fs/promises";
import path from "node:path";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CHANNELS_URL = "https://www.googleapis.com/youtube/v3/channels";
const UPLOAD_URL = "https://www.googleapis.com/upload/youtube/v3/videos";
const PLAYLIST_ITEMS_URL = "https://www.googleapis.com/youtube/v3/playlistItems";
const VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos";
const ANALYTICS_URL = "https://youtubeanalytics.googleapis.com/v2/reports";
const ANALYTICS_METRICS = [
  "views",
  "likes",
  "comments",
  "subscribersGained",
  "subscribersLost",
  "estimatedMinutesWatched",
] as const;

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const SHORT_FORM_MAX_SECONDS = 60;

function localMediaPath(url: string): string | null {
  const marker = "/api/media/file/";
  const index = url.indexOf(marker);
  if (index === -1) return null;
  const key = decodeURIComponent(url.slice(index + marker.length)).replace(/\.{2}/g, "");
  return path.resolve(process.cwd(), "../../data/media", key);
}

/** Parses an ISO 8601 duration (e.g. "PT1M30S") into whole seconds. */
function parseIsoDuration(duration: string): number {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(duration);
  if (!match) return 0;
  const [, hours, minutes, seconds] = match;
  return (Number(hours) || 0) * 3600 + (Number(minutes) || 0) * 60 + (Number(seconds) || 0);
}

function redirectUri(): string {
  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  return `${base}/api/connections/youtube/callback`;
}

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

interface GoogleErrorResponse {
  error: string;
  error_description?: string;
}

async function requestTokens(body: Record<string, string>): Promise<NormalizedTokenResult> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });

  const data = (await res.json()) as GoogleTokenResponse | GoogleErrorResponse;

  if (!res.ok || "error" in data) {
    const message = "error" in data ? (data.error_description ?? data.error) : `Google token request failed (${res.status})`;
    throw new Error(message);
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
    scopes: data.scope.split(" ").filter(Boolean),
  };
}

interface YoutubeChannelListResponse {
  items?: Array<{
    id: string;
    snippet: { title: string; thumbnails?: { default?: { url: string } } };
  }>;
}

export const youtubeAdapter: PlatformAdapter = {
  platform: "youtube",

  getAuthorizationUrl(state, scopes, appCredentials) {
    const url = new URL(AUTH_URL);
    url.searchParams.set("client_id", appCredentials.clientId);
    url.searchParams.set("redirect_uri", redirectUri());
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", scopes.join(" "));
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("include_granted_scopes", "true");
    url.searchParams.set("state", state);
    return url.toString();
  },

  async exchangeCodeForTokens(code, appCredentials) {
    return requestTokens({
      code,
      client_id: appCredentials.clientId,
      client_secret: appCredentials.clientSecret,
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
    });
  },

  async refreshAccessToken(refreshToken, appCredentials) {
    return requestTokens({
      refresh_token: refreshToken,
      client_id: appCredentials.clientId,
      client_secret: appCredentials.clientSecret,
      grant_type: "refresh_token",
    });
  },

  async fetchAccountIdentity(accessToken) {
    const url = new URL(CHANNELS_URL);
    url.searchParams.set("part", "snippet");
    url.searchParams.set("mine", "true");

    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) {
      throw new Error(`Failed to fetch YouTube channel (${res.status})`);
    }

    const data = (await res.json()) as YoutubeChannelListResponse;
    const channel = data.items?.[0];
    if (!channel) {
      throw new Error("No YouTube channel found for this Google account");
    }

    return {
      externalId: channel.id,
      displayName: channel.snippet.title,
      avatarUrl: channel.snippet.thumbnails?.default?.url,
    };
  },

  async publish(target, credentials) {
    const video = target.media[0];
    if (!video) {
      return {
        success: false,
        errorKind: "permanent",
        errorCode: "no_media",
        errorMessage: "YouTube uploads require a video file.",
      };
    }

    try {
      const localPath = localMediaPath(video.url);
      let videoBytes: ArrayBuffer | Uint8Array;
      if (localPath) {
        videoBytes = await readFile(localPath);
      } else {
        const mediaRes = await fetch(video.url);
        if (!mediaRes.ok) {
          return {
            success: false,
            errorKind: "transient",
            errorCode: "media_fetch_failed",
            errorMessage: `Failed to download media (${mediaRes.status})`,
          };
        }
        videoBytes = await mediaRes.arrayBuffer();
      }

      const specific = (target.platformSpecific ?? {}) as {
        title?: string;
        description?: string;
        privacyStatus?: string;
        tags?: string[];
      };
      const [fallbackTitle] = target.content.split("\n");
      const title = (specific.title || fallbackTitle || "Untitled").slice(0, 100);
      const description = specific.description ?? target.content;
      const privacyStatus = ["public", "unlisted", "private"].includes(specific.privacyStatus ?? "")
        ? specific.privacyStatus
        : "public";

      const sessionRes = await fetch(`${UPLOAD_URL}?uploadType=resumable&part=snippet,status`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${credentials.accessToken}`,
          "Content-Type": "application/json",
          "X-Upload-Content-Type": video.mimeType,
          "X-Upload-Content-Length": String(videoBytes.byteLength),
        },
        body: JSON.stringify({
          snippet: { title, description, tags: specific.tags },
          status: { privacyStatus },
        }),
      });

      if (!sessionRes.ok) {
        const permanent = sessionRes.status === 401 || sessionRes.status === 403;
        return {
          success: false,
          errorKind: permanent ? "permanent" : "transient",
          errorCode: "upload_session_failed",
          errorMessage: `Failed to start YouTube upload (${sessionRes.status})`,
        };
      }

      const uploadUrl = sessionRes.headers.get("location");
      if (!uploadUrl) {
        return {
          success: false,
          errorKind: "transient",
          errorCode: "upload_session_failed",
          errorMessage: "YouTube did not return an upload URL",
        };
      }

      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": video.mimeType, "Content-Length": String(videoBytes.byteLength) },
        // Copy into an ArrayBuffer-backed view. TypeScript's DOM fetch types reject
        // Uint8Array<ArrayBufferLike> because it could be backed by SharedArrayBuffer.
        body: new Uint8Array(videoBytes),
      });

      if (!uploadRes.ok) {
        return {
          success: false,
          errorKind: uploadRes.status >= 500 ? "transient" : "permanent",
          errorCode: "upload_failed",
          errorMessage: `YouTube upload failed (${uploadRes.status})`,
        };
      }

      const uploaded = (await uploadRes.json()) as { id: string };
      return { success: true, externalPostId: uploaded.id };
    } catch (err) {
      return {
        success: false,
        errorKind: "transient",
        errorCode: "network_error",
        errorMessage: err instanceof Error ? err.message : "Unknown error",
      };
    }
  },

  async fetchDailyStats(accessToken, since) {
    const url = new URL(ANALYTICS_URL);
    url.searchParams.set("ids", "channel==MINE");
    url.searchParams.set("startDate", toDateString(since));
    url.searchParams.set("endDate", toDateString(new Date()));
    url.searchParams.set("metrics", ANALYTICS_METRICS.join(","));
    url.searchParams.set("dimensions", "day");
    url.searchParams.set("sort", "day");

    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) {
      throw new Error(`Failed to fetch YouTube Analytics (${res.status})`);
    }

    const data = (await res.json()) as {
      columnHeaders: Array<{ name: string }>;
      rows?: Array<Array<string | number>>;
    };

    const columnIndex = new Map(data.columnHeaders.map((col, i) => [col.name, i]));
    const dayIndex = columnIndex.get("day");
    if (dayIndex === undefined) return [];

    return (data.rows ?? []).map((row) => {
      const at = (name: string): number => {
        const i = columnIndex.get(name);
        return i === undefined ? 0 : Number(row[i] ?? 0);
      };
      return {
        date: String(row[dayIndex]),
        views: at("views"),
        likes: at("likes"),
        comments: at("comments"),
        subscribersGained: at("subscribersGained"),
        subscribersLost: at("subscribersLost"),
        estimatedMinutesWatched: at("estimatedMinutesWatched"),
      } satisfies DailyStat;
    });
  },

  async listContent(accessToken, limit = 25) {
    const channelUrl = new URL(CHANNELS_URL);
    channelUrl.searchParams.set("part", "contentDetails");
    channelUrl.searchParams.set("mine", "true");

    const channelRes = await fetch(channelUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!channelRes.ok) {
      throw new Error(`Failed to fetch YouTube channel (${channelRes.status})`);
    }
    const channelData = (await channelRes.json()) as {
      items?: Array<{ contentDetails: { relatedPlaylists: { uploads: string } } }>;
    };
    const uploadsPlaylistId = channelData.items?.[0]?.contentDetails.relatedPlaylists.uploads;
    if (!uploadsPlaylistId) return [];

    const playlistUrl = new URL(PLAYLIST_ITEMS_URL);
    playlistUrl.searchParams.set("part", "snippet");
    playlistUrl.searchParams.set("playlistId", uploadsPlaylistId);
    playlistUrl.searchParams.set("maxResults", String(Math.min(limit, 50)));

    const playlistRes = await fetch(playlistUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!playlistRes.ok) {
      throw new Error(`Failed to fetch YouTube uploads (${playlistRes.status})`);
    }
    const playlistData = (await playlistRes.json()) as {
      items?: Array<{
        snippet: {
          title: string;
          publishedAt: string;
          resourceId: { videoId: string };
          thumbnails?: { medium?: { url: string }; default?: { url: string } };
        };
      }>;
    };

    const videos = playlistData.items ?? [];
    if (videos.length === 0) return [];

    const videoIds = videos.map((v) => v.snippet.resourceId.videoId);
    const statsUrl = new URL(VIDEOS_URL);
    statsUrl.searchParams.set("part", "statistics,contentDetails");
    statsUrl.searchParams.set("id", videoIds.join(","));

    const statsRes = await fetch(statsUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    const statsById = new Map<
      string,
      { viewCount?: string; likeCount?: string; commentCount?: string; duration?: string }
    >();
    if (statsRes.ok) {
      const statsData = (await statsRes.json()) as {
        items?: Array<{
          id: string;
          statistics: { viewCount?: string; likeCount?: string; commentCount?: string };
          contentDetails: { duration?: string };
        }>;
      };
      for (const item of statsData.items ?? []) {
        statsById.set(item.id, { ...item.statistics, duration: item.contentDetails.duration });
      }
    }

    return videos
      .map((v) => {
        const videoId = v.snippet.resourceId.videoId;
        const stats = statsById.get(videoId);
        const durationSeconds = stats?.duration ? parseIsoDuration(stats.duration) : undefined;
        return {
          externalId: videoId,
          title: v.snippet.title,
          thumbnailUrl: v.snippet.thumbnails?.medium?.url ?? v.snippet.thumbnails?.default?.url,
          publishedAt: v.snippet.publishedAt,
          url: `https://www.youtube.com/watch?v=${videoId}`,
          views: stats?.viewCount !== undefined ? Number(stats.viewCount) : undefined,
          likes: stats?.likeCount !== undefined ? Number(stats.likeCount) : undefined,
          comments: stats?.commentCount !== undefined ? Number(stats.commentCount) : undefined,
          durationSeconds,
          isShortForm: durationSeconds !== undefined ? durationSeconds <= SHORT_FORM_MAX_SECONDS : undefined,
          mediaKind: durationSeconds !== undefined && durationSeconds <= SHORT_FORM_MAX_SECONDS ? "short" : "video",
        } satisfies ContentItem;
      })
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  },

  async fetchContentFormatBreakdown(accessToken, since) {
    const url = new URL(ANALYTICS_URL);
    url.searchParams.set("ids", "channel==MINE");
    url.searchParams.set("startDate", toDateString(since));
    url.searchParams.set("endDate", toDateString(new Date()));
    url.searchParams.set("metrics", "views,subscribersGained,subscribersLost,estimatedMinutesWatched");
    url.searchParams.set("dimensions", "creatorContentType");

    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) {
      throw new Error(`Failed to fetch YouTube content format breakdown (${res.status})`);
    }

    const data = (await res.json()) as {
      columnHeaders: Array<{ name: string }>;
      rows?: Array<Array<string | number>>;
    };

    const columnIndex = new Map(data.columnHeaders.map((col, i) => [col.name, i]));
    const formatIndex = columnIndex.get("creatorContentType");
    if (formatIndex === undefined) return [];

    return (data.rows ?? []).map((row) => {
      const at = (name: string): number => {
        const i = columnIndex.get(name);
        return i === undefined ? 0 : Number(row[i] ?? 0);
      };
      return {
        contentFormat: toContentFormat(String(row[formatIndex])),
        views: at("views"),
        subscribersGained: at("subscribersGained"),
        subscribersLost: at("subscribersLost"),
        estimatedMinutesWatched: at("estimatedMinutesWatched"),
      } satisfies ContentFormatStat;
    });
  },
};

function toContentFormat(creatorContentType: string): ContentFormat {
  switch (creatorContentType) {
    case "shorts":
      return "short";
    case "liveStream":
      return "live";
    case "videoOnDemand":
      return "video";
    default:
      // e.g. "creatorContentTypeUnspecified" — subscribes/views not attributable to one content type.
      return "unspecified";
  }
}
