import type { Metadata } from "next";
import Link from "next/link";
import { VoteList } from "@/components/public/vote-list";
import { getVotes } from "@/lib/queries/votes";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Vote Watch",
  description:
    "Every Toledo Public Schools board vote on money or staffing, summarized in one sentence with each member's vote.",
};

export default async function VotesPage() {
  const votes = await getVotes();

  return (
    <>
      <header className="wrap page-head">
        <h1>What the board decided, what it costs, and who voted how.</h1>
        <p className="lede">
          Every Toledo Public Schools board vote that touches money or staffing, with
          a one-sentence summary in plain language and each member&rsquo;s vote. As we
          grow, the same treatment extends to city council and county.
        </p>
        <div className="actions">
          <Link className="btn ghost" href="/votes/members">
            Voting records by member
          </Link>
        </div>
      </header>

      <section className="wrap vote-section">
        <VoteList votes={votes} />
        <p className="note">
          Summaries describe what was decided, not whether it was a good decision. We
          do not editorialize.
        </p>
      </section>
    </>
  );
}
