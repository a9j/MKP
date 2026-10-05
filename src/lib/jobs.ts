import "server-only";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Every scheduled run writes a row, whether it succeeded or not.
 *
 * A watcher that quietly stopped working looks exactly like a week with no
 * meetings, so silence is never the record: a run that did nothing says it
 * skipped and why, and a run that broke says that.
 */
export type JobStatus = "ok" | "error" | "skipped";

export const JOB_NAMES = {
  digest: "digest",
  watchTps: "watch-tps",
  watchCouncil: "watch-council",
} as const;

export type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES];

export async function recordJob(
  name: JobName,
  status: JobStatus,
  detail: Record<string, unknown> = {},
  startedAt = new Date(),
): Promise<void> {
  const service = createServiceClient();
  const { error } = await service.from("jobs").insert({
    name,
    status,
    started_at: startedAt.toISOString(),
    finished_at: new Date().toISOString(),
    detail: detail as never,
  });

  // A job that ran but could not write its own record is worth a log line: the
  // work happened, the evidence did not.
  if (error) {
    console.warn(`[jobs] could not record ${name} as ${status}: ${error.message}`);
  }
}
