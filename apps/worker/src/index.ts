import type { Job } from "pg-boss";
import "./load-env";
import "@social-suite/platforms";
import { PUBLISH_POST_TARGET_QUEUE, SYNC_ANALYTICS_QUEUE, SYNC_POST_METRICS_QUEUE, getBoss } from "@social-suite/queue";
import { handlePublishPostTarget } from "./jobs/publish-post-target";
import { handleSyncAnalytics } from "./jobs/sync-analytics";
import { handleSyncPostMetrics } from "./jobs/sync-post-metrics";

async function main() {
  const boss = await getBoss();

  await boss.work(
    PUBLISH_POST_TARGET_QUEUE,
    { batchSize: 5 },
    async (jobs: Job<{ postTargetId: string }>[]) => {
      // pg-boss considers the entire fetched batch complete when this callback
      // resolves, so every job in the batch must be handled.
      await Promise.all(jobs.map((job) => handlePublishPostTarget(job.data)));
    },
  );

  await boss.work(SYNC_ANALYTICS_QUEUE, async () => {
    await handleSyncAnalytics();
  });

  await boss.work(SYNC_POST_METRICS_QUEUE, async () => {
    await handleSyncPostMetrics();
  });

  console.log("Worker started, listening for publish jobs...");
}

main().catch((err) => {
  console.error("Worker failed to start", err);
  process.exit(1);
});
