import type { Metadata } from "next";
import { Photo } from "@/components/photo";
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
      <header className="civic-page-hero">
        <div className="wrap civic-page-hero-inner">
          <p className="civic-kicker">Vote Watch</p>
          <h1>What the board decided, what it costs, and who voted how.</h1>
          <p className="lede">
            Every Toledo Public Schools board vote that touches money or staffing, with
            a one-sentence summary in plain language and each member&rsquo;s vote. As we
            grow, the same treatment extends to city council and county.
          </p>
          <div className="actions">
            <Link className="btn btn-gold" href="/votes/members">
              Voting records by member
            </Link>
          </div>
        </div>
      </header>
      <Photo
        src="for-residents.jpg"
        alt="Toledo residents in their neighborhood"
        ratio="21 / 8"
        className="civic-photo-band"
        eager
      />

      <section className="wrap civic-section">
        <VoteList votes={votes} />
        <p className="civic-note">
          Summaries describe what was decided, not whether it was a good decision. We
          do not editorialize.
        </p>
      </section>
    </>
  );
}
