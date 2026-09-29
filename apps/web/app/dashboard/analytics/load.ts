import type { ContentItem, Platform } from "@social-suite/core";
import { prisma } from "@social-suite/db";
import { getAdapter, hasAdapter } from "@social-suite/platforms";
import { getValidAccessToken } from "@/lib/access-token";
import { requireTenantContext } from "@/lib/tenant";
import {
  type ContentKind,
  type DailyPoint,
  type DisplayMetric,
  type MetricKey,
  PLATFORM_LABELS,
  accountMetricKeys,
  contentMetricKeys,
  displayMetrics,
  externalUrl,
  platformOrder,
  seriesFromCaptures,
  sumContentMetrics,
} from "./metrics";

const CONTENT_CAP = 36;

export interface AccountPreview {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  publishedHere: number;
  metrics: DisplayMetric[];
}

export interface PlatformSummary {
  platform: Platform;
  accounts: AccountPreview[];
  metrics: DisplayMetric[];
}

export interface AnalyticsContent {
  id: string;
  kind: ContentKind;
  title: string;
  excerpt: string;
  thumbnailUrl?: string;
  publishedAt?: string;
  url?: string;
  metrics: Partial<Record<MetricKey, number>>;
  series: Partial<Record<MetricKey, number[]>>;
  captures: Array<{ at: string; metrics: Partial<Record<MetricKey, number>> }>;
}

export interface AccountAnalytics {
  account: AccountPreview;
  contents: AnalyticsContent[];
  truncated: boolean;
  warning?: string;
  metrics: DisplayMetric[];
}

type SnapshotRow = {
  socialAccountId: string;
  date: Date;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  favorites: number;
  estimatedMinutesWatched: number;
};

function toDaily(rows: SnapshotRow[]): DailyPoint[] {
  const byDate = new Map<string, DailyPoint>();
  for (const row of rows) {
    const date = row.date.toISOString().slice(0, 10);
    const current = byDate.get(date) ?? { date, views: 0, likes: 0, comments: 0, shares: 0, favorites: 0, watch: 0 };
    current.views += row.views;
    current.likes += row.likes;
    current.comments += row.comments;
    current.shares += row.shares;
    current.favorites += row.favorites;
    current.watch += row.estimatedMinutesWatched;
    byDate.set(date, current);
  }
  return [...byDate.values()];
}

function isDemo(metadata: unknown): boolean {
  return typeof metadata === "object" && metadata !== null && (metadata as { demoMode?: boolean }).demoMode === true;
}

function kindFromMime(mimeType: string, durationMs?: number | null): ContentKind {
  if (mimeType.startsWith("video/")) {
    if (durationMs && durationMs > 0 && durationMs <= 60_000) return "short";
    return "video";
  }
  if (mimeType.startsWith("image/")) return "image";
  return "text";
}

function resolveKind(
  platform: Platform,
  remote: ContentItem | undefined,
  media: Array<{ mimeType: string; durationMs: number | null }>,
): ContentKind {
  if (remote?.mediaKind) return remote.mediaKind;
  if (remote?.isShortForm || platform === "tiktok" || platform === "douyin") return "short";
  if (remote && (platform === "youtube" || platform === "bilibili")) {
    if (remote.durationSeconds !== undefined && remote.durationSeconds <= 60) return "short";
    return "video";
  }
  const asset = media[0];
  if (asset) return kindFromMime(asset.mimeType, asset.durationMs);
  if (remote?.durationSeconds && remote.durationSeconds > 0) return remote.durationSeconds <= 60 ? "short" : "video";
  if (remote?.thumbnailUrl && platform !== "x" && platform !== "threads" && platform !== "weibo" && platform !== "facebook") {
    return "image";
  }
  return "text";
}

function pickCopy(remoteTitle: string | undefined, externalId: string | undefined, content: string | undefined) {
  const excerpt = (content ?? "").trim();
  const firstLine = excerpt.split("\n")[0]?.trim();
  const remoteOk = remoteTitle && remoteTitle !== externalId ? remoteTitle.trim() : "";
  const title = remoteOk || firstLine || "Untitled";
  return { title, excerpt: excerpt || title };
}

function thumbnailFor(remote: ContentItem | undefined, media: Array<{ mimeType: string; storageUrl: string }>) {
  if (remote?.thumbnailUrl) return remote.thumbnailUrl;
  return media.find((asset) => asset.mimeType.startsWith("image/"))?.storageUrl;
}

type TargetRow = {
  id: string;
  externalPostId: string | null;
  publishedAt: Date | null;
  post: { baseContent: string; createdAt: Date };
  media: Array<{ order: number; mediaAsset: { mimeType: string; storageUrl: string; durationMs: number | null } }>;
  metrics: Array<{
    capturedAt: Date;
    views: number;
    likes: number;
    comments: number;
    shares: number;
    favorites: number;
    coins: number;
  }>;
};

function capturesFor(target: TargetRow | undefined) {
  if (!target) return [];
  return [...target.metrics]
    .sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime())
    .map((metric) => ({
      at: metric.capturedAt.toISOString(),
      metrics: {
        views: metric.views,
        likes: metric.likes,
        comments: metric.comments,
        shares: metric.shares,
        favorites: metric.favorites,
        coins: metric.coins,
      },
    }));
}

function buildContent(platform: Platform, target: TargetRow | undefined, remote: ContentItem | undefined): AnalyticsContent {
  const media = [...(target?.media ?? [])].sort((a, b) => a.order - b.order).map((item) => item.mediaAsset);
  const externalId = remote?.externalId ?? target?.externalPostId ?? undefined;
  const captures = capturesFor(target);
  const latest = captures.at(-1)?.metrics ?? {};
  const remoteMetrics = {
    views: remote?.views,
    likes: remote?.likes,
    comments: remote?.comments,
    shares: remote?.shares,
    favorites: remote?.favorites,
  };
  const metrics: Partial<Record<MetricKey, number>> = { ...latest };
  for (const key of ["views", "likes", "comments", "shares", "favorites"] as const) {
    const value = remoteMetrics[key];
    if (value !== undefined) metrics[key] = value;
  }
  const copy = pickCopy(remote?.title, externalId, target?.post.baseContent);
  const kind = resolveKind(platform, remote, media);
  const series: Partial<Record<MetricKey, number[]>> = {};
  for (const key of contentMetricKeys(platform, kind, metrics)) {
    series[key] = seriesFromCaptures(captures, key);
  }
  return {
    id: target ? `post:${target.id}` : `ext:${externalId ?? remote?.externalId ?? "unknown"}`,
    kind,
    title: copy.title,
    excerpt: copy.excerpt,
    thumbnailUrl: thumbnailFor(remote, media),
    publishedAt: remote?.publishedAt ?? target?.publishedAt?.toISOString() ?? target?.post.createdAt.toISOString(),
    url: remote?.url || externalUrl(platform, externalId),
    metrics,
    series,
    captures,
  };
}

async function publishedCounts(organizationId: string, accountIds: string[]) {
  if (accountIds.length === 0) return new Map<string, number>();
  const rows = await prisma.postTarget.findMany({
    where: { organizationId, status: "success", socialAccountId: { in: accountIds } },
    select: { socialAccountId: true },
  });
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.socialAccountId, (counts.get(row.socialAccountId) ?? 0) + 1);
  return counts;
}

export async function loadAnalyticsIndex(): Promise<{ platforms: PlatformSummary[]; accountCount: number }> {
  const ctx = await requireTenantContext();
  const accounts = await prisma.socialAccount.findMany({
    where: { organizationId: ctx.organizationId, status: "active" },
    orderBy: { displayName: "asc" },
    select: { id: true, platform: true, displayName: true, avatarUrl: true },
  });
  const snapshots = await prisma.analyticsSnapshot.findMany({
    where: { organizationId: ctx.organizationId, socialAccountId: { in: accounts.map((account) => account.id) } },
    orderBy: { date: "asc" },
  });
  const counts = await publishedCounts(ctx.organizationId, accounts.map((account) => account.id));
  const snapshotsByAccount = new Map<string, SnapshotRow[]>();
  for (const snapshot of snapshots) {
    const list = snapshotsByAccount.get(snapshot.socialAccountId) ?? [];
    list.push(snapshot);
    snapshotsByAccount.set(snapshot.socialAccountId, list);
  }

  const grouped = new Map<Platform, typeof accounts>();
  for (const account of accounts) {
    const list = grouped.get(account.platform) ?? [];
    list.push(account);
    grouped.set(account.platform, list);
  }

  const platforms = [...grouped.entries()]
    .sort(([a], [b]) => platformOrder(a) - platformOrder(b))
    .map(([platform, platformAccounts]) => {
      const days = toDaily(platformAccounts.flatMap((account) => snapshotsByAccount.get(account.id) ?? []));
      return {
        platform,
        metrics: displayMetrics(platform, days),
        accounts: platformAccounts.map((account) => ({
          id: account.id,
          displayName: account.displayName,
          avatarUrl: account.avatarUrl,
          publishedHere: counts.get(account.id) ?? 0,
          metrics: displayMetrics(platform, toDaily(snapshotsByAccount.get(account.id) ?? [])),
        })),
      };
    });

  return { platforms, accountCount: accounts.length };
}

export async function loadPlatformAnalytics(platform: Platform): Promise<PlatformSummary> {
  const { platforms } = await loadAnalyticsIndex();
  return (
    platforms.find((item) => item.platform === platform) ?? {
      platform,
      accounts: [],
      metrics: [],
    }
  );
}

export async function loadAccountAnalytics(platform: Platform, accountId: string): Promise<AccountAnalytics | null> {
  const ctx = await requireTenantContext();
  const account = await prisma.socialAccount.findFirst({
    where: { id: accountId, organizationId: ctx.organizationId, platform, status: "active" },
    include: { credential: true },
  });
  if (!account) return null;

  const [snapshots, targets] = await Promise.all([
    prisma.analyticsSnapshot.findMany({
      where: { organizationId: ctx.organizationId, socialAccountId: account.id },
      orderBy: { date: "asc" },
    }),
    prisma.postTarget.findMany({
      where: { organizationId: ctx.organizationId, socialAccountId: account.id, status: "success" },
      include: {
        post: { select: { baseContent: true, createdAt: true } },
        media: { include: { mediaAsset: true } },
        metrics: true,
      },
    }),
  ]);

  let remote: ContentItem[] = [];
  let warning: string | undefined;
  if (!isDemo(account.platformMetadata) && account.credential && hasAdapter(account.platform) && getAdapter(account.platform).listContent) {
    try {
      const accessToken = await getValidAccessToken(ctx.organizationId, account.platform, account.credential);
      remote = await getAdapter(account.platform).listContent!(accessToken, 24);
    } catch (err) {
      console.error(`Failed to list content for ${account.platform} account ${account.id}`, err);
      warning = `Couldn't refresh posts from ${PLATFORM_LABELS[account.platform]}. Showing posts sent from Social Suite.`;
    }
  }

  const byExternal = new Map(targets.filter((target) => target.externalPostId).map((target) => [target.externalPostId as string, target]));
  const used = new Set<string>();
  const contents: AnalyticsContent[] = [];
  for (const item of remote) {
    const target = byExternal.get(item.externalId);
    if (target) used.add(target.id);
    contents.push(buildContent(platform, target, item));
  }
  for (const target of targets) {
    if (used.has(target.id)) continue;
    contents.push(buildContent(platform, target, undefined));
  }
  contents.sort((a, b) => Date.parse(b.publishedAt ?? "") - Date.parse(a.publishedAt ?? ""));
  const truncated = contents.length > CONTENT_CAP;
  const visible = contents.slice(0, CONTENT_CAP);
  const totals = sumContentMetrics(visible, accountMetricKeys(platform));

  return {
    account: {
      id: account.id,
      displayName: account.displayName,
      avatarUrl: account.avatarUrl,
      publishedHere: targets.length,
      metrics: displayMetrics(platform, toDaily(snapshots)),
    },
    contents: visible,
    truncated,
    warning,
    metrics: displayMetrics(platform, toDaily(snapshots), totals),
  };
}
