import { decryptSecret, derivePostStatus } from "@social-suite/core";
import type { PostTargetStatus } from "@social-suite/core";
import { prisma } from "@social-suite/db";
import { getAdapter } from "@social-suite/platforms";
import { getValidAccessToken } from "../lib/access-token";

const MAX_ATTEMPTS = 5;

export interface PublishPostTargetJobData {
  postTargetId: string;
}

/**
 * Retryable jobs (transient errors, attempts remaining) throw so pg-boss's
 * built-in retry/backoff re-fires them. Terminal outcomes (success, or
 * permanent/exhausted failure) update the DB and return normally so the
 * job is not retried again.
 */
export async function handlePublishPostTarget(data: PublishPostTargetJobData): Promise<void> {
  const target = await prisma.postTarget.findUnique({
    where: { id: data.postTargetId },
    include: {
      post: true,
      socialAccount: { include: { credential: true } },
      media: { include: { mediaAsset: true }, orderBy: { order: "asc" } },
    },
  });

  if (!target) {
    console.warn(`PostTarget ${data.postTargetId} no longer exists, skipping`);
    return;
  }

  // Idempotency guard: a re-fired job (e.g. after a worker crash) must not double-publish.
  if (target.status === "success" || target.status === "skipped") {
    return;
  }

  const { socialAccount, post } = target;
  const credential = socialAccount.credential;

  if (socialAccount.status !== "active" || !credential) {
    await failPermanently(target.id, target.postId, "account_not_connected", "Social account is not connected or has no credentials.");
    return;
  }

  await prisma.postTarget.update({
    where: { id: target.id },
    data: { status: "publishing", attemptCount: { increment: 1 }, lastAttemptedAt: new Date() },
  });

  const adapter = getAdapter(target.platform);

  let accessToken: string;
  try {
    accessToken = await getValidAccessToken(socialAccount.organizationId, target.platform, credential);
  } catch (err) {
    await prisma.socialAccount.update({ where: { id: socialAccount.id }, data: { status: "expired" } });
    await failPermanently(
      target.id,
      target.postId,
      "token_refresh_failed",
      err instanceof Error ? err.message : "Token refresh failed; account needs to be reconnected.",
    );
    return;
  }

  const platformSpecific = (target.platformSpecificContent ?? {}) as { content?: string };

  const result = await adapter.publish(
    {
      postTargetId: target.id,
      externalAccountId: socialAccount.platformAccountId,
      content: platformSpecific.content ?? post.baseContent,
      media: target.media.map((m) => ({
        url: m.mediaAsset.storageUrl,
        mimeType: m.mediaAsset.mimeType,
        order: m.order,
      })),
      platformSpecific: target.platformSpecificContent as Record<string, unknown> | undefined,
    },
    {
      accessToken,
      refreshToken: credential.encryptedRefreshToken ? decryptSecret(credential.encryptedRefreshToken) : undefined,
      expiresAt: credential.tokenExpiresAt ?? undefined,
      accountMetadata: socialAccount.platformMetadata as Record<string, unknown> | undefined,
    },
  );

  if (result.success) {
    await prisma.postTarget.update({
      where: { id: target.id },
      data: { status: "success", externalPostId: result.externalPostId, publishedAt: new Date(), errorCode: null, errorMessage: null },
    });
    await recomputePostStatus(target.postId);
    return;
  }

  const attemptCount = target.attemptCount + 1;
  if (result.errorKind === "transient" && attemptCount < MAX_ATTEMPTS) {
    // Throwing lets pg-boss's retryLimit/retryDelay/retryBackoff handle re-scheduling.
    throw new Error(result.errorMessage ?? `Transient publish failure on ${target.platform}`);
  }

  await failPermanently(target.id, target.postId, result.errorCode ?? "publish_failed", result.errorMessage ?? "Publish failed");
}

async function failPermanently(postTargetId: string, postId: string, errorCode: string, errorMessage: string) {
  await prisma.postTarget.update({
    where: { id: postTargetId },
    data: { status: "failed", errorCode, errorMessage },
  });
  await recomputePostStatus(postId);
}

async function recomputePostStatus(postId: string) {
  const targets = await prisma.postTarget.findMany({ where: { postId }, select: { status: true } });
  const status = derivePostStatus(targets.map((t) => t.status as PostTargetStatus));
  await prisma.post.update({ where: { id: postId }, data: { status } });
}
