import { createPublicClient } from "@/lib/supabase/public";
import { formatDay } from "@/lib/queries/records";
import { bodyShortName, compareBodies } from "@/lib/bodies";

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
  /** The body's slug, which is what the body filter matches on. */
  bodySlug: string | null;
  /** "City Council" rather than "Toledo City Council", for a narrow screen. */
  bodyLabel: string;
  itemTitle: string;
  summary: string;
  category: VoteCategory;
  categoryLabel: string;
  amount: number | null;
  /** The meeting agenda, or this item within it when that link is recorded. */
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
  bodySlug: string | null;
  bodyLabel: string;
  district: string | null;
  /** The seat, as the body writes it. "At large" when the member holds none. */
  seat: string;
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

/**
 * A seat, not a claim about one. A member with no district on council was
 * elected at large; on a body that does not use districts at all the column is
 * empty for everyone and the label is the same for everyone, which is true.
 */
function seatLabel(district: string | null): string {
  return district ? `District ${district}` : "At large";
}

function termLabel(start: string | null, end: string | null): string {
  if (!start && !end) return "Not stated";
  const from = start ? start.slice(0, 4) : "Not stated";
  const to = end ? end.slice(0, 4) : "present";
  return `${from} to ${to}`;
}

export async function getVotes(): Promise<Vote[]> {
  const supabase = createPublicClient();

  // status and ai_draft are also enforced by row level security, so the
  // anonymous key could not read a draft even without this filter. It is
  // written out anyway: the rule that a machine draft is never public should
  // be visible in the query, not only in the policy.
  const { data, error } = await supabase
    .from("votes")
    .select(
      "id, item_title, summary, category, amount, agenda_item_url, status, ai_draft, meetings(meeting_date, agenda_url, minutes_url, bodies(name, slug)), vote_members(vote, people(id, name, sort_order))",
    )
    .eq("status", "published")
    .eq("ai_draft", false)
    .order("published_at", { ascending: false });
  if (error) throw new Error(`Could not load votes: ${error.message}`);

  return (data ?? [])
    .filter((row) => row.meetings)
    .map((row) => {
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

      // Counted from the roll call rather than read from a stored total, so
      // the tally and the names under it can never disagree.
      const count = (choice: VoteChoice) => members.filter((m) => m.vote === choice).length;
      const yes = count("yes");
      const no = count("no");
      const abstain = count("abstain");
      const absent = count("absent");

      const meeting = row.meetings!;
      const bodyName = meeting.bodies?.name ?? "Not stated";
      const bodySlug = meeting.bodies?.slug ?? null;

      return {
        id: row.id,
        meetingDate: meeting.meeting_date,
        meetingDateLabel: formatDay(meeting.meeting_date),
        bodyName,
        bodySlug,
        bodyLabel: bodyShortName(bodySlug, bodyName),
        itemTitle: row.item_title,
        summary: row.summary,
        category: row.category as VoteCategory,
        categoryLabel: CATEGORY_LABEL[row.category as VoteCategory],
        amount: row.amount === null ? null : Number(row.amount),
        // The item link is the more useful of the two when it exists: it opens
        // the paper for this decision rather than the whole agenda.
        agendaUrl: row.agenda_item_url ?? meeting.agenda_url,
        minutesUrl: meeting.minutes_url,
        yes,
        no,
        abstain,
        absent,
        tally: tallyLabel(yes, no, abstain, absent),
        members,
      };
    })
    .sort((a, b) => b.meetingDate.localeCompare(a.meetingDate));
}

export async function getMemberTallies(): Promise<MemberTally[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("member_vote_tallies")
    .select(
      "person_id, name, title, body_name, body_slug, district, term_start, term_end, active, sort_order, votes_cast, yes_count, no_count, abstain_count, absent_count",
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
      bodySlug: r.body_slug,
      bodyLabel: bodyShortName(r.body_slug, r.body_name ?? "Not stated"),
      district: r.district,
      seat: seatLabel(r.district),
      term: termLabel(r.term_start, r.term_end),
      votesCast: Number(r.votes_cast ?? 0),
      yes: Number(r.yes_count ?? 0),
      no: Number(r.no_count ?? 0),
      abstain: Number(r.abstain_count ?? 0),
      absent: Number(r.absent_count ?? 0),
    }));
}

/**
 * The same tallies, split into one table per body.
 *
 * A single table mixing a school board with a city council invites a reader to
 * compare two members who never sat in the same room. Grouping is what stops
 * that without editorialising about it.
 */
export function groupTalliesByBody(
  members: MemberTally[],
): { slug: string | null; label: string; members: MemberTally[] }[] {
  const groups = new Map<string, { slug: string | null; label: string; members: MemberTally[] }>();
  for (const member of members) {
    const key = member.bodySlug ?? "";
    const group = groups.get(key);
    if (group) group.members.push(member);
    else groups.set(key, { slug: member.bodySlug, label: member.bodyLabel, members: [member] });
  }
  return [...groups.values()].sort((a, b) => compareBodies(a.slug, b.slug));
}

export async function getBodies() {
  const supabase = createPublicClient();
  const { data, error } = await supabase.from("bodies").select("id, name, slug").order("name");
  if (error) throw new Error(`Could not load bodies: ${error.message}`);
  return data ?? [];
}
