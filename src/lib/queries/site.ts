import { createPublicClient } from "@/lib/supabase/public";
import { formatDay } from "@/lib/queries/records";

export type ListeningPoint = { kind: "heard" | "changes"; text: string };

export type ListeningSession = {
  id: string;
  sessionDate: string;
  sessionDateLabel: string;
  audience: "teachers" | "parents";
  audienceLabel: string;
  attendeeCount: number | null;
  summary: string;
  heard: string[];
  changes: string[];
};

export type Person = {
  id: string;
  name: string;
  title: string | null;
  bio: string | null;
  photoPath: string | null;
  role: "staff" | "board" | "advisory" | "body_member";
};

export type Correction = {
  id: string;
  correctionDate: string;
  correctionDateLabel: string;
  pagePath: string;
  whatChanged: string;
  why: string;
};

/** Published listening sessions, newest first. Drafts are hidden by RLS. */
export async function getListeningSessions(): Promise<ListeningSession[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("listening_sessions")
    .select(
      "id, session_date, audience, attendee_count, summary, listening_points(kind, text, sort_order)",
    )
    .eq("status", "published")
    .order("session_date", { ascending: false });
  if (error) throw new Error(`Could not load listening sessions: ${error.message}`);

  return (data ?? []).map((row) => {
    const points = [...(row.listening_points ?? [])].sort((a, b) => a.sort_order - b.sort_order);
    return {
      id: row.id,
      sessionDate: row.session_date,
      sessionDateLabel: formatDay(row.session_date),
      audience: row.audience as "teachers" | "parents",
      audienceLabel: row.audience === "teachers" ? "Teachers" : "Parents",
      attendeeCount: row.attendee_count,
      summary: row.summary ?? "",
      heard: points.filter((p) => p.kind === "heard").map((p) => p.text),
      changes: points.filter((p) => p.kind === "changes").map((p) => p.text),
    };
  });
}

export async function getPeople(): Promise<Record<string, Person[]>> {
  const supabase = createPublicClient();
  // email is deliberately not selected: the anon role cannot read that column.
  const { data, error } = await supabase
    .from("people")
    .select("id, name, title, bio, photo_path, role, sort_order")
    .eq("active", true)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(`Could not load people: ${error.message}`);

  const grouped: Record<string, Person[]> = { staff: [], board: [], advisory: [], body_member: [] };
  for (const row of data ?? []) {
    grouped[row.role]?.push({
      id: row.id,
      name: row.name,
      title: row.title,
      bio: row.bio,
      photoPath: row.photo_path,
      role: row.role as Person["role"],
    });
  }
  return grouped;
}

export async function getCorrections(): Promise<Correction[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("corrections")
    .select("id, correction_date, page_path, what_changed, why")
    .order("correction_date", { ascending: false });
  if (error) throw new Error(`Could not load corrections: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id,
    correctionDate: row.correction_date,
    correctionDateLabel: formatDay(row.correction_date),
    pagePath: row.page_path,
    whatChanged: row.what_changed,
    why: row.why,
  }));
}
