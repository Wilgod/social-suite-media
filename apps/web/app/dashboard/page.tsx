import { requireTenantDb } from "@/lib/tenant";

export default async function DashboardPage() {
  const { db } = await requireTenantDb();

  const connectedAccountCount = await db.socialAccount.count();

  return (
    <div className="p-8">
      <div className="rounded-2xl border border-neutral-200 bg-white p-6">
        <p className="text-sm font-medium text-neutral-500">Connected accounts</p>
        <p className="mt-1 text-3xl font-semibold text-neutral-900">{connectedAccountCount}</p>
        <a href="/dashboard/connections" className="mt-4 inline-block text-sm font-medium text-violet-600 hover:text-violet-700">
          Manage connections →
        </a>
      </div>
    </div>
  );
}
