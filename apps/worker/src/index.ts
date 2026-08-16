import type { Job } from "pg-boss";
import "./load-env";
import "@social-suite/platforms";
import { PUBLISH_POST_TARGET_QUEUE, SYNC_ANALYTICS_QUEUE, getBoss } from "@social-suite/queue";
import { handlePublishPostTarget } from "./jobs/publish-post-target";
import { handleSyncAnalytics } from "./jobs/sync-analytics";

async function main() {
  const boss = await getBoss();

  await boss.work(
    PUBLISH_POST_TARGET_QUEUE,
    { batchSize: 5 },
    async ([job]: Job<{ postTargetId: string }>[]) => {
      await handlePublishPostTarget(job.data);
    },
  );

  await boss.work(SYNC_ANALYTICS_QUEUE, async () => {
    await handleSyncAnalytics();
  });

  console.log("Worker started, listening for publish jobs...");
}

main().catch((err) => {
  console.error("Worker failed to start", err);
  process.exit(1);
});
