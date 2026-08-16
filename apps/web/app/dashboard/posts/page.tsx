import { prisma } from "@social-suite/db";
import type { PostStatus, PostTargetStatus } from "@social-suite/core";
import { requireTenantContext } from "@/lib/tenant";
import { createPost, cancelPost } from "./actions";

const PLATFORM_LABELS: Record<string, string> = {
  youtube: "YouTube",
  facebook: "Facebook",
  instagram: "Instagram",
  threads: "Threads",
  x: "X",
};

const POST_STATUS_STYLES: Record<PostStatus, string> = {
  draft: "bg-neutral-100 text-neutral-600",
  scheduled: "bg-violet-50 text-violet-700",
  publishing: "bg-amber-50 text-amber-700",
  partially_published: "bg-amber-50 text-amber-700",
  published: "bg-green-50 text-green-700",
  failed: "bg-red-50 text-red-700",
  canceled: "bg-neutral-100 text-neutral-400",
};

const TARGET_STATUS_STYLES: Record<PostTargetStatus, string> = {
  pending: "bg-neutral-100 text-neutral-500",
  queued: "bg-neutral-100 text-neutral-500",
  publishing: "bg-amber-50 text-amber-700",
  success: "bg-green-50 text-green-700",
  failed: "bg-red-50 text-red-700",
  skipped: "bg-neutral-100 text-neutral-400",
};

export default async function PostsPage() {
  const ctx = await requireTenantContext();

  const [accounts, media, posts] = await Promise.all([
    prisma.socialAccount.findMany({
      where: { organizationId: ctx.organizationId, status: "active" },
      orderBy: { connectedAt: "asc" },
    }),
    prisma.mediaAsset.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: { createdAt: "desc" },
      take: 24,
    }),
    prisma.post.findMany({
      where: { organizationId: ctx.organizationId },
      include: { targets: { include: { socialAccount: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="max-w-3xl p-8">
      <h1 className="text-lg font-semibold text-neutral-900">Posts</h1>
      <p className="mt-1 text-sm text-neutral-500">Compose once, publish across your connected accounts.</p>

      <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5">
        {accounts.length === 0 ? (
          <p className="text-sm text-neutral-500">
            No connected accounts yet.{" "}
            <a href="/dashboard/connections" className="font-medium text-violet-600 hover:text-violet-700">
              Connect one first →
            </a>
          </p>
        ) : (
          <form action={createPost} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-neutral-700">Content</label>
              <textarea
                name="content"
                required
                rows={4}
                placeholder="What do you want to share?"
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-neutral-700">Post to</label>
              <div className="flex flex-wrap gap-2">
                {accounts.map((account) => (
                  <label
                    key={account.id}
                    className="flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm has-checked:border-violet-300 has-checked:bg-violet-50 has-checked:text-violet-700"
                  >
                    <input type="checkbox" name="socialAccountIds" value={account.id} className="accent-violet-600" />
                    {PLATFORM_LABELS[account.platform] ?? account.platform} — {account.displayName}
                  </label>
                ))}
              </div>
            </div>

            {media.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-neutral-700">Media (optional)</label>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                  {media.map((asset) => (
                    <label key={asset.id} className="group relative cursor-pointer">
                      <input
                        type="checkbox"
                        name="mediaAssetIds"
                        value={asset.id}
                        className="peer sr-only"
                      />
                      {asset.mimeType.startsWith("image/") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={asset.storageUrl}
                          alt=""
                          className="aspect-square w-full rounded-md object-cover ring-2 ring-transparent peer-checked:ring-violet-500"
                        />
                      ) : (
                        <video
                          src={asset.storageUrl}
                          muted
                          className="aspect-square w-full rounded-md bg-black object-cover ring-2 ring-transparent peer-checked:ring-violet-500"
                        />
                      )}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <details className="rounded-lg border border-neutral-200 p-3">
              <summary className="cursor-pointer text-sm font-medium text-neutral-700">
                YouTube options (optional)
              </summary>
              <div className="mt-3 space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-neutral-600">Title</label>
                  <input
                    name="youtubeTitle"
                    type="text"
                    maxLength={100}
                    placeholder="Defaults to the first line of your content"
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-neutral-600">Description</label>
                  <textarea
                    name="youtubeDescription"
                    rows={3}
                    placeholder="Defaults to your content above"
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                  />
                </div>
                <div className="flex gap-3">
                  <div className="flex-1 space-y-1.5">
                    <label className="text-xs font-medium text-neutral-600">Visibility</label>
                    <select
                      name="youtubePrivacyStatus"
                      defaultValue="public"
                      className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                    >
                      <option value="public">Public</option>
                      <option value="unlisted">Unlisted</option>
                      <option value="private">Private</option>
                    </select>
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <label className="text-xs font-medium text-neutral-600">Tags</label>
                    <input
                      name="youtubeTags"
                      type="text"
                      placeholder="comma, separated, tags"
                      className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                    />
                  </div>
                </div>
                <p className="text-xs text-neutral-400">Only applies if a YouTube account is selected above.</p>
              </div>
            </details>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-neutral-700">Schedule for (optional)</label>
              <input
                type="datetime-local"
                name="scheduledAt"
                className="rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
              />
              <p className="text-xs text-neutral-400">Leave blank to publish immediately.</p>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                name="intent"
                value="draft"
                className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
              >
                Save as draft
              </button>
              <button
                type="submit"
                name="intent"
                value="publish"
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-700"
              >
                Schedule / Publish
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="mt-8 space-y-3">
        {posts.length === 0 && <p className="text-sm text-neutral-400">No posts yet.</p>}

        {posts.map((post) => (
          <div key={post.id} className="rounded-2xl border border-neutral-200 bg-white p-5">
            <div className="flex items-start justify-between gap-4">
              <p className="text-sm text-neutral-900">{post.baseContent}</p>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${POST_STATUS_STYLES[post.status]}`}>
                {post.status.replace(/_/g, " ")}
              </span>
            </div>

            <p className="mt-2 text-xs text-neutral-400">
              {post.scheduledAt
                ? `Scheduled for ${post.scheduledAt.toLocaleString()}`
                : `Created ${post.createdAt.toLocaleString()}`}
            </p>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {post.targets.map((target) => (
                <span
                  key={target.id}
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${TARGET_STATUS_STYLES[target.status]}`}
                >
                  {PLATFORM_LABELS[target.platform] ?? target.platform} · {target.status}
                </span>
              ))}
            </div>

            {["draft", "scheduled", "failed", "partially_published"].includes(post.status) && (
              <form action={cancelPost} className="mt-3">
                <input type="hidden" name="postId" value={post.id} />
                <button type="submit" className="text-xs font-medium text-red-600 hover:text-red-700">
                  Cancel
                </button>
              </form>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
