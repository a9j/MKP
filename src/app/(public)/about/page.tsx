import type { Metadata } from "next";
import { Photo } from "@/components/photo";
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
      <header className="civic-page-hero">
        <div className="wrap civic-page-hero-inner">
          <p className="civic-kicker">About</p>
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
        </div>
      </header>
      <Photo
        file="for-parents.jpg"
        alt="Toledo parents with their children"
        ratio="21 / 8"
        sizes="100vw"
        className="civic-photo-band"
        priority
      />

      <section className="wrap civic-section">
        <p className="civic-kicker-dark">Principles</p>
        <h2>What we will not bend on.</h2>
        {/* A ul, not an ol: no principle here outranks another, and numbering
            them read as a ranking. */}
        <ul className="civic-points">
          {PRINCIPLES.map((principle) => (
            <li key={principle}>
              <p style={{ fontSize: 20, fontWeight: 600, color: "#0F2A44" }}>{principle}</p>
            </li>
          ))}
        </ul>
        {/* Said plainly, on the page, rather than buried in a policy nobody
            opens. Editable from /admin/settings, and it ships filled in. */}
        {settings.ai_disclosure ? (
          <p className="civic-note">{settings.ai_disclosure}</p>
        ) : null}
      </section>

      <section className="civic-band civic-band-teal">
        <div className="wrap">
          <p className="civic-kicker">Listening</p>
          <h2>We listen before we publish.</h2>
          <p className="sub">
            Three times a year we hold listening sessions with teachers, and once a year
            with parents. What we hear is published and shapes what we build next.
          </p>
          <div className="actions">
            {latestSession ? (
              <Link className="btn btn-gold" href="/listening">
                Read the most recent listening summary
              </Link>
            ) : (
              <span className="unavailable">No listening summary published yet.</span>
            )}
          </div>
        </div>
      </section>

      <section className="wrap civic-section">
        <p className="civic-kicker-dark">People</p>
        <h2>Who does the reading.</h2>
        {people.staff.length === 0 ? (
          <p className="civic-empty">Staff are not listed yet.</p>
        ) : (
          <div className="civic-cards">
            {people.staff.map((person) => (
              <div className="civic-card" key={person.id}>
                <h3>{person.name}</h3>
                {person.title ? <p><strong>{person.title}</strong></p> : null}
                <p>
                  {person.bio ?? "Toledo-area, recruiting and workforce background."}
                </p>
              </div>
            ))}
          </div>
        )}

        <h2 style={{ marginTop: 64 }}>Advisory Council</h2>
        <p className="civic-section-lede">
          Council members review every report before release. They serve as individuals,
          not as representatives of their employers.
        </p>
        {people.advisory.length === 0 ? (
          <p className="civic-empty">The council is forming. Names will appear here.</p>
        ) : (
          <div className="civic-cards">
            {people.advisory.map((person) => (
              <div className="civic-card" key={person.id}>
                <h3>{person.name}</h3>
                {person.title ? <p><strong>{person.title}</strong></p> : null}
                {person.bio ? <p>{person.bio}</p> : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="civic-band civic-band-paper">
        <div className="wrap">
          <p className="civic-kicker-dark">Partners</p>
          <h2>Built with help.</h2>
          <p className="sub">
            The Toledo Teacher Pay Explorer is built and maintained by TeacherRaise and
            licensed to The Mona K Project at no cost.
          </p>
          <p className="civic-note">{settings.partners_note ?? "Other partners as confirmed."}</p>
        </div>
      </section>

      <section className="wrap civic-section">
        <p className="civic-kicker-dark">The organization</p>
        <h2>A nonprofit, in the open.</h2>
        <p className="civic-section-lede">
          The Mona K Project is a 501(c)(3) nonprofit based in Toledo, Ohio. EIN{" "}
          {settings.org_ein ?? "[XX-XXXXXXX]"}. Donations are tax-deductible to the
          extent allowed by law.
        </p>
        <div className="actions" style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {settings.form_990_url ? (
            <a className="btn btn-gold" href={settings.form_990_url} target="_blank" rel="noopener noreferrer">
              Form 990 and financials
            </a>
          ) : (
            <span className="unavailable">[Link: Form 990 / financials]</span>
          )}
          <Link className="btn btn-outline-navy" href="/corrections">
            Corrections log
          </Link>
        </div>
      </section>
    </>
  );
}
