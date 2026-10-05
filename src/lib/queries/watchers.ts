import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { JOB_NAMES } from "@/lib/jobs";

/**
 * When each scheduled job last ran, and whether it worked.
 *
 * A collector that quietly stopped looks exactly like a quiet fortnight, so the
 * dashboard says when each one last succeeded rather than leaving it to be
 * noticed. Anything that has not succeeded in two days is marked, because that
 * is longer than any gap a daily job should have.
 */

export const STALE_AFTER_HOURS = 48;

export type WatcherStatus = {
  name: string;
  label: string;
  /** Null when it has never run at all. */
  lastRun: string | null;
  lastStatus: "ok" | "error" | "skipped" | null;
  lastSuccess: string | null;
  /** True when nothing has succeeded inside the window. */
  stale: boolean;
};

const WATCHERS: { name: string; label: string }[] = [
  { name: JOB_NAMES.digest, label: "Daily digest" },
  { name: JOB_NAMES.watchTps, label: "TPS agenda watcher" },
  { name: JOB_NAMES.watchCouncil, label: "Council agenda watcher" },
];

export async function getWatcherStatus(
  supabase: SupabaseClient<Database>,
  now = new Date(),
): Promise<WatcherStatus[]> {
  const { data } = await supabase
    .from("jobs")
    .select("name, status, started_at, finished_at")
    .in(
      "name",
      WATCHERS.map((watcher) => watcher.name),
    )
    .order("started_at", { ascending: false })
    .limit(200);

  const rows = data ?? [];
  const cutoff = now.getTime() - STALE_AFTER_HOURS * 60 * 60 * 1000;

  return WATCHERS.map((watcher) => {
    const mine = rows.filter((row) => row.name === watcher.name);
    const latest = mine[0];
    // A skipped run is not a failure: a watcher that found nothing new, or one
    // deliberately switched off, has still been heard from. What counts as
    // staleness is nothing succeeding, which includes skipping.
    const succeeded = mine.find((row) => row.status === "ok" || row.status === "skipped");

    return {
      name: watcher.name,
      label: watcher.label,
      lastRun: latest?.started_at ?? null,
      lastStatus: (latest?.status as WatcherStatus["lastStatus"]) ?? null,
      lastSuccess: succeeded?.started_at ?? null,
      stale: !succeeded || new Date(succeeded.started_at).getTime() < cutoff,
    };
  });
}
