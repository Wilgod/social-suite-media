import { PLATFORMS, type Platform } from "@social-suite/core";
import { hasAdapter } from "@social-suite/platforms";
import { requireTenantDb } from "@/lib/tenant";
import { revalidatePath } from "next/cache";

const PLATFORM_LABELS: Record<Platform, string> = {
  youtube: "YouTube",
  facebook: "Facebook",
  instagram: "Instagram",
  threads: "Threads",
  x: "X",
};

export default async function ConnectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const { connected, error } = await searchParams;
  const { db } = await requireTenantDb();

  const accounts = await db.socialAccount.findMany({ orderBy: { connectedAt: "desc" } });

  async function disconnectAccount(formData: FormData) {
    "use server";
    const { db } = await requireTenantDb();
    const socialAccountId = formData.get("socialAccountId") as string;
    await db.socialAccount.update({ where: { id: socialAccountId }, data: { status: "revoked" } });
    revalidatePath("/dashboard/connections");
  }

  return (
    <div className="max-w-2xl p-8">
      {connected && (
        <p className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          Account connected.
        </p>
      )}
      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          Connection failed: {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {PLATFORMS.map((platform) => {
          const available = hasAdapter(platform);
          return available ? (
            <a
              key={platform}
              href={`/api/connections/${platform}/start`}
              className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
            >
              Connect {PLATFORM_LABELS[platform]}
            </a>
          ) : (
            <span key={platform} className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm text-neutral-400">
              {PLATFORM_LABELS[platform]} (coming soon)
            </span>
          );
        })}
      </div>

      <ul className="mt-8 divide-y divide-neutral-200 rounded-2xl border border-neutral-200 bg-white">
        {accounts.length === 0 && <li className="px-5 py-4 text-sm text-neutral-500">No accounts connected yet.</li>}
        {accounts.map((account) => (
          <li key={account.id} className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="font-medium text-neutral-900">
                {PLATFORM_LABELS[account.platform as Platform]} — {account.displayName}
              </p>
              <p className="text-sm text-neutral-500">Status: {account.status}</p>
            </div>
            {account.status !== "revoked" && (
              <form action={disconnectAccount}>
                <input type="hidden" name="socialAccountId" value={account.id} />
                <button type="submit" className="text-sm font-medium text-red-600 hover:text-red-700">Disconnect</button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
