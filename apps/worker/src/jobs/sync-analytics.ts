import { prisma } from "@social-suite/db";
import { getAdapter, hasAdapter } from "@social-suite/platforms";
import { PLATFORMS } from "@social-suite/core";
import { getValidAccessToken } from "../lib/access-token";

const BACKFILL_DAYS = 30;

/** Runs on a daily schedule; syncs performance stats for every connected account whose adapter supports it. */
export async function handleSyncAnalytics(): Promise<void> {
  const statsCapablePlatforms = PLATFORMS.filter((platform) => hasAdapter(platform) && getAdapter(platform).fetchDailyStats);
  if (statsCapablePlatforms.length === 0) return;

  const accounts = await prisma.socialAccount.findMany({
    where: { status: "active", platform: { in: statsCapablePlatforms } },
    include: { credential: true },
  });

  for (const account of accounts) {
    if (!account.credential) continue;

    try {
      const adapter = getAdapter(account.platform);
      if (!adapter.fetchDailyStats) continue;

      const accessToken = await getValidAccessToken(account.organizationId, account.platform, account.credential);

      const latest = await prisma.analyticsSnapshot.findFirst({
        where: { socialAccountId: account.id },
        orderBy: { date: "desc" },
      });

      const since = new Date();
      if (latest) {
        since.setTime(latest.date.getTime());
        since.setUTCDate(since.getUTCDate() + 1);
      } else {
        since.setUTCDate(since.getUTCDate() - BACKFILL_DAYS);
      }

      const stats = await adapter.fetchDailyStats(accessToken, since);

      for (const stat of stats) {
        const date = new Date(`${stat.date}T00:00:00.000Z`);
        await prisma.analyticsSnapshot.upsert({
          where: { socialAccountId_date: { socialAccountId: account.id, date } },
          create: {
            organizationId: account.organizationId,
            socialAccountId: account.id,
            date,
            views: stat.views,
            likes: stat.likes,
            comments: stat.comments,
            subscribersGained: stat.subscribersGained,
            subscribersLost: stat.subscribersLost,
            estimatedMinutesWatched: stat.estimatedMinutesWatched,
          },
          update: {
            views: stat.views,
            likes: stat.likes,
            comments: stat.comments,
            subscribersGained: stat.subscribersGained,
            subscribersLost: stat.subscribersLost,
            estimatedMinutesWatched: stat.estimatedMinutesWatched,
          },
        });
      }
    } catch (err) {
      console.error(`Analytics sync failed for ${account.platform} account ${account.id}`, err);
    }
  }
}
