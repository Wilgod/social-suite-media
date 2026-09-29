import { notFound, redirect } from "next/navigation";
import { PLATFORM_LABELS } from "@social-suite/core";
import { PlatformIcon } from "../../connections/platform-icon";
import { loadPlatformAnalytics } from "../load";
import { accountPath, countLabel, isPlatform, styleCopy, TIKTOK_SANDBOX_NOTE, unmeasured } from "../metrics";
import { AccountBoard, Crumbs } from "../ui";

export default async function PlatformAnalyticsPage({ params }: { params: Promise<{ platform: string }> }) {
  const { platform: raw } = await params;
  if (!isPlatform(raw)) notFound();
  const data = await loadPlatformAnalytics(raw);
  if (data.accounts.length === 1) redirect(accountPath(raw, data.accounts[0].id));
  const quiet = raw === "tiktok" && unmeasured(data.metrics.map((metric) => metric.value));

  return (
    <div className="p-6 lg:p-8">
      <Crumbs items={[{ label: PLATFORM_LABELS[raw] }]} />
      <div className="flex items-center gap-3">
        <PlatformIcon platform={raw} className="h-8 w-8 shrink-0" />
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">{PLATFORM_LABELS[raw]}</h1>
          <p className="mt-0.5 text-sm text-neutral-500">
            {countLabel(data.accounts.length, "account")} · {styleCopy(raw)}
          </p>
        </div>
      </div>
      {quiet && data.accounts.length > 0 && <p className="mt-3 max-w-xl text-xs leading-5 text-neutral-500">{TIKTOK_SANDBOX_NOTE}</p>}
      <AccountBoard platform={raw} accounts={data.accounts} />
    </div>
  );
}
