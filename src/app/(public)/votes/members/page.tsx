import type { Metadata } from "next";
import Link from "next/link";
import { getMemberTallies, groupTalliesByBody } from "@/lib/queries/votes";
import { ScrollableTable } from "@/components/public/scrollable-table";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Voting records by member",
  description:
    "How each Toledo Public Schools board member has voted on the money and staffing decisions The Mona K Project tracks.",
};

export default async function MembersPage() {
  const members = await getMemberTallies();
  const groups = groupTalliesByBody(members);

  return (
    <>
      <header className="wrap page-head">
        <h1>Voting records by member</h1>
        <p className="lede">
          Counted from the votes we have logged. A member&rsquo;s totals cover only the
          meetings in our Vote Watch log, not their whole term.
        </p>
        <div className="actions">
          <Link className="btn ghost" href="/votes">
            Back to Vote Watch
          </Link>
        </div>
      </header>

      <section className="wrap vote-section">
        {members.length === 0 ? (
          <p className="sub">No members have been added yet.</p>
        ) : (
          groups.map((group) => {
            // A body that does not divide itself into districts gets no seat
            // column. Printing "At large" against every name on the school
            // board says nothing and costs a column on a phone.
            const hasDistricts = group.members.some((member) => member.district);
            return (
            <div className="member-group" key={group.slug ?? group.label}>
              <h2>{group.label}</h2>
              <ScrollableTable label={`Voting records, ${group.label}`}>
                <table className="data-table">
                  <caption>
                    {group.members.length} {group.members.length === 1 ? "member" : "members"}.
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Name</th>
                      {hasDistricts ? <th scope="col">Seat</th> : null}
                      <th scope="col">Term</th>
                      <th scope="col" className="num">Votes cast</th>
                      <th scope="col" className="num">Yes</th>
                      <th scope="col" className="num">No</th>
                      <th scope="col" className="num">Abstain</th>
                      <th scope="col" className="num">Absent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.members.map((member) => (
                      <tr key={member.personId}>
                        <th scope="row">{member.name}</th>
                        {hasDistricts ? <td>{member.seat}</td> : null}
                        <td>{member.term}</td>
                        <td className="num">{member.votesCast}</td>
                        <td className="num">{member.yes}</td>
                        <td className="num">{member.no}</td>
                        <td className="num">{member.abstain}</td>
                        <td className="num">{member.absent}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollableTable>
            </div>
            );
          })
        )}
      </section>
    </>
  );
}
