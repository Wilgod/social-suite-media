import { notFound } from "next/navigation";
import { loadAccountAnalytics } from "../../load";
import { isPlatform } from "../../metrics";
import { AccountStudio } from "../../ui";

export default async function AccountAnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ platform: string; accountId: string }>;
  searchParams: Promise<{ item?: string; kind?: string }>;
}) {
  const { platform: raw, accountId } = await params;
  const { item, kind } = await searchParams;
  if (!isPlatform(raw)) notFound();
  const data = await loadAccountAnalytics(raw, accountId);
  if (!data) notFound();
  const selected = item ? data.contents.find((content) => content.id === item) : undefined;

  return (
    <div className="p-6 lg:p-8">
      <AccountStudio platform={raw} data={data} kind={kind ?? "all"} selected={selected} missingItem={Boolean(item && !selected)} />
    </div>
  );
}
