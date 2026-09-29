import { loadAnalyticsIndex } from "./load";
import { EmptyAnalytics, PlatformBoard } from "./ui";

export default async function AnalyticsPage() {
  const { platforms, accountCount } = await loadAnalyticsIndex();

  return (
    <div className="p-6 lg:p-8">
      <h1 className="text-lg font-semibold text-neutral-900">Analytics</h1>
      <p className="mt-1 text-sm text-neutral-500">Choose a platform, then a post.</p>
      {platforms.length === 0 ? (
        <EmptyAnalytics />
      ) : (
        <>
          <p className="mt-4 text-xs text-neutral-400">
            {platforms.length} {platforms.length === 1 ? "platform" : "platforms"} · {accountCount}{" "}
            {accountCount === 1 ? "account" : "accounts"}
          </p>
          <PlatformBoard platforms={platforms} />
        </>
      )}
    </div>
  );
}
