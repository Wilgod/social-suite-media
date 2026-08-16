import { prisma } from "@social-suite/db";
import { getAdapter, hasAdapter } from "@social-suite/platforms";
import type { ContentFormatStat, ContentItem } from "@social-suite/core";
import { requireTenantContext } from "@/lib/tenant";
import { getValidAccessToken } from "@/lib/access-token";
import { TrendBars } from "../_components/trend-bars";

const PLATFORM_LABELS: Record<string, string> = {
  youtube: "YouTube",
  facebook: "Facebook",
  instagram: "Instagram",
  threads: "Threads",
  x: "X",
};

const FORMAT_LABELS: Record<ContentFormatStat["contentFormat"], string> = {
  short: "Shorts",
  video: "Videos",
  live: "Live streams",
  unspecified: "Other (e.g. channel page)",
};

const FORMAT_BREAKDOWN_WINDOW_DAYS = 30;

export default async function AnalyticsPage() {
  const ctx = await requireTenantContext();

  const accounts = await prisma.socialAccount.findMany({
    where: { organizationId: ctx.organizationId, status: "active" },
    orderBy: { connectedAt: "asc" },
    include: { credential: true },
  });

  const snapshots = await prisma.analyticsSnapshot.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { date: "asc" },
  });

  const snapshotsByAccount = new Map<string, typeof snapshots>();
  for (const snap of snapshots) {
    const list = snapshotsByAccount.get(snap.socialAccountId) ?? [];
    list.push(snap);
    snapshotsByAccount.set(snap.socialAccountId, list);
  }

  const videosByAccount = new Map<string, ContentItem[]>();
  const formatBreakdownByAccount = new Map<string, ContentFormatStat[]>();
  for (const account of accounts) {
    if (!account.credential || !hasAdapter(account.platform)) continue;
    const adapter = getAdapter(account.platform);
    if (!adapter.listContent && !adapter.fetchContentFormatBreakdown) continue;

    try {
      const accessToken = await getValidAccessToken(ctx.organizationId, account.platform, account.credential);

      if (adapter.listContent) {
        videosByAccount.set(account.id, await adapter.listContent(accessToken, 12));
      }

      if (adapter.fetchContentFormatBreakdown) {
        const since = new Date();
        since.setUTCDate(since.getUTCDate() - FORMAT_BREAKDOWN_WINDOW_DAYS);
        formatBreakdownByAccount.set(account.id, await adapter.fetchContentFormatBreakdown(accessToken, since));
      }
    } catch (err) {
      console.error(`Failed to load content details for ${account.platform} account ${account.id}`, err);
    }
  }

  return (
    <div className="max-w-4xl p-8">
      <h1 className="text-lg font-semibold text-neutral-900">Analytics</h1>
      <p className="mt-1 text-sm text-neutral-500">Full history across your connected accounts.</p>

      {accounts.length === 0 && (
        <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-8 text-center">
          <p className="text-sm text-neutral-500">No connected accounts yet.</p>
          <a href="/dashboard/connections" className="mt-2 inline-block text-sm font-medium text-violet-600 hover:text-violet-700">
            Connect an account →
          </a>
        </div>
      )}

      <div className="mt-6 space-y-6">
        {accounts.map((account) => {
          const accountSnapshots = snapshotsByAccount.get(account.id) ?? [];
          const videos = videosByAccount.get(account.id) ?? [];
          const formatBreakdown = (formatBreakdownByAccount.get(account.id) ?? []).filter(
            (f) => f.views > 0 || f.subscribersGained > 0 || f.subscribersLost > 0,
          );

          const totals = accountSnapshots.reduce(
            (acc, s) => ({
              views: acc.views + s.views,
              likes: acc.likes + s.likes,
              comments: acc.comments + s.comments,
              netSubscribers: acc.netSubscribers + s.subscribersGained - s.subscribersLost,
              minutesWatched: acc.minutesWatched + s.estimatedMinutesWatched,
            }),
            { views: 0, likes: 0, comments: 0, netSubscribers: 0, minutesWatched: 0 },
          );

          const viewsTrend = accountSnapshots.map((s) => ({
            date: s.date.toISOString().slice(0, 10),
            value: s.views,
          }));

          return (
            <div key={account.id} className="rounded-2xl border border-neutral-200 bg-white p-5">
              <div className="flex items-center gap-2.5">
                {account.avatarUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={account.avatarUrl} alt="" className="h-8 w-8 rounded-full" />
                )}
                <div>
                  <p className="text-sm font-semibold text-neutral-900">{account.displayName}</p>
                  <p className="text-xs text-neutral-500">{PLATFORM_LABELS[account.platform] ?? account.platform}</p>
                </div>
              </div>

              {accountSnapshots.length === 0 ? (
                <p className="mt-4 text-sm text-neutral-400">
                  No stats yet. Stats sync automatically once a day, or right after connecting.
                </p>
              ) : (
                <>
                  <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <Stat label="Views" value={totals.views.toLocaleString()} />
                    <Stat label="Likes" value={totals.likes.toLocaleString()} />
                    <Stat label="Comments" value={totals.comments.toLocaleString()} />
                    <Stat
                      label="Net subscribers"
                      value={`${totals.netSubscribers >= 0 ? "+" : ""}${totals.netSubscribers.toLocaleString()}`}
                    />
                  </div>

                  <div className="mt-5">
                    <p className="text-xs font-medium text-neutral-500">Views trend</p>
                    <div className="mt-2">
                      <TrendBars data={viewsTrend} />
                    </div>
                  </div>
                </>
              )}

              {formatBreakdown.length > 0 && (
                <div className="mt-5">
                  <p className="text-xs font-medium text-neutral-500">
                    Views & subscribers by format (last {FORMAT_BREAKDOWN_WINDOW_DAYS} days)
                  </p>
                  <div className="mt-2 space-y-2">
                    {formatBreakdown.map((f) => {
                      const net = f.subscribersGained - f.subscribersLost;
                      return (
                        <div
                          key={f.contentFormat}
                          className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2 text-sm"
                        >
                          <span className="font-medium text-neutral-700">{FORMAT_LABELS[f.contentFormat]}</span>
                          <span className="text-neutral-500">
                            {f.views.toLocaleString()} views ·{" "}
                            <span className={net >= 0 ? "text-green-700" : "text-red-600"}>
                              {net >= 0 ? "+" : ""}
                              {net.toLocaleString()} subs
                            </span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {(() => {
                const shorts = videos.filter((v) => v.isShortForm);
                const longForm = videos.filter((v) => !v.isShortForm);
                return (
                  <>
                    {longForm.length > 0 && (
                      <VideoSection title="Recent videos" videos={longForm} aspect="aspect-video" columns="grid-cols-2 sm:grid-cols-3" />
                    )}
                    {shorts.length > 0 && (
                      <VideoSection title="Recent Shorts" videos={shorts} aspect="aspect-[9/16]" columns="grid-cols-3 sm:grid-cols-5" />
                    )}
                  </>
                );
              })()}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-0.5 text-xl font-semibold text-neutral-900">{value}</p>
    </div>
  );
}

function VideoSection({
  title,
  videos,
  aspect,
  columns,
}: {
  title: string;
  videos: ContentItem[];
  aspect: string;
  columns: string;
}) {
  return (
    <div className="mt-6 border-t border-neutral-100 pt-5">
      <p className="text-xs font-medium text-neutral-500">{title}</p>
      <div className={`mt-3 grid ${columns} gap-3`}>
        {videos.map((video) => (
          <a
            key={video.externalId}
            href={video.url}
            target="_blank"
            rel="noreferrer"
            className="group rounded-lg border border-neutral-100 p-2 transition hover:border-violet-200 hover:bg-violet-50"
          >
            {video.thumbnailUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={video.thumbnailUrl} alt="" className={`${aspect} w-full rounded-md object-cover`} />
            )}
            <p className="mt-2 line-clamp-2 text-xs font-medium text-neutral-900 group-hover:text-violet-700">
              {video.title}
            </p>
            <p className="mt-1 text-[11px] text-neutral-500">
              {video.views !== undefined ? `${video.views.toLocaleString()} views` : ""}
            </p>
          </a>
        ))}
      </div>

      <details className="mt-3">
        <summary className="cursor-pointer text-[11px] font-medium text-violet-600 hover:text-violet-700">
          View as table
        </summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-neutral-500">
                <th className="py-1.5 pr-3 font-medium">Title</th>
                <th className="py-1.5 px-3 text-right font-medium">Views</th>
                <th className="py-1.5 px-3 text-right font-medium">Likes</th>
                <th className="py-1.5 pl-3 text-right font-medium">Comments</th>
              </tr>
            </thead>
            <tbody>
              {videos.map((video) => (
                <tr key={video.externalId} className="border-b border-neutral-100">
                  <td className="py-1.5 pr-3 text-neutral-900">
                    <a href={video.url} target="_blank" rel="noreferrer" className="line-clamp-1 hover:text-violet-700">
                      {video.title}
                    </a>
                  </td>
                  <td className="py-1.5 px-3 text-right text-neutral-700">{video.views?.toLocaleString() ?? "—"}</td>
                  <td className="py-1.5 px-3 text-right text-neutral-700">{video.likes?.toLocaleString() ?? "—"}</td>
                  <td className="py-1.5 pl-3 text-right text-neutral-700">{video.comments?.toLocaleString() ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
