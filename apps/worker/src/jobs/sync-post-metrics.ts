import { decryptSecret } from "@social-suite/core";
import { prisma } from "@social-suite/db";
import { getAdapter, hasAdapter } from "@social-suite/platforms";
import { getValidAccessToken } from "../lib/access-token";

/** Polls engagement for recently published targets. Adapters that are not ready return zeros/empty comments. */
export async function handleSyncPostMetrics(): Promise<void> {
  const targets = await prisma.postTarget.findMany({
    where: { status: "success", externalPostId: { not: null } },
    include: { socialAccount: { include: { credential: true } } },
  });

  for (const target of targets) {
    const account = target.socialAccount;
    if ((account.platformMetadata as { demoMode?: boolean } | null)?.demoMode === true) continue;
    if (!target.externalPostId || account.status !== "active" || !account.credential) continue;
    if (!hasAdapter(target.platform)) continue;

    const adapter = getAdapter(target.platform);
    if (!adapter.fetchPostMetrics && !adapter.fetchComments) continue;

    try {
      const accessToken = await getValidAccessToken(account.organizationId, target.platform, account.credential);
      const credentials = {
        accessToken,
        refreshToken: account.credential.encryptedRefreshToken
          ? decryptSecret(account.credential.encryptedRefreshToken)
          : undefined,
        expiresAt: account.credential.tokenExpiresAt ?? undefined,
        accountMetadata: account.platformMetadata as Record<string, unknown> | undefined,
      };

      if (adapter.fetchPostMetrics) {
        const metrics = await adapter.fetchPostMetrics(target.externalPostId, credentials);
        await prisma.postTargetMetricSnapshot.create({
          data: {
            organizationId: account.organizationId,
            postTargetId: target.id,
            views: metrics.views,
            likes: metrics.likes,
            comments: metrics.comments,
            shares: metrics.shares,
            favorites: metrics.favorites,
            coins: metrics.coins ?? 0,
            extra: metrics.extra,
          },
        });
      }

      if (adapter.fetchComments) {
        const comments = await adapter.fetchComments(target.externalPostId, credentials);
        for (const comment of comments) {
          if (!comment.externalId) continue;
          await prisma.postComment.upsert({
            where: {
              postTargetId_externalCommentId: {
                postTargetId: target.id,
                externalCommentId: comment.externalId,
              },
            },
            create: {
              organizationId: account.organizationId,
              postTargetId: target.id,
              externalCommentId: comment.externalId,
              parentExternalId: comment.parentExternalId,
              authorExternalId: comment.authorExternalId,
              authorName: comment.authorName,
              body: comment.body,
              likeCount: comment.likeCount ?? 0,
              publishedAt: comment.publishedAt,
            },
            update: {
              parentExternalId: comment.parentExternalId,
              authorExternalId: comment.authorExternalId,
              authorName: comment.authorName,
              body: comment.body,
              likeCount: comment.likeCount ?? 0,
              publishedAt: comment.publishedAt,
              fetchedAt: new Date(),
            },
          });
        }
      }
    } catch (err) {
      console.error(`Post metrics sync failed for ${target.platform} target ${target.id}`, err);
    }
  }
}
