"use server";

import { prisma, type Prisma } from "@social-suite/db";
import { enqueuePublishJob } from "@social-suite/queue";
import { requireTenantContext } from "@/lib/tenant";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createPost(formData: FormData): Promise<void> {
  const ctx = await requireTenantContext();

  const baseContent = (formData.get("content") as string)?.trim();
  const accountIds = formData.getAll("socialAccountIds") as string[];
  const mediaAssetIds = formData.getAll("mediaAssetIds") as string[];
  const scheduledAtRaw = formData.get("scheduledAt") as string;
  const intent = formData.get("intent") as string;

  const youtubeTitle = (formData.get("youtubeTitle") as string)?.trim();
  const youtubeDescription = (formData.get("youtubeDescription") as string)?.trim();
  const youtubePrivacyStatus = formData.get("youtubePrivacyStatus") as string;
  const youtubeTagsRaw = (formData.get("youtubeTags") as string)?.trim();
  const youtubeTags = youtubeTagsRaw
    ? youtubeTagsRaw.split(",").map((t) => t.trim()).filter(Boolean)
    : undefined;

  if (!baseContent || accountIds.length === 0) {
    return;
  }

  const accounts = await prisma.socialAccount.findMany({
    where: { id: { in: accountIds }, organizationId: ctx.organizationId, status: "active" },
  });
  if (accounts.length === 0) return;

  const media = mediaAssetIds.length
    ? await prisma.mediaAsset.findMany({
        where: { id: { in: mediaAssetIds }, organizationId: ctx.organizationId },
      })
    : [];

  const isDraft = intent === "draft";
  const runAt = scheduledAtRaw ? new Date(scheduledAtRaw) : new Date();

  const youtubeSpecific: Prisma.InputJsonValue | undefined =
    youtubeTitle || youtubeDescription || youtubePrivacyStatus || youtubeTags
      ? {
          ...(youtubeTitle ? { title: youtubeTitle } : {}),
          ...(youtubeDescription ? { description: youtubeDescription } : {}),
          ...(youtubePrivacyStatus ? { privacyStatus: youtubePrivacyStatus } : {}),
          ...(youtubeTags ? { tags: youtubeTags } : {}),
        }
      : undefined;

  const post = await prisma.post.create({
    data: {
      organizationId: ctx.organizationId,
      createdByUserId: ctx.userId,
      status: isDraft ? "draft" : "scheduled",
      baseContent,
      scheduledAt: isDraft ? null : runAt,
      targets: {
        create: accounts.map((account) => ({
          organizationId: ctx.organizationId,
          socialAccountId: account.id,
          platform: account.platform,
          platformSpecificContent: account.platform === "youtube" ? youtubeSpecific : undefined,
          media: {
            create: media.map((asset, order) => ({ mediaAssetId: asset.id, order })),
          },
        })),
      },
    },
    include: { targets: true },
  });

  if (!isDraft) {
    for (const target of post.targets) {
      await enqueuePublishJob(target.id, runAt);
    }
  }

  revalidatePath("/dashboard/posts");
  redirect("/dashboard/posts");
}

/** Cancels a draft/scheduled post. Marks targets "skipped" so the worker's idempotency guard drops any already-enqueued job. */
export async function cancelPost(formData: FormData): Promise<void> {
  const ctx = await requireTenantContext();
  const postId = formData.get("postId") as string;

  const post = await prisma.post.findFirst({
    where: { id: postId, organizationId: ctx.organizationId },
  });
  if (!post || !["draft", "scheduled", "failed", "partially_published"].includes(post.status)) return;

  await prisma.$transaction([
    prisma.post.update({ where: { id: post.id }, data: { status: "canceled" } }),
    prisma.postTarget.updateMany({
      where: { postId: post.id, status: { in: ["pending", "queued"] } },
      data: { status: "skipped" },
    }),
  ]);

  revalidatePath("/dashboard/posts");
}
