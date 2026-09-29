import Link from "next/link";
import type { Platform } from "@social-suite/core";
import { PlatformIcon } from "../connections/platform-icon";
import type { AccountAnalytics, AccountPreview, AnalyticsContent, PlatformSummary } from "./load";
import {
  ENGAGEMENT_COLOR,
  KIND_LABELS,
  PLATFORM_LABELS,
  TIKTOK_SANDBOX_NOTE,
  type ContentKind,
  type DisplayMetric,
  accountPath,
  contentMetricKeys,
  countLabel,
  engagementSegments,
  formatMetricValue,
  formatWhen,
  metricLabel,
  metricSummary,
  platformPath,
  styleCopy,
  trackedCopy,
  unmeasured,
  weekDelta,
} from "./metrics";

export const cardClass =
  "rounded-2xl border border-white bg-white shadow-[0_10px_30px_-20px_rgba(76,29,149,0.45)]";

export function AccountMark({
  name,
  avatarUrl,
  className = "h-9 w-9",
}: {
  name: string;
  avatarUrl?: string | null;
  className?: string;
}) {
  if (avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={avatarUrl} alt="" className={`${className} rounded-full object-cover`} />;
  }
  const letter = name.replace(/^@/, "").charAt(0).toUpperCase() || "?";
  return (
    <span className={`${className} flex items-center justify-center rounded-full bg-violet-100 text-sm font-medium text-violet-700`}>
      {letter}
    </span>
  );
}

export function Sparkline({ values, className, stretch = false }: { values: number[]; className?: string; stretch?: boolean }) {
  if (values.length < 2) return null;
  const width = 120;
  const height = 36;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * (width - 8) + 4;
    const y = height - 6 - ((value - min) / span) * (height - 12);
    return [x, y] as const;
  });
  const last = points[points.length - 1];
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={className} preserveAspectRatio={stretch ? "none" : "xMidYMid meet"} aria-hidden="true">
      <path d={smoothPath(points)} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" vectorEffect={stretch ? "non-scaling-stroke" : undefined} />
      {last && !stretch && <circle cx={last[0]} cy={last[1]} r="2.3" fill="currentColor" />}
    </svg>
  );
}

function smoothPath(points: ReadonlyArray<readonly [number, number]>): string {
  const first = points[0];
  if (!first) return "";
  let path = `M${first[0]},${first[1]}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[index - 1] ?? points[index];
    const current = points[index];
    const next = points[index + 1];
    const after = points[index + 2] ?? next;
    if (!current || !next || !previous || !after) continue;
    const cp1x = current[0] + (next[0] - previous[0]) / 6;
    const cp1y = current[1] + (next[1] - previous[1]) / 6;
    const cp2x = next[0] - (after[0] - current[0]) / 6;
    const cp2y = next[1] - (after[1] - current[1]) / 6;
    path += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${next[0]},${next[1]}`;
  }
  return path;
}

function Delta({ series }: { series: number[] }) {
  const delta = weekDelta(series);
  if (!delta) return null;
  const tone = delta.tone === "up" ? "text-emerald-600" : delta.tone === "down" ? "text-rose-500" : "text-neutral-400";
  return (
    <p className={`mt-1 text-[11px] font-medium ${tone}`}>
      {delta.text}
      <span className="font-normal text-neutral-400"> vs prior week</span>
    </p>
  );
}

export function MetricGrid({ metrics }: { metrics: DisplayMetric[] }) {
  if (metrics.length === 0) return null;
  const columns = metrics.length >= 4 ? "xl:grid-cols-4" : metrics.length === 3 ? "xl:grid-cols-3" : "xl:grid-cols-2";
  return (
    <div className={`grid grid-cols-2 gap-3 ${columns}`}>
      {metrics.map((metric, index) => (
        <article
          key={metric.key}
          className={
            index === 0
              ? "rounded-2xl bg-gradient-to-br from-violet-200 via-fuchsia-100 to-violet-50 p-4 shadow-[0_10px_30px_-18px_rgba(76,29,149,0.45)]"
              : `${cardClass} p-4`
          }
        >
          <p className={`text-xs font-medium ${index === 0 ? "text-violet-900/70" : "text-neutral-500"}`}>{metric.label}</p>
          <div className="mt-2 flex items-end justify-between gap-3">
            <p className={`text-2xl font-semibold tracking-tight ${index === 0 ? "text-violet-950" : "text-neutral-900"}`}>
              {formatMetricValue(metric.key, metric.value)}
            </p>
            <Sparkline values={metric.series} className={`h-7 w-24 ${index === 0 ? "text-violet-700" : "text-violet-400"}`} />
          </div>
          <Delta series={metric.series} />
        </article>
      ))}
    </div>
  );
}

export function Crumbs({ items }: { items: Array<{ label: string; href?: string }> }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4 flex min-w-0 items-center gap-1.5 text-xs text-neutral-500">
      <Link href="/dashboard/analytics" className="shrink-0 font-medium text-violet-600 hover:text-violet-700">
        Analytics
      </Link>
      {items.map((item) => (
        <span key={`${item.href ?? "current"}-${item.label}`} className="flex min-w-0 items-center gap-1.5">
          <span className="text-neutral-300">/</span>
          {item.href ? (
            <Link href={item.href} className="shrink-0 hover:text-neutral-800">
              {item.label}
            </Link>
          ) : (
            <span className="truncate text-neutral-800">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

function AvatarStack({ accounts }: { accounts: AccountPreview[] }) {
  const shown = accounts.slice(0, 4);
  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {shown.map((account) => (
          <AccountMark key={account.id} name={account.displayName} avatarUrl={account.avatarUrl} className="h-7 w-7 ring-2 ring-white" />
        ))}
      </div>
      {accounts.length > shown.length && (
        <span className="ml-2 text-[11px] text-neutral-400">+{accounts.length - shown.length}</span>
      )}
    </div>
  );
}

export function PlatformBoard({ platforms }: { platforms: PlatformSummary[] }) {
  return (
    <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {platforms.map((item) => {
        const primary = item.metrics[0];
        return (
          <Link
            key={item.platform}
            href={item.accounts.length === 1 ? accountPath(item.platform, item.accounts[0].id) : platformPath(item.platform)}
            className={`group flex flex-col p-4 transition hover:-translate-y-0.5 hover:border-violet-100 ${cardClass}`}
          >
            <div className="flex items-center gap-3">
              <PlatformIcon platform={item.platform} className="h-8 w-8 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-neutral-900">{PLATFORM_LABELS[item.platform]}</span>
                <span className="block text-xs text-neutral-500">
                  {countLabel(item.accounts.length, "account")} · {styleCopy(item.platform)}
                </span>
              </span>
              <span className="text-sm text-neutral-300 transition group-hover:text-violet-500">→</span>
            </div>
            <div className="mt-5 flex items-end justify-between gap-3">
              <AvatarStack accounts={item.accounts} />
              {primary ? (
                <div className="text-right">
                  <p className="text-[11px] text-neutral-500">{primary.label}</p>
                  <p className="text-lg font-semibold tracking-tight text-neutral-900">{formatMetricValue(primary.key, primary.value)}</p>
                </div>
              ) : (
                <p className="max-w-[14rem] text-right text-[11px] leading-4 text-neutral-400">{trackedCopy(item.platform)}</p>
              )}
            </div>
            {primary && primary.series.length > 1 && <Sparkline values={primary.series} stretch className="mt-3 h-8 w-full text-violet-400" />}
          </Link>
        );
      })}
    </div>
  );
}

export function AccountBoard({ platform, accounts }: { platform: Platform; accounts: AccountPreview[] }) {
  if (accounts.length === 0) {
    return (
      <div className={`mt-5 px-5 py-8 text-center ${cardClass}`}>
        <p className="text-sm text-neutral-500">No active {PLATFORM_LABELS[platform]} accounts.</p>
        <Link href="/dashboard/connections" className="mt-2 inline-block text-sm font-medium text-violet-600 hover:text-violet-700">
          Connect an account
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-5 grid gap-3">
      {accounts.map((account) => (
        <Link
          key={account.id}
          href={accountPath(platform, account.id)}
          className={`group flex items-center gap-4 px-4 py-3.5 transition hover:-translate-y-0.5 hover:border-violet-100 ${cardClass}`}
        >
          <AccountMark name={account.displayName} avatarUrl={account.avatarUrl} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-neutral-900">{account.displayName}</span>
            <span className="block text-xs text-neutral-500">
              {account.publishedHere > 0 ? `${countLabel(account.publishedHere, "post")} from Social Suite` : "Open posts"}
            </span>
          </span>
          <span className="hidden items-end gap-5 sm:flex">
            {account.metrics.slice(0, 3).map((metric) => (
              <span key={metric.key} className="text-right">
                <span className="block text-[11px] text-neutral-400">{metric.label}</span>
                <span className="block text-sm font-semibold text-neutral-900">{formatMetricValue(metric.key, metric.value)}</span>
              </span>
            ))}
            <Sparkline values={account.metrics[0]?.series ?? []} className="h-7 w-20 text-violet-400" />
          </span>
          <span className="text-sm text-neutral-300 transition group-hover:text-violet-500">→</span>
        </Link>
      ))}
    </div>
  );
}

const KIND_FILTERS: ContentKind[] = ["video", "short", "image", "text", "live"];

export function AccountStudio({
  platform,
  data,
  kind,
  selected,
  missingItem,
}: {
  platform: Platform;
  data: AccountAnalytics;
  kind: string;
  selected?: AnalyticsContent;
  missingItem?: boolean;
}) {
  const activeKind = KIND_FILTERS.find((item) => item === kind) ?? "all";
  const sandbox = platform === "tiktok" && unmeasured([...data.metrics.map((metric) => metric.value), ...data.contents.flatMap((item) => Object.values(item.metrics))]);

  if (selected) {
    return (
      <ContentAnalysis
        platform={platform}
        account={data.account}
        content={selected}
        kind={activeKind}
        sandbox={platform === "tiktok" && unmeasured(Object.values(selected.metrics))}
      />
    );
  }

  const filtered = activeKind === "all" ? data.contents : data.contents.filter((item) => item.kind === activeKind);
  const available = KIND_FILTERS.filter((item) => data.contents.some((content) => content.kind === item));

  return (
    <div>
      <Crumbs items={[{ label: PLATFORM_LABELS[platform] }, { label: data.account.displayName }]} />
      <div className="flex items-center gap-3">
        <AccountMark name={data.account.displayName} avatarUrl={data.account.avatarUrl} className="h-10 w-10" />
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold text-neutral-900">{data.account.displayName}</h1>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-neutral-500">
            <PlatformIcon platform={platform} className="h-4 w-4" />
            {PLATFORM_LABELS[platform]} · {styleCopy(platform)}
          </p>
        </div>
      </div>

      {data.metrics.length > 0 && (
        <div className="mt-5">
          <MetricGrid metrics={data.metrics} />
        </div>
      )}
      {sandbox && <p className="mt-3 text-xs leading-5 text-neutral-500">{TIKTOK_SANDBOX_NOTE}</p>}
      {data.warning && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{data.warning}</p>}
      {missingItem && <p className="mt-3 text-xs text-neutral-500">That post is no longer in this view.</p>}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-neutral-900">Posts</h2>
        {available.length > 1 && (
          <div className={`flex flex-wrap gap-1 p-1 ${cardClass}`}>
            <FilterChip href={accountPath(platform, data.account.id)} active={activeKind === "all"} label="All" />
            {available.map((item) => (
              <FilterChip
                key={item}
                href={accountPath(platform, data.account.id, { kind: item })}
                active={activeKind === item}
                label={KIND_LABELS[item]}
              />
            ))}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className={`mt-3 px-5 py-8 text-center ${cardClass}`}>
          <p className="text-sm text-neutral-500">{data.contents.length === 0 ? "No published posts on this account yet." : "No posts in this view."}</p>
          {data.contents.length === 0 && (
            <Link href="/dashboard/posts" className="mt-2 inline-block text-sm font-medium text-violet-600 hover:text-violet-700">
              Create a post
            </Link>
          )}
        </div>
      ) : (
        <ContentSections platform={platform} accountId={data.account.id} contents={filtered} kind={activeKind} />
      )}
      {data.truncated && <p className="mt-3 text-xs text-neutral-400">Showing the latest 36 posts.</p>}
    </div>
  );
}

function FilterChip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 text-xs font-medium ${active ? "bg-violet-50 text-violet-700" : "text-neutral-500 hover:text-neutral-800"}`}
    >
      {label}
    </Link>
  );
}

function ContentSections({
  platform,
  accountId,
  contents,
  kind,
}: {
  platform: Platform;
  accountId: string;
  contents: AnalyticsContent[];
  kind: string;
}) {
  const text = contents.filter((item) => item.kind === "text");
  const groups = (["video", "short", "image", "live"] as const)
    .map((itemKind) => ({ itemKind, items: contents.filter((item) => item.kind === itemKind) }))
    .filter((group) => group.items.length > 0);
  const showHeadings = groups.length + (text.length > 0 ? 1 : 0) > 1;

  return (
    <div className="mt-3 space-y-5">
      {groups.map((group) => (
        <section key={group.itemKind}>
          {showHeadings && <h3 className="mb-2 text-xs font-medium text-neutral-500">{sectionTitle(group.itemKind)}</h3>}
          <div className={gridFor(group.itemKind)}>
            {group.items.map((item) => (
              <MediaCard key={item.id} platform={platform} accountId={accountId} content={item} kind={kind} />
            ))}
          </div>
        </section>
      ))}
      {text.length > 0 && (
        <section>
          {showHeadings && <h3 className="mb-2 text-xs font-medium text-neutral-500">Posts</h3>}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {text.map((item) => (
              <TextCard key={item.id} platform={platform} accountId={accountId} content={item} kind={kind} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function sectionTitle(kind: ContentKind): string {
  if (kind === "short") return "Shorts";
  if (kind === "image") return "Images";
  if (kind === "live") return "Live";
  return "Videos";
}

function gridFor(kind: ContentKind): string {
  if (kind === "short") return "grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5";
  if (kind === "image") return "grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4";
  return "grid grid-cols-2 gap-3 xl:grid-cols-3";
}

function MediaCard({
  platform,
  accountId,
  content,
  kind,
}: {
  platform: Platform;
  accountId: string;
  content: AnalyticsContent;
  kind: string;
}) {
  const aspect = content.kind === "short" ? "aspect-[3/4]" : content.kind === "image" ? "aspect-square" : "aspect-video";
  return (
    <Link href={accountPath(platform, accountId, { item: content.id, kind })} className={`group p-2.5 transition hover:-translate-y-0.5 hover:border-violet-100 ${cardClass}`}>
      <div className={`relative overflow-hidden rounded-xl bg-gradient-to-br from-violet-100 via-fuchsia-50 to-violet-50 ${aspect}`}>
        {content.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={content.thumbnailUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full items-center justify-center">
            <PlatformIcon platform={platform} className="h-8 w-8 opacity-80" />
          </span>
        )}
        <span className="absolute top-2 left-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-medium text-neutral-600">
          {KIND_LABELS[content.kind]}
        </span>
      </div>
      <p className="mt-2 line-clamp-2 text-sm font-medium text-neutral-900 group-hover:text-violet-700">{content.title}</p>
      <p className="mt-1 text-[11px] text-neutral-500">{metricSummary(platform, content.kind, content.metrics)}</p>
    </Link>
  );
}

function TextCard({
  platform,
  accountId,
  content,
  kind,
}: {
  platform: Platform;
  accountId: string;
  content: AnalyticsContent;
  kind: string;
}) {
  return (
    <Link href={accountPath(platform, accountId, { item: content.id, kind })} className={`group flex flex-col p-4 transition hover:-translate-y-0.5 hover:border-violet-100 ${cardClass}`}>
      <span className="flex items-center justify-between text-[11px] text-neutral-400">
        <span>{KIND_LABELS[content.kind]}</span>
        <span>{formatWhen(content.publishedAt)}</span>
      </span>
      <p className="mt-2 line-clamp-4 flex-1 text-sm leading-5 text-neutral-800 group-hover:text-violet-800">{content.excerpt}</p>
      {content.thumbnailUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={content.thumbnailUrl} alt="" className="mt-3 h-28 w-full rounded-xl object-cover" />
      )}
      <p className="mt-3 border-t border-neutral-100 pt-3 text-[11px] text-neutral-500">{metricSummary(platform, content.kind, content.metrics)}</p>
    </Link>
  );
}

function ContentAnalysis({
  platform,
  account,
  content,
  kind,
  sandbox,
}: {
  platform: Platform;
  account: AccountPreview;
  content: AnalyticsContent;
  kind: string;
  sandbox: boolean;
}) {
  const keys = contentMetricKeys(platform, content.kind, content.metrics);
  const cards: DisplayMetric[] = keys.map((key) => ({
    key,
    label: metricLabel(platform, key),
    value: content.metrics[key],
    series: content.series[key] ?? [],
  }));
  const segments = engagementSegments(content.metrics);
  const historyKey = keys.find((key) => (content.series[key]?.length ?? 0) >= 2);
  const history = historyKey ? [...content.captures].reverse().slice(0, 6) : [];

  return (
    <div>
      <Crumbs
        items={[
          { label: PLATFORM_LABELS[platform] },
          { label: account.displayName, href: accountPath(platform, account.id, { kind }) },
          { label: content.title },
        ]}
      />
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]">
        <article className={`p-3 ${cardClass}`}>
          <div className="overflow-hidden rounded-xl bg-gradient-to-br from-violet-100 via-fuchsia-50 to-violet-50">
            {content.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={content.thumbnailUrl} alt="" className="aspect-[4/5] w-full object-cover" />
            ) : (
              <div className="flex aspect-[4/5] items-end p-6">
                <p className="line-clamp-8 text-sm leading-6 text-violet-950/80">{content.excerpt}</p>
              </div>
            )}
          </div>
          <div className="px-1.5 pt-3 pb-1">
            <div className="flex items-center justify-between text-[11px] text-neutral-400">
              <span>{KIND_LABELS[content.kind]}</span>
              <span>{formatWhen(content.publishedAt, true)}</span>
            </div>
            <h1 className="mt-1.5 text-sm font-semibold text-neutral-900">{content.title}</h1>
            {content.excerpt !== content.title && <p className="mt-2 line-clamp-3 text-xs leading-5 text-neutral-500">{content.excerpt}</p>}
            {content.url && (
              <a href={content.url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs font-medium text-violet-600 hover:text-violet-700">
                Open on {PLATFORM_LABELS[platform]}
              </a>
            )}
          </div>
        </article>

        <div>
          <MetricGrid metrics={cards} />
          {sandbox && <p className="mt-3 text-xs leading-5 text-neutral-500">{TIKTOK_SANDBOX_NOTE}</p>}
          <div className={`mt-3 grid gap-3 ${history.length > 0 ? "lg:grid-cols-2" : ""}`}>
            <section className={`p-4 ${cardClass}`}>
              <p className="text-xs font-medium text-neutral-500">Engagement</p>
              {segments.length === 0 ? (
                <p className="mt-4 text-sm text-neutral-400">No engagement yet.</p>
              ) : (
                <>
                  <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-violet-50">
                    {segments.map((segment) => (
                      <span key={segment.key} style={{ width: `${segment.pct}%`, background: ENGAGEMENT_COLOR[segment.key] }} />
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {segments.map((segment) => (
                      <span key={segment.key} className="rounded-full bg-violet-50 px-2 py-1 text-[11px] text-neutral-600">
                        {metricLabel(platform, segment.key)} {segment.pct}%
                      </span>
                    ))}
                  </div>
                </>
              )}
            </section>
            {historyKey && history.length > 0 && (
              <section className={`p-4 ${cardClass}`}>
                <p className="text-xs font-medium text-neutral-500">{metricLabel(platform, historyKey)} history</p>
                <ul className="mt-3 space-y-2">
                  {history.map((capture) => (
                    <li key={capture.at} className="flex items-center justify-between text-xs">
                      <span className="text-neutral-400">{formatWhen(capture.at, true)}</span>
                      <span className="font-medium text-neutral-800">{formatMetricValue(historyKey, capture.metrics[historyKey])}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function EmptyAnalytics() {
  return (
    <div className={`mt-5 px-5 py-8 text-center ${cardClass}`}>
      <p className="text-sm text-neutral-500">No connected accounts yet.</p>
      <Link href="/dashboard/connections" className="mt-2 inline-block text-sm font-medium text-violet-600 hover:text-violet-700">
        Connect an account
      </Link>
    </div>
  );
}

