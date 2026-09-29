import { prisma } from "@social-suite/db";
import { PLATFORM_LABELS, type Platform, type PostStatus } from "@social-suite/core";
import { requireTenantContext } from "@/lib/tenant";
import { HomeView, type HomePayload } from "./_components/home-view";

const MIX_ORDER: PostStatus[] = ["published", "scheduled", "publishing", "partially_published", "failed", "draft", "canceled"];

const MIX_LABELS: Record<PostStatus, string> = {
  draft: "Drafts",
  scheduled: "Scheduled",
  publishing: "Publishing",
  partially_published: "Partial",
  published: "Published",
  failed: "Failed",
  canceled: "Canceled",
};

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addUtcDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function platformLabel(platform: string) {
  return PLATFORM_LABELS[platform as Platform] ?? platform;
}

function excerpt(text: string, max = 96) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "Untitled post";
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function firstName(name: string | null | undefined, email: string | null | undefined) {
  const trimmed = name?.trim();
  if (trimmed) return trimmed.split(/\s+/)[0] ?? "there";
  const local = (email ?? "").split("@")[0] ?? "";
  const piece = local.split(/[._-]/)[0] ?? "";
  if (!piece) return "there";
  return piece.charAt(0).toUpperCase() + piece.slice(1);
}

export default async function DashboardPage() {
  const ctx = await requireTenantContext();
  const now = new Date();
  const today = startOfUtcDay(now);
  const chartStart = addUtcDays(today, -13);
  const currentStart = addUtcDays(today, -6);
  const chartEnd = addUtcDays(today, 1);
  const soon = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tokenHorizon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [user, organization, accounts, snapshots, postRows, recentPosts, publishedTargets, failedTargets, scheduledSoon, media, recentComments] =
    await Promise.all([
      prisma.user.findUnique({ where: { id: ctx.userId }, select: { name: true, email: true } }),
      prisma.organization.findUnique({ where: { id: ctx.organizationId }, select: { name: true } }),
      prisma.socialAccount.findMany({
        where: { organizationId: ctx.organizationId },
        orderBy: { connectedAt: "desc" },
        select: {
          id: true,
          displayName: true,
          platform: true,
          avatarUrl: true,
          status: true,
          credential: { select: { tokenExpiresAt: true } },
        },
      }),
      prisma.analyticsSnapshot.findMany({
        where: { organizationId: ctx.organizationId, date: { gte: chartStart, lt: chartEnd } },
        select: {
          socialAccountId: true,
          date: true,
          views: true,
          likes: true,
          comments: true,
          shares: true,
          estimatedMinutesWatched: true,
        },
      }),
      prisma.post.findMany({
        where: { organizationId: ctx.organizationId },
        select: { status: true },
      }),
      prisma.post.findMany({
        where: { organizationId: ctx.organizationId },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          id: true,
          baseContent: true,
          status: true,
          createdAt: true,
          scheduledAt: true,
          targets: { select: { platform: true, status: true } },
        },
      }),
      prisma.postTarget.findMany({
        where: {
          organizationId: ctx.organizationId,
          status: "success",
          publishedAt: { gte: chartStart, lt: chartEnd },
        },
        select: { postId: true, publishedAt: true },
      }),
      prisma.postTarget.findMany({
        where: { organizationId: ctx.organizationId, status: "failed" },
        orderBy: { lastAttemptedAt: "desc" },
        take: 3,
        select: { id: true, platform: true, errorMessage: true, post: { select: { baseContent: true } } },
      }),
      prisma.post.findMany({
        where: {
          organizationId: ctx.organizationId,
          status: "scheduled",
          scheduledAt: { gte: now, lte: soon },
        },
        orderBy: { scheduledAt: "asc" },
        take: 2,
        select: { id: true, baseContent: true, scheduledAt: true },
      }),
      prisma.mediaAsset.findMany({
        where: { organizationId: ctx.organizationId },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { id: true, storageUrl: true, mimeType: true },
      }),
      prisma.postComment.count({
        where: { organizationId: ctx.organizationId, fetchedAt: { gte: dayAgo } },
      }),
    ]);

  const days = Array.from({ length: 14 }, (_, index) => {
    const date = addUtcDays(chartStart, index);
    return { date: dayKey(date), views: 0, likes: 0, comments: 0, shares: 0, minutes: 0, published: 0 };
  });
  const dayIndex = new Map(days.map((day, index) => [day.date, index]));

  const viewsByAccount = new Map<string, number>();
  const totals = { views: 0, likes: 0, comments: 0, shares: 0, minutes: 0 };
  const previous = { views: 0, likes: 0, comments: 0 };

  for (const snap of snapshots) {
    const key = dayKey(snap.date);
    const index = dayIndex.get(key);
    if (index == null) continue;
    const bucket = days[index];
    if (!bucket) continue;
    bucket.views += snap.views;
    bucket.likes += snap.likes;
    bucket.comments += snap.comments;
    bucket.shares += snap.shares;
    bucket.minutes += snap.estimatedMinutesWatched;

    const current = snap.date >= currentStart;
    if (current) {
      totals.views += snap.views;
      totals.likes += snap.likes;
      totals.comments += snap.comments;
      totals.shares += snap.shares;
      totals.minutes += snap.estimatedMinutesWatched;
      viewsByAccount.set(snap.socialAccountId, (viewsByAccount.get(snap.socialAccountId) ?? 0) + snap.views);
    } else {
      previous.views += snap.views;
      previous.likes += snap.likes;
      previous.comments += snap.comments;
    }
  }

  const publishedPosts = { current: new Set<string>(), previous: new Set<string>() };
  const publishedSeen = new Set<string>();
  for (const target of publishedTargets) {
    if (!target.publishedAt) continue;
    const key = dayKey(target.publishedAt);
    const uniqueKey = `${key}:${target.postId}`;
    if (publishedSeen.has(uniqueKey)) continue;
    publishedSeen.add(uniqueKey);
    const index = dayIndex.get(key);
    if (index == null) continue;
    const bucket = days[index];
    if (!bucket) continue;
    bucket.published += 1;
    if (target.publishedAt >= currentStart) publishedPosts.current.add(target.postId);
    else publishedPosts.previous.add(target.postId);
  }

  const mixCounts = new Map<PostStatus, number>();
  for (const row of postRows) mixCounts.set(row.status, (mixCounts.get(row.status) ?? 0) + 1);

  const attention: HomePayload["attention"] = [];
  for (const target of failedTargets) {
    attention.push({
      id: `fail-${target.id}`,
      tone: "danger",
      title: `${platformLabel(target.platform)} didn't publish`,
      detail: target.errorMessage?.trim() || excerpt(target.post.baseContent, 80),
      href: "/dashboard/posts",
    });
  }
  for (const account of accounts) {
    if (attention.length >= 4) break;
    if (account.status === "active") continue;
    attention.push({
      id: `account-${account.id}`,
      tone: account.status === "expired" || account.status === "error" ? "danger" : "warning",
      title: `${platformLabel(account.platform)} is ${account.status}`,
      detail: account.displayName,
      href: "/dashboard/connections",
    });
  }
  for (const account of accounts) {
    if (attention.length >= 4) break;
    const expires = account.credential?.tokenExpiresAt;
    if (!expires || account.status !== "active") continue;
    if (expires > tokenHorizon) continue;
    const daysLeft = Math.ceil((expires.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    attention.push({
      id: `token-${account.id}`,
      tone: daysLeft <= 1 ? "danger" : "warning",
      title: daysLeft <= 0 ? `${platformLabel(account.platform)} token expired` : `${platformLabel(account.platform)} token expires soon`,
      detail: daysLeft <= 0 ? account.displayName : `${account.displayName} · ${daysLeft} day${daysLeft === 1 ? "" : "s"} left`,
      href: "/dashboard/connections",
    });
  }
  for (const post of scheduledSoon) {
    if (attention.length >= 4) break;
    attention.push({
      id: `sched-${post.id}`,
      tone: "info",
      title: "Going out in the next day",
      detail: excerpt(post.baseContent, 80),
      href: "/dashboard/posts",
    });
  }
  if (recentComments > 0 && attention.length < 4) {
    attention.push({
      id: "comments",
      tone: "info",
      title: recentComments === 1 ? "1 new comment" : `${recentComments} new comments`,
      detail: "Pulled in during the last 24 hours.",
      href: "/dashboard/analytics",
    });
  }

  const liveAccounts = accounts.filter((account) => account.status === "active").length;
  const summary = attention.length
    ? `${liveAccounts} live ${liveAccounts === 1 ? "account" : "accounts"} · ${attention.length} to review`
    : `${liveAccounts} live ${liveAccounts === 1 ? "account" : "accounts"} · queue is clear`;

  const payload: HomePayload = {
    firstName: firstName(user?.name, user?.email),
    organizationName: organization?.name || "Workspace",
    summary,
    accounts: [...accounts]
      .sort((a, b) => {
        const rank = (status: string) => (status === "active" ? 0 : 1);
        return rank(a.status) - rank(b.status) || (viewsByAccount.get(b.id) ?? 0) - (viewsByAccount.get(a.id) ?? 0);
      })
      .map((account) => ({
        id: account.id,
        displayName: account.displayName,
        platform: account.platform,
        platformLabel: platformLabel(account.platform),
        avatarUrl: account.avatarUrl,
        status: account.status,
        views7: viewsByAccount.get(account.id) ?? 0,
      })),
    pulse: {
      views: totals.views,
      previousViews: previous.views,
      likes: totals.likes,
      comments: totals.comments,
      shares: totals.shares,
      minutes: totals.minutes,
    },
    series: days.map((day) => ({ date: day.date, views: day.views })),
    metrics: [
      { key: "views", label: "Views", value: totals.views, previous: previous.views, series: days.map((day) => day.views) },
      { key: "likes", label: "Likes", value: totals.likes, previous: previous.likes, series: days.map((day) => day.likes) },
      { key: "comments", label: "Comments", value: totals.comments, previous: previous.comments, series: days.map((day) => day.comments) },
      {
        key: "published",
        label: "Published",
        value: publishedPosts.current.size,
        previous: publishedPosts.previous.size,
        series: days.map((day) => day.published),
      },
    ],
    attention: attention.slice(0, 4),
    mix: MIX_ORDER.filter((status) => (mixCounts.get(status) ?? 0) > 0 || status === "published" || status === "scheduled" || status === "failed").map(
      (status) => ({ status, label: MIX_LABELS[status], count: mixCounts.get(status) ?? 0 }),
    ),
    posts: recentPosts.map((post) => ({
      id: post.id,
      excerpt: excerpt(post.baseContent),
      status: post.status,
      when: (post.status === "scheduled" && post.scheduledAt ? post.scheduledAt : post.createdAt).toISOString(),
      targets: post.targets.map((target) => ({
        platform: target.platform,
        platformLabel: platformLabel(target.platform),
        status: target.status,
      })),
    })),
    media: media.map((asset) => ({
      id: asset.id,
      url: asset.storageUrl,
      mimeType: asset.mimeType,
      kind: asset.mimeType.startsWith("video/") ? "Video" : asset.mimeType.startsWith("image/") ? "Image" : "File",
    })),
  };

  return <HomeView data={payload} />;
}
