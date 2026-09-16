import { createPublicClient } from "@/lib/supabase/public";
import { formatDay } from "@/lib/queries/records";

export type VoteCategory = "money" | "staffing" | "contracts" | "facilities" | "other";
export type VoteChoice = "yes" | "no" | "abstain" | "absent";

export const CATEGORY_LABEL: Record<VoteCategory, string> = {
  money: "Money",
  staffing: "Staffing",
  contracts: "Contracts",
  facilities: "Facilities",
  other: "Other",
};

/** The filter bar from the copy doc, Vote Watch section. */
export const CATEGORY_FILTERS = [
  { key: "all", label: "All votes" },
  { key: "money", label: "Money" },
  { key: "staffing", label: "Staffing" },
  { key: "contracts", label: "Contracts" },
  { key: "facilities", label: "Facilities" },
] as const;

export const CHOICE_LABEL: Record<VoteChoice, string> = {
  yes: "Yes",
  no: "No",
  abstain: "Abstain",
  absent: "Absent",
};

export type MemberVote = {
  personId: string;
  name: string;
  vote: VoteChoice;
};

export type Vote = {
  id: string;
  meetingDate: string;
  meetingDateLabel: string;
  bodyName: string;
  itemTitle: string;
  summary: string;
  category: VoteCategory;
  categoryLabel: string;
  amount: number | null;
  agendaUrl: string | null;
  minutesUrl: string | null;
  yes: number;
  no: number;
  abstain: number;
  absent: number;
  tally: string;
  members: MemberVote[];
};

export type MemberTally = {
  personId: string;
  name: string;
  title: string | null;
  bodyName: string | null;
  term: string;
  votesCast: number;
  yes: number;
  no: number;
  abstain: number;
  absent: number;
};

/**
 * The counts, not a verdict.
 *
 * Whether a vote carried depends on the body's own majority rule, which the
 * records do not state, and abstentions change the answer under some rules.
 * Publishing "Passed" from yes against no alone would eventually be wrong,
 * and a wrong claim is the one thing this organization cannot afford. The
 * counts are always right.
 */
function tallyLabel(yes: number, no: number, abstain: number, absent: number): string {
  const parts = [`${yes} yes`, `${no} no`];
  if (abstain > 0) parts.push(`${abstain} abstain`);
  if (absent > 0) parts.push(`${absent} absent`);
  return parts.join(", ");
}

function termLabel(start: string | null, end: string | null): string {
  if (!start && !end) return "Not stated";
  const from = start ? start.slice(0, 4) : "Not stated";
  const to = end ? end.slice(0, 4) : "present";
  return `${from} to ${to}`;
}

export async function getVotes(): Promise<Vote[]> {
  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from("votes")
    .select(
      "id, meeting_date, item_title, summary, category, amount, agenda_url, minutes_url, yes_count, no_count, abstain_count, absent_count, bodies(name), vote_members(vote, people(id, name, sort_order))",
    )
    .order("meeting_date", { ascending: false });
  if (error) throw new Error(`Could not load votes: ${error.message}`);

  return (data ?? []).map((row) => {
    const members: MemberVote[] = (row.vote_members ?? [])
      .filter((m) => m.people)
      .map((m) => ({
        personId: m.people!.id,
        name: m.people!.name,
        vote: m.vote as VoteChoice,
        sortOrder: m.people!.sort_order,
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(({ personId, name, vote }) => ({ personId, name, vote }));

    return {
      id: row.id,
      meetingDate: row.meeting_date,
      meetingDateLabel: formatDay(row.meeting_date),
      bodyName: row.bodies?.name ?? "Not stated",
      itemTitle: row.item_title,
      summary: row.summary,
      category: row.category as VoteCategory,
      categoryLabel: CATEGORY_LABEL[row.category as VoteCategory],
      amount: row.amount === null ? null : Number(row.amount),
      agendaUrl: row.agenda_url,
      minutesUrl: row.minutes_url,
      yes: row.yes_count,
      no: row.no_count,
      abstain: row.abstain_count,
      absent: row.absent_count,
      tally: tallyLabel(row.yes_count, row.no_count, row.abstain_count, row.absent_count),
      members,
    };
  });
}

export async function getMemberTallies(): Promise<MemberTally[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("member_vote_tallies")
    .select(
      "person_id, name, title, body_name, term_start, term_end, active, sort_order, votes_cast, yes_count, no_count, abstain_count, absent_count",
    )
    .order("sort_order", { ascending: true });
  if (error) throw new Error(`Could not load voting records: ${error.message}`);

  return (data ?? [])
    .filter((r) => r.person_id && r.name)
    .map((r) => ({
      personId: r.person_id!,
      name: r.name!,
      title: r.title,
      bodyName: r.body_name,
      term: termLabel(r.term_start, r.term_end),
      votesCast: Number(r.votes_cast ?? 0),
      yes: Number(r.yes_count ?? 0),
      no: Number(r.no_count ?? 0),
      abstain: Number(r.abstain_count ?? 0),
      absent: Number(r.absent_count ?? 0),
    }));
}

export async function getBodies() {
  const supabase = createPublicClient();
  const { data, error } = await supabase.from("bodies").select("id, name, slug").order("name");
  if (error) throw new Error(`Could not load bodies: ${error.message}`);
  return data ?? [];
}
