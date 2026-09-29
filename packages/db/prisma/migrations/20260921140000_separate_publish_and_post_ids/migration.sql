ALTER TABLE "post_targets" ADD COLUMN "externalPublishId" TEXT;

-- Older TikTok publishing code stored an upload task id in externalPostId.
-- Preserve it for diagnostics, but keep it away from video/query metrics calls.
UPDATE "post_targets"
SET "externalPublishId" = "externalPostId",
    "externalPostId" = NULL
WHERE "platform" = 'tiktok'
  AND "externalPostId" LIKE 'v_pub_file%';
