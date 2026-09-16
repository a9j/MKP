import type { Metadata } from "next";
import Link from "next/link";
import { getPeople } from "@/lib/queries/site";
import { getListeningSessions } from "@/lib/queries/site";
import { getSiteSettings } from "@/lib/queries/settings";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "About",
  description:
    "The Mona K Project is a Toledo nonprofit that makes public records readable. No positions, no endorsements, every number linked to its source.",
};

/** Principles, verbatim from the copy doc. */
const PRINCIPLES = [
  "Every number links to its source. If we cannot source it, we do not publish it.",
  "Plain language. If it takes more than four minutes, we rewrite it.",
  "No positions. We explain the records; Toledo decides.",
  "Reviewed before release. Nothing goes out without the advisory council reading it first.",
  "Free, always. No paywalls, no memberships, no premium reports.",
];

export default async function AboutPage() {
  const [people, sessions, settings] = await Promise.all([
    getPeople(),
    getListeningSessions(),
    getSiteSettings(),
  ]);

  const latestSession = sessions[0];

  return (
    <>
      <header className="wrap page-head">
        <h1>We read what nobody has time to read.</h1>
        <p className="lede">
          School budgets, salary schedules, board votes, levies, and city finances are
          all public. But they arrive as hundreds of pages nobody has time for. The
          Mona K Project reads them and turns them into a page a teacher, a parent, or
          a taxpayer can understand in four minutes, with every number linked to the
          document it came from.
        </p>
        <p className="lede">
          We do not take positions, endorse candidates, or recommend how to vote. We
          show what the records say and let Toledo decide.
        </p>
      </header>

      <section className="wrap vote-section">
        <h2>Principles</h2>
        <ul className="listening-list principles">
          {PRINCIPLES.map((principle) => (
            <li key={principle}>{principle}</li>
          ))}
        </ul>
      </section>

      <section className="band">
        <div className="wrap">
          <h2>Listening</h2>
          <p className="sub">
            Three times a year we hold listening sessions with teachers, and once a year
            with parents. What we hear is published and shapes what we build next.
          </p>
          <p className="report-actions">
            {latestSession ? (
              <Link href="/listening">
                Read the most recent listening summary, {latestSession.sessionDateLabel}
              </Link>
            ) : (
              <span className="unavailable">No listening summary published yet.</span>
            )}
          </p>
        </div>
      </section>

      <section className="wrap vote-section">
        <h2>People</h2>
        {people.staff.length === 0 ? (
          <p className="sub">Staff are not listed yet.</p>
        ) : (
          <div className="people">
            {people.staff.map((person) => (
              <div className="person" key={person.id}>
                <h3>{person.name}</h3>
                {person.title ? <p className="person-title">{person.title}</p> : null}
                <p>
                  {person.bio ?? "[One or two sentences: Toledo-area, recruiting and workforce background, why he started this.]"}
                </p>
              </div>
            ))}
          </div>
        )}

        <h2 className="section-gap">Advisory Council</h2>
        {people.advisory.length === 0 ? (
          <p className="sub">[Forming.]</p>
        ) : (
          <div className="people">
            {people.advisory.map((person) => (
              <div className="person" key={person.id}>
                <h3>{person.name}</h3>
                {person.title ? <p className="person-title">{person.title}</p> : null}
                {person.bio ? <p>{person.bio}</p> : null}
              </div>
            ))}
          </div>
        )}
        <p className="note">
          Council members review every report before release. They serve as individuals,
          not as representatives of their employers.
        </p>
      </section>

      <section className="band">
        <div className="wrap">
          <h2>Partners</h2>
          <p className="sub">
            The Toledo Teacher Pay Explorer is built and maintained by TeacherRaise and
            licensed to The Mona K Project at no cost.
          </p>
          <p className="note">{settings.partners_note ?? "[Other partners as confirmed]"}</p>
        </div>
      </section>

      <section className="wrap vote-section">
        <h2>The organization</h2>
        <p className="sub">
          The Mona K Project is a 501(c)(3) nonprofit based in Toledo, Ohio. EIN{" "}
          {settings.org_ein ?? "[XX-XXXXXXX]"}. Donations are tax-deductible to the
          extent allowed by law.
        </p>
        <p className="report-actions">
          {settings.form_990_url ? (
            <a href={settings.form_990_url} target="_blank" rel="noopener noreferrer">
              Form 990 and financials
            </a>
          ) : (
            <span className="unavailable">[Link: Form 990 / financials]</span>
          )}
          <Link href="/corrections">Corrections log</Link>
        </p>
      </section>
    </>
  );
}
