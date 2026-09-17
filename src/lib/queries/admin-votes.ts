import "server-only";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatDay } from "@/lib/queries/records";
import type { MeetingOption } from "@/components/admin/vote-form";

/**
 * Meetings for the vote form, most recent first so the field opens on the one
 * a vote is most likely being entered for.
 */
export async function getMeetingOptions(): Promise<MeetingOption[]> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("meetings")
    .select("id, body_id, meeting_date, kind, agenda_url, minutes_url, bodies(name)")
    .order("meeting_date", { ascending: false })
    .limit(50);

  return (data ?? []).map((m) => {
    const bodyName = m.bodies?.name ?? "Not stated";
    return {
      id: m.id,
      bodyId: m.body_id,
      bodyName,
      meetingDate: m.meeting_date,
      label: `${bodyName}, ${formatDay(m.meeting_date)}${m.kind === "special" ? ", special" : ""}`,
      agendaUrl: m.agenda_url,
      minutesUrl: m.minutes_url,
    };
  });
}

/** Bodies, ordered so the one with a roll call to fill in comes first. */
export async function getBodiesByMemberCount() {
  const supabase = await createServerSupabase();
  const [{ data: bodies }, { data: members }] = await Promise.all([
    supabase.from("bodies").select("id, name, slug").order("name"),
    supabase.from("people").select("body_id").eq("role", "body_member").eq("active", true),
  ]);

  const counts = new Map<string, number>();
  for (const person of members ?? []) {
    if (person.body_id) counts.set(person.body_id, (counts.get(person.body_id) ?? 0) + 1);
  }

  return [...(bodies ?? [])].sort((a, b) => {
    const diff = (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0);
    return diff !== 0 ? diff : a.name.localeCompare(b.name);
  });
}
