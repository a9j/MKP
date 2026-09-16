import type { Metadata } from "next";
import Markdown from "react-markdown";
import { getListeningSessions } from "@/lib/queries/site";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Listening",
  description:
    "What Toledo teachers and parents told The Mona K Project, published in full, and what it changed about what we build next.",
};

export default async function ListeningPage() {
  const sessions = await getListeningSessions();

  return (
    <>
      <header className="wrap page-head">
        <h1>What we heard, and what it changed.</h1>
        <p className="lede">
          Three times a year we hold listening sessions with teachers, and once a year
          with parents. What we hear is published and shapes what we build next.
        </p>
      </header>

      <section className="wrap vote-section">
        {sessions.length === 0 ? (
          <p className="sub">No listening summaries have been published yet.</p>
        ) : (
          <div className="vote-log">
            {sessions.map((session) => (
              <article className="vote" key={session.id}>
                <div className="vote-head">
                  <span className="vote-date">{session.sessionDateLabel}</span>
                  <span className="vote-kind">{session.audienceLabel}</span>
                  {session.attendeeCount !== null ? (
                    <span className="vote-date">{session.attendeeCount} attended</span>
                  ) : null}
                </div>

                <div className="report-summary">
                  <Markdown>{session.summary}</Markdown>
                </div>

                {session.heard.length > 0 ? (
                  <>
                    <h3 className="listening-head">What we heard</h3>
                    <ul className="listening-list">
                      {session.heard.map((point) => (
                        <li key={point}>{point}</li>
                      ))}
                    </ul>
                  </>
                ) : null}

                {session.changes.length > 0 ? (
                  <>
                    <h3 className="listening-head">What it changes</h3>
                    <ul className="listening-list">
                      {session.changes.map((point) => (
                        <li key={point}>{point}</li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
