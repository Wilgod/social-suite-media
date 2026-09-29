import { PgBoss } from "pg-boss";

export const PUBLISH_POST_TARGET_QUEUE = "publish-post-target";
export const SYNC_ANALYTICS_QUEUE = "sync-analytics";
export const SYNC_POST_METRICS_QUEUE = "sync-post-metrics";

let bossInstance: PgBoss | undefined;

/** Shared by both the worker (which also calls .work()) and the web app (which only ever calls .send()). */
export async function getBoss(): Promise<PgBoss> {
  if (bossInstance) return bossInstance;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const boss = new PgBoss({ connectionString });
  boss.on("error", (err: Error) => console.error("[pg-boss]", err));
  await boss.start();
  await boss.createQueue(PUBLISH_POST_TARGET_QUEUE);
  await boss.createQueue(SYNC_ANALYTICS_QUEUE);
  await boss.createQueue(SYNC_POST_METRICS_QUEUE);

  // Daily at 06:00 UTC.
  await boss.schedule(SYNC_ANALYTICS_QUEUE, "0 6 * * *", {});
  await boss.schedule(SYNC_POST_METRICS_QUEUE, "*/15 * * * *", {});

  bossInstance = boss;
  return boss;
}

/** Enqueues one publish job for a PostTarget, scheduled for the given time (immediately if in the past). */
export async function enqueuePublishJob(postTargetId: string, runAt: Date): Promise<void> {
  const boss = await getBoss();
  const delaySeconds = Math.max(0, Math.floor((runAt.getTime() - Date.now()) / 1000));
  await boss.send(
    PUBLISH_POST_TARGET_QUEUE,
    { postTargetId },
    {
      startAfter: delaySeconds,
      retryLimit: 5,
      retryDelay: 60,
      retryBackoff: true,
      singletonKey: postTargetId,
    },
  );
}
