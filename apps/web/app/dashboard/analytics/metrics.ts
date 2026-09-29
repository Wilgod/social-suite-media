import { PLATFORM_LABELS, PLATFORMS, type Platform } from "@social-suite/core";

export type MetricKey = "views" | "likes" | "comments" | "shares" | "favorites" | "coins" | "watch";
export type ContentKind = "text" | "image" | "video" | "short" | "live";

export interface DailyPoint {
  date: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  favorites: number;
  watch: number;
}

export interface DisplayMetric {
  key: MetricKey;
  label: string;
  value?: number;
  series: number[];
}

const METRIC_LABELS: Record<MetricKey, string> = {
  views: "Views",
  likes: "Likes",
  comments: "Comments",
  shares: "Shares",
  favorites: "Saves",
  coins: "Coins",
  watch: "Watch time",
};

export const KIND_LABELS: Record<ContentKind, string> = {
  text: "Text",
  image: "Image",
  video: "Video",
  short: "Short",
  live: "Live",
};

export const ENGAGEMENT_KEYS: MetricKey[] = ["likes", "comments", "shares", "favorites", "coins"];

export const ENGAGEMENT_COLOR: Record<MetricKey, string> = {
  likes: "#7c3aed",
  comments: "#e879f9",
  shares: "#38bdf8",
  favorites: "#f59e0b",
  coins: "#34d399",
  views: "#a78bfa",
  watch: "#c4b5fd",
};

export const TIKTOK_SANDBOX_NOTE =
  "Sandbox posts stay private until the app is audited, so views and likes often remain 0.";

export function isPlatform(value: string): value is Platform {
  return (PLATFORMS as readonly string[]).includes(value);
}

export function metricLabel(platform: Platform, key: MetricKey): string {
  if (platform === "instagram" && key === "views") return "Reach";
  return METRIC_LABELS[key];
}

export function postingStyle(platform: Platform): "video" | "text" | "mixed" {
  if (platform === "youtube" || platform === "tiktok" || platform === "douyin" || platform === "bilibili") return "video";
  if (platform === "threads") return "text";
  return "mixed";
}

export function styleCopy(platform: Platform): string {
  const style = postingStyle(platform);
  if (style === "video") return "Video";
  if (style === "text") return "Text";
  return "Text and video";
}

export function trackedCopy(platform: Platform): string {
  if (postingStyle(platform) === "video") return "Views, likes, and comments on each video.";
  if (postingStyle(platform) === "text") return "Likes, comments, and shares on each post.";
  return "Stats follow the post: video, image, or text.";
}

/** Daily snapshots only count a metric when the adapter actually measures it. */
export function snapshotMetricKeys(platform: Platform): MetricKey[] {
  switch (platform) {
    case "youtube":
      return ["views", "likes", "comments", "watch"];
    case "tiktok":
    case "douyin":
      return ["views", "likes", "comments", "shares"];
    case "instagram":
      return ["views"];
    default:
      return [];
  }
}

export function accountMetricKeys(platform: Platform): MetricKey[] {
  switch (platform) {
    case "youtube":
      return ["views", "likes", "comments", "watch"];
    case "tiktok":
    case "douyin":
      return ["views", "likes", "comments", "shares"];
    case "instagram":
      return ["views", "likes", "comments", "shares"];
    case "facebook":
      return ["likes", "comments", "shares", "views"];
    case "threads":
    case "weibo":
      return ["likes", "comments", "shares"];
    case "x":
      return ["likes", "comments", "shares", "views"];
    case "xiaohongshu":
      return ["views", "likes", "comments", "favorites"];
    case "bilibili":
      return ["views", "likes", "comments", "favorites"];
  }
}

export function contentMetricKeys(
  platform: Platform,
  kind: ContentKind,
  metrics: Partial<Record<MetricKey, number>> = {},
): MetricKey[] {
  const visual = kind === "video" || kind === "short" || kind === "live";
  const keys: MetricKey[] = [];
  const add = (key: MetricKey, when = true) => {
    if (when) keys.push(key);
  };
  const has = (key: MetricKey) => metrics[key] !== undefined;

  switch (platform) {
    case "youtube":
      add("views");
      add("likes");
      add("comments");
      add("watch", has("watch"));
      break;
    case "tiktok":
      add("views");
      add("likes");
      add("comments");
      add("shares");
      add("favorites", has("favorites"));
      break;
    case "douyin":
      add("views");
      add("likes");
      add("comments");
      add("shares");
      add("favorites");
      break;
    case "instagram":
      add("views", visual && has("views"));
      add("likes");
      add("comments");
      add("shares", has("shares"));
      add("favorites", has("favorites"));
      break;
    case "facebook":
      add("views", visual || has("views"));
      add("likes");
      add("comments");
      add("shares");
      break;
    case "x":
      add("views", visual || has("views"));
      add("likes");
      add("comments");
      add("shares");
      break;
    case "threads":
    case "weibo":
      add("likes");
      add("comments");
      add("shares");
      add("views", has("views"));
      break;
    case "xiaohongshu":
      add("views");
      add("likes");
      add("comments");
      add("favorites");
      add("shares", has("shares"));
      break;
    case "bilibili":
      add("views");
      add("likes");
      add("comments");
      add("shares");
      add("favorites");
      add("coins", has("coins"));
      break;
  }
  return keys;
}

export function dailyValue(day: DailyPoint, key: MetricKey): number | undefined {
  switch (key) {
    case "views":
      return day.views;
    case "likes":
      return day.likes;
    case "comments":
      return day.comments;
    case "shares":
      return day.shares;
    case "favorites":
      return day.favorites;
    case "watch":
      return day.watch;
    default:
      return undefined;
  }
}

export function displayMetrics(
  platform: Platform,
  days: DailyPoint[],
  contentTotals?: Partial<Record<MetricKey, number>>,
): DisplayMetric[] {
  const tracked = new Set(snapshotMetricKeys(platform));
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));

  return accountMetricKeys(platform).flatMap((key) => {
    const series = tracked.has(key)
      ? sorted.flatMap((day) => {
          const value = dailyValue(day, key);
          return value === undefined ? [] : [value];
        })
      : [];
    const snapshotSum = series.length ? series.reduce((sum, value) => sum + value, 0) : undefined;
    const contentSum = contentTotals?.[key];
    const usefulSeries = series.some((value) => value > 0) ? series : [];

    let value: number | undefined;
    let shownSeries: number[] = [];
    if (snapshotSum !== undefined && snapshotSum > 0) {
      value = snapshotSum;
      shownSeries = usefulSeries;
    } else if (contentSum !== undefined) {
      value = contentSum;
    } else if (snapshotSum !== undefined) {
      value = snapshotSum;
    }
    if (value === undefined) return [];
    return [{ key, label: metricLabel(platform, key), value, series: shownSeries }];
  });
}

export function sumContentMetrics(
  items: Array<{ metrics: Partial<Record<MetricKey, number>> }>,
  keys: MetricKey[],
): Partial<Record<MetricKey, number>> {
  const totals: Partial<Record<MetricKey, number>> = {};
  for (const key of keys) {
    const values = items.map((item) => item.metrics[key]).filter((value): value is number => value !== undefined);
    if (values.length > 0) totals[key] = values.reduce((sum, value) => sum + value, 0);
  }
  return totals;
}

export function seriesFromCaptures(
  captures: Array<{ metrics: Partial<Record<MetricKey, number>> }>,
  key: MetricKey,
): number[] {
  const values = captures.map((capture) => capture.metrics[key]).filter((value): value is number => value !== undefined);
  return values.length >= 2 ? values : [];
}

export function weekDelta(series: number[]): { text: string; tone: "up" | "down" | "flat" } | null {
  if (series.length < 14) return null;
  const recent = series.slice(-7).reduce((sum, value) => sum + value, 0);
  const prior = series.slice(-14, -7).reduce((sum, value) => sum + value, 0);
  if (recent === 0 && prior === 0) return null;
  if (prior === 0) return { text: "New", tone: "up" };
  const pct = Math.round(((recent - prior) / prior) * 100);
  if (pct === 0) return { text: "0%", tone: "flat" };
  return { text: `${pct > 0 ? "+" : ""}${pct}%`, tone: pct > 0 ? "up" : "down" };
}

export function formatMetricValue(key: MetricKey, value: number | undefined): string {
  if (value === undefined) return "—";
  if (key === "watch") {
    if (value < 60) return `${value.toLocaleString()} min`;
    const hours = Math.floor(value / 60);
    const minutes = value % 60;
    return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return value.toLocaleString();
}

export function metricSummary(
  platform: Platform,
  kind: ContentKind,
  metrics: Partial<Record<MetricKey, number>>,
): string {
  const parts = contentMetricKeys(platform, kind, metrics)
    .filter((key) => metrics[key] !== undefined)
    .slice(0, 3)
    .map((key) => `${formatMetricValue(key, metrics[key])} ${metricLabel(platform, key).toLowerCase()}`);
  return parts.length > 0 ? parts.join(" · ") : "No stats yet";
}

export function engagementSegments(metrics: Partial<Record<MetricKey, number>>) {
  const rows = ENGAGEMENT_KEYS.flatMap((key) => {
    const value = metrics[key];
    if (value === undefined || value <= 0) return [];
    return [{ key, value }];
  });
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  if (total <= 0) return [];
  let used = 0;
  return rows.map((row, index) => {
    const pct = index === rows.length - 1 ? 100 - used : Math.round((row.value / total) * 100);
    used += pct;
    return { ...row, pct };
  });
}

export function formatWhen(iso: string | undefined, withYear = false): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", withYear ? { month: "short", day: "numeric", year: "numeric" } : { month: "short", day: "numeric" });
}

export function countLabel(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function platformPath(platform: string): string {
  return `/dashboard/analytics/${platform}`;
}

export function accountPath(platform: string, accountId: string, query?: { item?: string; kind?: string }): string {
  const params = new URLSearchParams();
  if (query?.kind && query.kind !== "all") params.set("kind", query.kind);
  if (query?.item) params.set("item", query.item);
  const search = params.toString();
  return `/dashboard/analytics/${platform}/${accountId}${search ? `?${search}` : ""}`;
}

export function externalUrl(platform: Platform, externalId?: string | null): string | undefined {
  if (!externalId) return undefined;
  switch (platform) {
    case "youtube":
      return `https://www.youtube.com/watch?v=${encodeURIComponent(externalId)}`;
    case "tiktok":
      return `https://www.tiktok.com/@/video/${encodeURIComponent(externalId)}`;
    case "douyin":
      return `https://www.douyin.com/video/${encodeURIComponent(externalId)}`;
    case "x":
      return `https://x.com/i/status/${encodeURIComponent(externalId)}`;
    case "bilibili":
      return externalId.startsWith("BV") || externalId.startsWith("av")
        ? `https://www.bilibili.com/video/${externalId}`
        : undefined;
    default:
      return undefined;
  }
}

export function unmeasured(values: Array<number | undefined>): boolean {
  const known = values.filter((value): value is number => value !== undefined);
  return known.length === 0 || known.every((value) => value === 0);
}

export function platformOrder(platform: Platform): number {
  return PLATFORMS.indexOf(platform);
}

export { PLATFORM_LABELS };
