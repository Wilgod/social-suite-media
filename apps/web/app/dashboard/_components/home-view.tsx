"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

export type HomePayload = {
  firstName: string;
  organizationName: string;
  summary: string;
  accounts: AccountCard[];
  pulse: { views: number; previousViews: number; likes: number; comments: number; shares: number; minutes: number };
  series: { date: string; views: number }[];
  metrics: { key: string; label: string; value: number; previous: number; series: number[] }[];
  attention: { id: string; tone: "danger" | "warning" | "info"; title: string; detail: string; href: string }[];
  mix: { status: string; label: string; count: number }[];
  posts: { id: string; excerpt: string; status: string; when: string; targets: { platform: string; platformLabel: string; status: string }[] }[];
  media: { id: string; url: string; mimeType: string; kind: string }[];
};

type AccountCard = {
  id: string;
  displayName: string;
  platform: string;
  platformLabel: string;
  avatarUrl: string | null;
  status: string;
  views7: number;
};

const PLATFORM_INK: Record<string, string> = {
  youtube: "#ef4444",
  facebook: "#2563eb",
  instagram: "#db2777",
  threads: "#171717",
  x: "#171717",
  tiktok: "#0891b2",
  douyin: "#171717",
  bilibili: "#0284c7",
  weibo: "#ea580c",
  xiaohongshu: "#e11d48",
};

const METRIC_INK: Record<string, string> = {
  views: "#6d28d9",
  likes: "#e11d48",
  comments: "#0284c7",
  published: "#059669",
};

const STATUS_PILL: Record<string, string> = {
  draft: "bg-neutral-100 text-neutral-600",
  scheduled: "bg-violet-50 text-violet-700",
  publishing: "bg-amber-50 text-amber-700",
  partially_published: "bg-amber-50 text-amber-700",
  published: "bg-emerald-50 text-emerald-700",
  failed: "bg-rose-50 text-rose-700",
  canceled: "bg-neutral-100 text-neutral-400",
  pending: "bg-neutral-100 text-neutral-500",
  queued: "bg-neutral-100 text-neutral-500",
  success: "bg-emerald-50 text-emerald-700",
  skipped: "bg-neutral-100 text-neutral-400",
  active: "bg-emerald-50 text-emerald-700",
  expired: "bg-rose-50 text-rose-700",
  revoked: "bg-neutral-100 text-neutral-500",
  error: "bg-rose-50 text-rose-700",
};

const TONE_STYLE = {
  danger: "border-rose-200 bg-rose-50/80 text-rose-700",
  warning: "border-amber-200 bg-amber-50/80 text-amber-800",
  info: "border-violet-200 bg-violet-50/80 text-violet-800",
};

export function HomeView({ data }: { data: HomePayload }) {
  return (
    <div className="relative min-h-full overflow-hidden bg-[radial-gradient(900px_circle_at_0%_-10%,rgba(167,139,250,0.18),transparent_42%),radial-gradient(700px_circle_at_100%_0%,rgba(251,207,232,0.28),transparent_36%),linear-gradient(180deg,#f7f6fb_0%,#f4f4f5_100%)]">
      <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-5 px-5 py-6 sm:px-7 lg:px-8 lg:py-8">
        <Hero data={data} />
        <div className="grid items-start gap-5 xl:grid-cols-12">
          <Pulse data={data} />
          <div className="flex flex-col gap-5 xl:col-span-4">
            <Attention items={data.attention} />
            <Mix mix={data.mix} />
          </div>
        </div>
        <section className="ss-rise grid gap-4 sm:grid-cols-2 xl:grid-cols-4" style={{ animationDelay: "140ms" }}>
          {data.metrics.map((metric, index) => (
            <MetricCard key={metric.key} metric={metric} delay={index * 70} />
          ))}
        </section>
        <div className="grid items-start gap-5 xl:grid-cols-12">
          <Posts posts={data.posts} />
          <div className="flex flex-col gap-5 xl:col-span-5">
            <Accounts accounts={data.accounts} />
            <Media media={data.media} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Hero({ data }: { data: HomePayload }) {
  const faces = data.accounts.slice(0, 5);
  const extra = Math.max(0, data.accounts.length - faces.length);

  return (
    <div className="ss-rise rounded-[28px] bg-gradient-to-br from-violet-300 via-fuchsia-200 to-amber-100 p-px shadow-[0_30px_80px_-40px_rgba(91,33,182,0.7)]">
      <section className="relative overflow-hidden rounded-[27px] bg-neutral-950 px-6 py-7 text-white sm:px-8 sm:py-8">
        <div className="ss-drift pointer-events-none absolute -top-20 -right-8 h-64 w-64 rounded-full bg-violet-500/40 blur-3xl" />
        <div className="ss-drift pointer-events-none absolute -bottom-24 left-16 h-56 w-56 rounded-full bg-fuchsia-500/25 blur-3xl" style={{ animationDelay: "-7s" }} />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,transparent_0%,rgba(255,255,255,0.04)_42%,transparent_43%)]" />

        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <p className="text-[11px] font-medium tracking-[0.22em] text-white/45 uppercase">{data.organizationName}</p>
            <Greeting name={data.firstName} />
            <p className="mt-3 max-w-md text-sm leading-6 text-white/65">{data.summary}</p>
            <div className="mt-6 flex items-center gap-4">
              <div className="flex -space-x-2">
                {faces.length === 0 && (
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/10 text-xs text-white/70">—</span>
                )}
                {faces.map((account) => (
                  <Avatar key={account.id} account={account} className="h-9 w-9 border-2 border-neutral-950" />
                ))}
                {extra > 0 && (
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-neutral-950 bg-white/10 text-xs font-medium text-white">
                    +{extra}
                  </span>
                )}
              </div>
              <p className="text-xs text-white/50">{data.accounts.length === 0 ? "No accounts yet" : `${data.accounts.length} connected`}</p>
            </div>
            <div className="mt-7 flex flex-wrap gap-2.5">
              <Link
                href="/dashboard/posts"
                className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-white px-4 py-2.5 text-sm font-medium text-neutral-950 shadow-lg shadow-black/20 transition duration-300 hover:-translate-y-0.5 hover:shadow-xl"
              >
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-violet-200/70 to-transparent transition duration-700 group-hover:translate-x-full" />
                <span className="relative">New post</span>
                <span className="relative transition group-hover:translate-x-0.5">→</span>
              </Link>
              <Link
                href="/dashboard/connections"
                className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/90 backdrop-blur-sm transition duration-300 hover:-translate-y-0.5 hover:bg-white/10"
              >
                Connections
              </Link>
            </div>
          </div>
          <Clock />
        </div>
      </section>
    </div>
  );
}

function Greeting({ name }: { name: string }) {
  const now = useNow();
  const hour = now?.getHours() ?? -1;
  const greeting = hour < 0 ? "Welcome back" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
      {greeting},
      <span className="block bg-gradient-to-r from-white via-violet-100 to-fuchsia-200 bg-clip-text text-transparent">{name}</span>
    </h1>
  );
}

function Clock() {
  const now = useNow();
  const time = now
    ? now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })
    : "--:--:--";
  const date = now
    ? now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })
    : "Local time";

  return (
    <div className="w-full max-w-[260px] rounded-2xl border border-white/10 bg-white/10 px-4 py-4 shadow-inner backdrop-blur-md">
      <div className="flex items-center gap-2 text-[11px] font-medium tracking-[0.16em] text-white/45 uppercase">
        <span className="relative flex h-2 w-2">
          <span className="ss-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300" />
        </span>
        Live
      </div>
      <p className="mt-2 font-mono text-4xl tracking-tight text-white tabular-nums">{time}</p>
      <p className="mt-1 text-sm text-white/60">{date}</p>
    </div>
  );
}

function Pulse({ data }: { data: HomePayload }) {
  const [hover, setHover] = useState<number | null>(null);
  const geometry = useMemo(() => buildChart(data.series.map((point) => point.views), 640, 188), [data.series]);
  const active = hover ?? data.series.length - 1;
  const point = geometry.points[active];

  return (
    <section className="ss-rise rounded-[28px] border border-white/80 bg-white/90 p-5 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.45)] backdrop-blur-sm sm:p-6 xl:col-span-8" style={{ animationDelay: "80ms" }}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-neutral-500">Views · last 7 days</p>
          <div className="mt-1 flex flex-wrap items-end gap-3">
            <p className="text-4xl font-semibold tracking-tight text-neutral-950 tabular-nums">
              <CountUp value={data.pulse.views} />
            </p>
            <Delta current={data.pulse.views} previous={data.pulse.previousViews} />
          </div>
        </div>
        <p className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-medium text-violet-700">14-day trend</p>
      </div>

      <div className="relative mt-5" onMouseLeave={() => setHover(null)}>
        <svg
          viewBox="0 0 640 188"
          className="block h-auto w-full cursor-crosshair"
          role="img"
          aria-label="Views over the last 14 days"
          onMouseMove={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            const ratio = (event.clientX - rect.left) / rect.width;
            const index = Math.round(ratio * (data.series.length - 1));
            setHover(Math.max(0, Math.min(data.series.length - 1, index)));
          }}
        >
          <defs>
            <linearGradient id="home-views-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 1, 2, 3].map((row) => (
            <line key={row} x1="0" x2="640" y1={row * 47} y2={row * 47} stroke="#f0eef5" strokeWidth="1" />
          ))}
          <path d={geometry.area} fill="url(#home-views-fill)" className="ss-fade" />
          <path d={geometry.line} fill="none" stroke="#6d28d9" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" pathLength={1} className="ss-draw" />
        </svg>
        {point && (
          <div
            className="pointer-events-none absolute"
            style={{ left: `${(point.x / 640) * 100}%`, top: `${(point.y / 188) * 100}%` }}
          >
            {hover != null && (
              <div className="absolute bottom-3 left-0 -translate-x-1/2 rounded-full bg-neutral-950 px-2.5 py-1 text-[11px] font-medium whitespace-nowrap text-white shadow-lg">
                {formatDay(data.series[active]?.date ?? "")} · {(data.series[active]?.views ?? 0).toLocaleString()}
              </div>
            )}
            <span className="absolute top-0 left-0 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-violet-600 shadow-[0_0_0_6px_rgba(124,58,237,0.15)]" />
          </div>
        )}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-neutral-400">
        <span>{formatDay(data.series[0]?.date ?? "")}</span>
        <span>{formatDay(data.series[Math.floor((data.series.length - 1) / 2)]?.date ?? "")}</span>
        <span>{formatDay(data.series[data.series.length - 1]?.date ?? "")}</span>
      </div>
      {data.pulse.views + data.pulse.previousViews === 0 && (
        <p className="mt-3 text-xs text-neutral-400">Daily snapshots appear after the worker collects them. The line stays flat until then.</p>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3 border-t border-neutral-100 pt-4 sm:grid-cols-4">
        <Mini label="Likes" value={data.pulse.likes} />
        <Mini label="Comments" value={data.pulse.comments} />
        <Mini label="Shares" value={data.pulse.shares} />
        <Mini label="Watch time" value={data.pulse.minutes} suffix=" min" />
      </div>
    </section>
  );
}

function Attention({ items }: { items: HomePayload["attention"] }) {
  return (
    <section className="ss-rise rounded-[28px] border border-white/80 bg-white/90 p-5 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.35)] backdrop-blur-sm" style={{ animationDelay: "120ms" }}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-900">Needs you</h2>
        <span className="text-[11px] font-medium text-neutral-400">{items.length === 0 ? "Clear" : `${items.length} open`}</span>
      </div>
      {items.length === 0 ? (
        <div className="mt-4 overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white px-4 py-5">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="ss-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            <p className="text-sm font-medium text-emerald-800">All clear</p>
          </div>
          <p className="mt-2 text-sm leading-6 text-emerald-700/80">No failed publishes, expiring tokens, or posts due in the next day.</p>
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <Link href={item.href} className={`block rounded-2xl border px-3.5 py-3 transition duration-300 hover:-translate-y-0.5 ${TONE_STYLE[item.tone]}`}>
                <p className="text-sm font-medium">{item.title}</p>
                <p className="mt-0.5 line-clamp-2 text-xs opacity-80">{item.detail}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Mix({ mix }: { mix: HomePayload["mix"] }) {
  const max = Math.max(1, ...mix.map((item) => item.count));
  return (
    <section className="ss-rise rounded-[28px] border border-white/80 bg-white/90 p-5 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.35)] backdrop-blur-sm" style={{ animationDelay: "180ms" }}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-900">Pipeline</h2>
        <Link href="/dashboard/posts" className="text-xs font-medium text-violet-600 transition hover:text-violet-700">Open posts</Link>
      </div>
      <ul className="mt-4 space-y-3">
        {mix.map((item, index) => (
          <li key={item.status}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium text-neutral-600">{item.label}</span>
              <span className="tabular-nums text-neutral-400">{item.count}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100">
              <div
                className="ss-bar h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-400"
                style={{ width: `${(item.count / max) * 100}%`, animationDelay: `${index * 80}ms`, opacity: item.count === 0 ? 0.25 : 1 }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function MetricCard({ metric, delay }: { metric: HomePayload["metrics"][number]; delay: number }) {
  const color = METRIC_INK[metric.key] ?? "#6d28d9";
  return (
    <article
      className="ss-rise group rounded-[24px] border border-white/80 bg-white/90 p-4 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.45)] backdrop-blur-sm transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_44px_-28px_rgba(76,29,149,0.45)]"
      style={{ animationDelay: `${180 + delay}ms` }}
    >
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-neutral-500">{metric.label}</p>
        <Spark values={metric.series} color={color} />
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950 tabular-nums">
        <CountUp value={metric.value} />
      </p>
      <div className="mt-1">
        <Delta current={metric.value} previous={metric.previous} />
        <span className="ml-1.5 text-[11px] text-neutral-400">vs prior 7 days</span>
      </div>
    </article>
  );
}

function Posts({ posts }: { posts: HomePayload["posts"] }) {
  return (
    <section className="ss-rise rounded-[28px] border border-white/80 bg-white/90 p-5 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.35)] backdrop-blur-sm sm:p-6 xl:col-span-7" style={{ animationDelay: "220ms" }}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">Recent posts</h2>
          <p className="mt-0.5 text-xs text-neutral-400">Latest drafts, schedules, and publishes.</p>
        </div>
        <Link href="/dashboard/posts" className="text-xs font-medium text-violet-600 transition hover:text-violet-700">View all</Link>
      </div>
      {posts.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/80 px-4 py-10 text-center">
          <p className="text-sm font-medium text-neutral-700">Nothing published yet</p>
          <p className="mt-1 text-sm text-neutral-500">Write once, then send it to every connected account.</p>
          <Link href="/dashboard/posts" className="mt-4 inline-flex rounded-full bg-neutral-950 px-3.5 py-2 text-xs font-medium text-white transition hover:-translate-y-0.5">
            Compose a post
          </Link>
        </div>
      ) : (
        <ol className="mt-2">
          {posts.map((post, index) => (
            <li key={post.id} className="relative flex gap-4 py-4" style={{ animationDelay: `${260 + index * 50}ms` }}>
              <div className="flex w-16 shrink-0 flex-col items-end pt-0.5">
                <span className="text-[11px] font-medium text-neutral-400">{relativeTime(post.when)}</span>
              </div>
              <div className="relative flex-1 border-l border-neutral-100 pl-4">
                <span className="absolute top-1.5 -left-[5px] h-2.5 w-2.5 rounded-full border-2 border-white bg-violet-500 shadow" />
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_PILL[post.status] ?? "bg-neutral-100 text-neutral-600"}`}>
                    {labelize(post.status)}
                  </span>
                  {post.targets.slice(0, 4).map((target) => (
                    <span key={`${post.id}-${target.platform}-${target.status}`} className="inline-flex items-center gap-1 text-[11px] text-neutral-500">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: PLATFORM_INK[target.platform] ?? "#a3a3a3" }} />
                      {target.platformLabel}
                    </span>
                  ))}
                </div>
                <p className="mt-1.5 text-sm leading-6 text-neutral-800">{post.excerpt}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function Accounts({ accounts }: { accounts: AccountCard[] }) {
  return (
    <section className="ss-rise rounded-[28px] border border-white/80 bg-white/90 p-5 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.35)] backdrop-blur-sm" style={{ animationDelay: "260ms" }}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-900">Accounts</h2>
        <Link href="/dashboard/connections" className="text-xs font-medium text-violet-600 transition hover:text-violet-700">Manage</Link>
      </div>
      {accounts.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">Connect a platform to start the queue.</p>
      ) : (
        <ul className="mt-2 divide-y divide-neutral-100">
          {accounts.map((account) => (
            <li key={account.id}>
              <Link href="/dashboard/connections" className="group flex items-center gap-3 py-3">
                <span className="h-8 w-1 rounded-full transition-all duration-300 group-hover:h-10" style={{ backgroundColor: PLATFORM_INK[account.platform] ?? "#a3a3a3" }} />
                <Avatar account={account} className="h-9 w-9" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-neutral-900">{account.displayName}</span>
                  <span className="block text-xs text-neutral-400">{account.platformLabel}</span>
                </span>
                <span className="text-right">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_PILL[account.status] ?? "bg-neutral-100 text-neutral-600"}`}>
                    {labelize(account.status)}
                  </span>
                  <span className="mt-1 block text-[11px] text-neutral-400 tabular-nums">{formatCompact(account.views7)} views</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Media({ media }: { media: HomePayload["media"] }) {
  return (
    <section className="ss-rise rounded-[28px] border border-white/80 bg-white/90 p-5 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.35)] backdrop-blur-sm" style={{ animationDelay: "300ms" }}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-900">Library</h2>
        <Link href="/dashboard/media" className="text-xs font-medium text-violet-600 transition hover:text-violet-700">Open</Link>
      </div>
      {media.length === 0 ? (
        <Link href="/dashboard/media" className="mt-4 flex items-center justify-center rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/70 px-4 py-8 text-sm text-neutral-500 transition hover:border-violet-200 hover:text-violet-700">
          Upload the first image or video
        </Link>
      ) : (
        <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
          {media.map((asset) => (
            <Link key={asset.id} href="/dashboard/media" className="group relative h-28 w-24 shrink-0 overflow-hidden rounded-2xl bg-neutral-100">
              {asset.mimeType.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={asset.url} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
              ) : asset.mimeType.startsWith("video/") ? (
                <video src={asset.url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full items-center justify-center text-xs text-neutral-400">{asset.kind}</span>
              )}
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-2 py-1.5 text-[10px] font-medium text-white opacity-0 transition group-hover:opacity-100">
                {asset.kind}
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function Avatar({ account, className }: { account: AccountCard; className: string }) {
  if (account.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={account.avatarUrl} alt="" className={`${className} rounded-full object-cover`} />
    );
  }
  return (
    <span className={`${className} inline-flex items-center justify-center rounded-full text-xs font-semibold text-white`} style={{ backgroundColor: PLATFORM_INK[account.platform] ?? "#6d28d9" }}>
      {account.displayName.charAt(0).toUpperCase()}
    </span>
  );
}

function Mini({ label, value, suffix = "" }: { label: string; value: number; suffix?: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium tracking-wide text-neutral-400 uppercase">{label}</p>
      <p className="mt-1 text-sm font-semibold text-neutral-900 tabular-nums">
        <CountUp value={value} />
        {suffix}
      </p>
    </div>
  );
}

function Delta({ current, previous }: { current: number; previous: number }) {
  if (current === 0 && previous === 0) return <span className="text-xs font-medium text-neutral-400">Flat</span>;
  if (previous === 0) return <span className="text-xs font-medium text-emerald-600">New</span>;
  const pct = ((current - previous) / previous) * 100;
  const up = pct >= 0;
  return (
    <span className={`text-xs font-medium ${up ? "text-emerald-600" : "text-rose-600"}`}>
      {up ? "↑" : "↓"} {Math.abs(pct) >= 10 ? Math.abs(pct).toFixed(0) : Math.abs(pct).toFixed(1)}%
    </span>
  );
}

function Spark({ values, color }: { values: number[]; color: string }) {
  const path = linePath(values, 84, 32);
  return (
    <svg viewBox="0 0 84 32" className="h-8 w-20" aria-hidden="true">
      <path d={path} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="ss-draw" />
    </svg>
  );
}

function CountUp({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      if (reduce) {
        setDisplay(value);
        return;
      }
      const progress = Math.min(1, (now - start) / 900);
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(Math.round(value * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <>{formatCompact(display)}</>;
}

let clockSecond = 0;

function subscribeClock(onChange: () => void) {
  clockSecond = Math.floor(Date.now() / 1000);
  const id = window.setInterval(() => {
    const next = Math.floor(Date.now() / 1000);
    if (next === clockSecond) return;
    clockSecond = next;
    onChange();
  }, 250);
  return () => window.clearInterval(id);
}

function getClockSnapshot() {
  return clockSecond;
}

function getClockServerSnapshot() {
  return 0;
}

function useNow() {
  const second = useSyncExternalStore(subscribeClock, getClockSnapshot, getClockServerSnapshot);
  return second === 0 ? null : new Date(second * 1000);
}

function buildChart(values: number[], width: number, height: number) {
  const points = plot(values, width, height, 8);
  const line = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  return { line, area, points };
}

function linePath(values: number[], width: number, height: number) {
  return plot(values, width, height, 4).map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
}

function plot(values: number[], width: number, height: number, pad: number) {
  const series = values.length > 0 ? values : [0];
  const max = Math.max(...series);
  const min = Math.min(...series);
  const span = Math.max(1, max - min);
  const step = series.length <= 1 ? 0 : width / (series.length - 1);
  return series.map((value, index) => ({
    x: index * step,
    y: max === min ? (max === 0 ? height - pad : height / 2) : height - pad - ((value - min) / span) * (height - pad * 2),
  }));
}

function formatCompact(value: number) {
  return new Intl.NumberFormat("en", { notation: Math.abs(value) >= 10000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value);
}

function formatDay(isoDate: string) {
  if (!isoDate) return "";
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function relativeTime(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  const minutes = Math.round(diff / 60000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour");
  return formatter.format(Math.round(hours / 24), "day");
}

function labelize(value: string) {
  return value.replaceAll("_", " ").replace(/^\w/, (letter) => letter.toUpperCase());
}
