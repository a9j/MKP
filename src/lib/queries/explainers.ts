import { createPublicClient } from "@/lib/supabase/public";

/** Today in Toledo, as YYYY-MM-DD. A ballot on today's date is still ahead. */
function todayInToledo(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
}

/**
 * Whether a published explainer covers something still to be decided at the
 * ballot box. The home page leads with "See what's on the ballot" only then,
 * so the button never opens onto an empty or past election.
 */
export async function hasUpcomingBallotExplainer(): Promise<boolean> {
  const supabase = createPublicClient();
  const { count, error } = await supabase
    .from("explainers_public")
    .select("id", { count: "exact", head: true })
    .in("kind", ["ballot_issue", "levy"])
    .gte("decision_date", todayInToledo());
  if (error) throw new Error(`Could not check for ballot explainers: ${error.message}`);
  return (count ?? 0) > 0;
}
