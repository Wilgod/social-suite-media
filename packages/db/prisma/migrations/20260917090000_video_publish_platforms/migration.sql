-- AlterEnum
ALTER TYPE "Platform" ADD VALUE 'douyin';
ALTER TYPE "Platform" ADD VALUE 'bilibili';
ALTER TYPE "Platform" ADD VALUE 'weibo';

-- AlterEnum
ALTER TYPE "OAuthProvider" ADD VALUE 'douyin';
ALTER TYPE "OAuthProvider" ADD VALUE 'bilibili';
ALTER TYPE "OAuthProvider" ADD VALUE 'weibo';

-- AlterTable
ALTER TABLE "analytics_snapshots" ADD COLUMN "shares" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "analytics_snapshots" ADD COLUMN "favorites" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
CREATE INDEX "post_targets_externalPostId_idx" ON "post_targets"("externalPostId");

-- CreateTable
CREATE TABLE "post_target_metric_snapshots" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "postTargetId" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "views" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "favorites" INTEGER NOT NULL DEFAULT 0,
    "coins" INTEGER NOT NULL DEFAULT 0,
    "extra" JSONB,

    CONSTRAINT "post_target_metric_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_comments" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "postTargetId" TEXT NOT NULL,
    "externalCommentId" TEXT NOT NULL,
    "parentExternalId" TEXT,
    "authorExternalId" TEXT,
    "authorName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "post_target_metric_snapshots_postTargetId_capturedAt_idx" ON "post_target_metric_snapshots"("postTargetId", "capturedAt");

-- CreateIndex
CREATE INDEX "post_target_metric_snapshots_organizationId_capturedAt_idx" ON "post_target_metric_snapshots"("organizationId", "capturedAt");

-- CreateIndex
CREATE UNIQUE INDEX "post_comments_postTargetId_externalCommentId_key" ON "post_comments"("postTargetId", "externalCommentId");

-- CreateIndex
CREATE INDEX "post_comments_organizationId_fetchedAt_idx" ON "post_comments"("organizationId", "fetchedAt");

-- AddForeignKey
ALTER TABLE "post_target_metric_snapshots" ADD CONSTRAINT "post_target_metric_snapshots_postTargetId_fkey" FOREIGN KEY ("postTargetId") REFERENCES "post_targets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_postTargetId_fkey" FOREIGN KEY ("postTargetId") REFERENCES "post_targets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
