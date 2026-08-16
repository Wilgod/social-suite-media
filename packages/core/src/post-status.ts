import type { PostStatus, PostTargetStatus } from "./types";

/** Post.status is always derived from its PostTargets, never set directly by user action. */
export function derivePostStatus(targetStatuses: PostTargetStatus[]): PostStatus {
  if (targetStatuses.length === 0) return "draft";

  const allSuccess = targetStatuses.every((s) => s === "success" || s === "skipped");
  if (allSuccess) return "published";

  const allFailed = targetStatuses.every((s) => s === "failed" || s === "skipped");
  if (allFailed) return "failed";

  const anyPending = targetStatuses.some((s) => s === "pending" || s === "queued" || s === "publishing");
  const anySuccess = targetStatuses.some((s) => s === "success");
  const anyFailed = targetStatuses.some((s) => s === "failed");

  if (!anyPending && anySuccess && anyFailed) return "partially_published";
  if (anyPending) return "publishing";

  return "scheduled";
}
