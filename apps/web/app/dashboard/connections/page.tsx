import Link from "next/link";
import { revalidatePath } from "next/cache";
import { PAUSED_PLATFORMS, PLATFORMS, type Platform } from "@social-suite/core";
import { hasAdapter } from "@social-suite/platforms";
import { requireTenantDb } from "@/lib/tenant";
import { PlatformIcon } from "./platform-icon";

const PLATFORM_LABELS: Record<Platform, string> = {
  youtube: "YouTube",
  facebook: "Facebook",
  instagram: "Instagram",
  threads: "Threads",
  x: "X",
  douyin: "Douyin",
  bilibili: "Bilibili",
  weibo: "Weibo",
  xiaohongshu: "Xiaohongshu",
  tiktok: "TikTok",
};

function isAvailable(platform: Platform) {
  return hasAdapter(platform) && !PAUSED_PLATFORMS.has(platform);
}

export default async function ConnectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string; platform?: string }>;
}) {
  const { connected, error, platform: requested } = await searchParams;
  const { db } = await requireTenantDb();
  const accounts = await db.socialAccount.findMany({ orderBy: { connectedAt: "desc" } });

  async function disconnectAccount(formData: FormData) {
    "use server";
    const { db } = await requireTenantDb();
    const socialAccountId = formData.get("socialAccountId") as string;
    await db.socialAccount.update({ where: { id: socialAccountId }, data: { status: "revoked" } });
    revalidatePath("/dashboard/connections");
  }

  const selected: Platform | null = PLATFORMS.includes(requested as Platform) ? (requested as Platform) : null;
  const activeAccounts = accounts.filter((account) => account.status !== "revoked");
  const visibleAccounts = selected ? accounts.filter((account) => account.platform === selected) : activeAccounts;
  const connectedPlatforms = new Set(activeAccounts.map((account) => account.platform));
  const availableCount = PLATFORMS.filter((platform) => isAvailable(platform) && !connectedPlatforms.has(platform)).length;
  const soonCount = PLATFORMS.filter((platform) => !isAvailable(platform)).length;

  return (
    <div className="p-6 lg:p-8">
      {connected && (
        <p className="mb-4 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          Account connected.
        </p>
      )}
      {error && (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          Connection failed: {error}
        </p>
      )}

      <div className="mb-5">
        <h1 className="text-lg font-semibold text-neutral-900">Connections</h1>
        <p className="mt-1 text-sm text-neutral-500">Pick a platform, then manage the accounts connected to it.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <div className="rounded-2xl bg-gradient-to-br from-violet-200 via-fuchsia-100 to-violet-50 p-4 shadow-[0_10px_30px_-18px_rgba(76,29,149,0.45)]">
          <p className="text-xs font-medium text-violet-900/70">Connected</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-violet-950">{activeAccounts.length}</p>
          <p className="mt-1 text-xs text-violet-900/60">accounts ready to publish</p>
        </div>
        <StatCard label="Platforms on" value={String(connectedPlatforms.size)} hint="with an active account" />
        <StatCard label="Available" value={String(availableCount)} hint="can still be connected" />
        <StatCard label="Coming soon" value={String(soonCount)} hint="not open for connect" />
      </div>

      <section className="mt-6">
        <div className="mb-2.5 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-neutral-900">Platforms</h2>
          {selected && (
            <Link href="/dashboard/connections" className="text-xs font-medium text-violet-600 hover:text-violet-700">
              All accounts
            </Link>
          )}
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-3">
          {PLATFORMS.map((platform) => {
            const on = connectedPlatforms.has(platform);
            const soon = !isAvailable(platform);
            const active = platform === selected;
            return (
              <Link
                key={platform}
                href={`/dashboard/connections?platform=${platform}`}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-2xl border bg-white px-3 py-3 shadow-[0_10px_30px_-20px_rgba(76,29,149,0.45)] transition hover:-translate-y-0.5 ${
                  active ? "border-violet-300 ring-2 ring-violet-200" : "border-white hover:border-violet-100"
                }`}
              >
                <PlatformIcon platform={platform} className={`h-8 w-8 shrink-0 ${soon ? "opacity-40 grayscale" : ""}`} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-neutral-900">{PLATFORM_LABELS[platform]}</span>
                  <span className={`text-xs ${on ? "text-violet-600" : "text-neutral-400"}`}>
                    {soon ? "Soon" : on ? "On" : "Connect"}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mt-6">
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-neutral-900">
            {selected ? PLATFORM_LABELS[selected] : "Accounts"}
          </h2>
          {selected && isAvailable(selected) && (
            <a
              href={`/api/connections/${selected}/start`}
              className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700"
            >
              Connect {PLATFORM_LABELS[selected]}
            </a>
          )}
        </div>

        {visibleAccounts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-violet-200 bg-white/70 px-5 py-10 text-center text-sm text-neutral-500">
            {selected && !isAvailable(selected)
              ? `${PLATFORM_LABELS[selected]} is not available yet.`
              : selected
                ? `No ${PLATFORM_LABELS[selected]} account connected yet.`
                : "No accounts connected yet."}
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
            {visibleAccounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center gap-3 rounded-2xl border border-white bg-white px-4 py-3.5 shadow-[0_10px_30px_-20px_rgba(76,29,149,0.45)]"
              >
                <PlatformIcon platform={account.platform as Platform} className="h-9 w-9 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-neutral-900">{account.displayName}</p>
                  <p className="mt-0.5 flex items-center text-xs text-neutral-500">
                    <span className="mr-1.5">{PLATFORM_LABELS[account.platform as Platform] ?? account.platform}</span>
                    {account.status === "active" && <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-lime-600" />}
                    <span className="capitalize">{account.status}</span>
                  </p>
                </div>
                {account.status !== "revoked" && (
                  <form action={disconnectAccount}>
                    <input type="hidden" name="socialAccountId" value={account.id} />
                    <button type="submit" className="text-xs text-neutral-400 hover:text-red-600">
                      Disconnect
                    </button>
                  </form>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-white bg-white p-4 shadow-[0_10px_30px_-20px_rgba(76,29,149,0.45)]">
      <p className="text-xs font-medium text-neutral-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">{value}</p>
      <p className="mt-1 text-xs text-neutral-400">{hint}</p>
    </div>
  );
}
