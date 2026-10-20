import type { Metadata } from "next";
import Link from "next/link";
import { Photo } from "@/components/photo";
import { InquiryForm } from "@/components/public/inquiry-form";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Receipts: Youth Records Fellowship",
  description:
    "Receipts is The Mona K Project's paid, year-long fellowship where Toledo teens investigate how public money and public decisions work, then publish what they find as short videos and source-linked explainers.",
};

/** From the Receipts master program document, October 2026. */
const GLANCE = [
  { label: "Who", value: "8 to 10 Toledo teens per season, ages 15 to 21" },
  { label: "Length", value: "One school year, run as a season of about 30 weeks" },
  { label: "Time", value: "About 6 paid hours a week: one evening session plus independent work" },
  { label: "Pay", value: "$15 an hour, paid every two weeks" },
  { label: "Home base", value: "A Toledo Lucas County Public Library branch" },
  { label: "Output", value: "Published cases: short videos, source-linked explainers, and public records requests" },
  { label: "Launch", value: "Season Zero pilot, February to May 2027. Season One begins September 2027" },
];

const FOUR_WAYS = [
  {
    title: "Records first",
    body: "Every investigation starts with public documents: budgets, contracts, agendas, audits, board minutes. Every published claim links to its source, and the source document appears on screen in the video.",
  },
  {
    title: "Creator native",
    body: "The main output is 60 to 90 second vertical video for TikTok, Reels, and Shorts, the formats young people already live on. The full explainer lives here on monakproject.org.",
  },
  {
    title: "Youth as investigators, not interns",
    body: "Fellows are paid from week one, carry press passes, own real beats, and publish under their own bylines.",
  },
  {
    title: "Impact measured in the room",
    body: "Success is counted not only in views, but in records requests filed and in how often fellows' work is cited by press or raised at a public meeting.",
  },
];

const DESKS = [
  { name: "Schools", body: "Toledo Public Schools board votes, levies, budgets, staffing, and facilities. Explains what each school ballot measure would actually do." },
  { name: "City Hall", body: "Toledo City Council votes, ordinances, contracts, and development decisions. Plain-language summaries before and after key votes." },
  { name: "Neighborhood", body: "Housing, demolition, parks, infrastructure, and vacant properties. Shows residents where public money went on their own blocks." },
  { name: "Money", body: "City and school budgets, audits, grants, and capital projects. Follows dollars from approval to outcome." },
  { name: "Youth", body: "Youth employment, recreation, transportation, and policies affecting young people." },
];

const SEASON = [
  {
    title: "Fall: Learn it",
    when: "Weeks 1 to 10",
    body: "Fellows learn to read budgets and salary scales, the basics of public records law, how to cite every source, and camera and editing fundamentals. AI tools are taught with one standing rule: AI can help you find the receipt. AI is never the receipt.",
  },
  {
    title: "Winter: Work it",
    when: "Weeks 11 to 20",
    body: "Each pair owns its desk live. Pairs file records requests through our Records Desk, cover votes for Vote Watch, and ship a short video per case. The youth participatory budgeting process opens.",
  },
  {
    title: "Spring: Ship it",
    when: "Weeks 21 to 30",
    body: "Each fellow completes one major case. Desks deliver formal presentations to public bodies. The participatory budgeting vote and awards happen. The season ends with a finale screening, families invited.",
  },
];

const PIPELINE = [
  {
    title: "Present the receipt",
    body: "Each desk delivers its findings as a formal 10-minute presentation to the body that controls the money: a scheduled agenda item, not a three-minute public-comment slot. Data packets go to members in advance.",
  },
  {
    title: "Youth participatory budgeting",
    body: "Fellows run a real budgeting process with a $12,000 fund they fully control. They solicit proposals from Toledo youth ages 14 to 21, write the judging criteria, vote, award the money, then track every dollar and publish a public report on what it did.",
  },
  {
    title: "Youth advisor seats",
    body: "Two fellows who complete the season become Youth Advisors for a full year, one to the TPS board and one to a city council committee, under a written charter. Every written recommendation gets a written response within 30 days.",
  },
];

const WALK_AWAY = [
  { title: "Real income", body: "About 180 paid hours over the season, roughly $2,700." },
  { title: "A public portfolio", body: "Published videos and explainers under their own byline." },
  { title: "Transferable skills", body: "Research, public records law basics, writing, on-camera presenting, video editing, and public speaking." },
  { title: "A strong reference", body: "A letter from MKP's Executive Director, a senior recruiter who has hired hundreds of people." },
  { title: "A network", body: "Introductions to journalists, public officials, and employers met through the work." },
  { title: "A path", body: "Alumni can become Senior Fellows, Youth Editors, paid summer interns, and Youth Advisors. And every graduating fellow keeps their mic." },
];

const SAFEGUARDS = [
  "All public records requests are filed in MKP's name, never a fellow's.",
  "Videos post on MKP's accounts only. Fellows may share them but are never required to.",
  "Being on camera is optional. Fellows can research, narrate, or edit instead.",
  "Parent or guardian consent covers participation, filming, and publishing for anyone under 18.",
  "Background checks for every adult who works directly with fellows. No one-on-one adult and minor meetings in private spaces.",
  "Nothing publishes without a second review and the Executive Director's sign-off. Fellows explain what the records say; they take no positions and make no voting recommendations.",
];

export default function ReceiptsPage() {
  return (
    <>
      <header className="civic-page-hero">
        <div className="wrap civic-page-hero-inner">
          <p className="civic-kicker">Receipts: Youth Records Fellowship</p>
          <h1>We read what they hope you won&apos;t.</h1>
          <p className="lede">
            Receipts is a paid, year-long fellowship where Toledo teens investigate how
            public money and public decisions work, then publish what they find as short
            videos and source-linked explainers. Find the receipt. Show the receipt.
            Explain the receipt.
          </p>
          <p className="lede">
            Like everything we do, Receipts is nonpartisan. Fellows explain what the
            records say and never tell anyone how to vote.
          </p>
        </div>
      </header>
      <Photo
        file="receipts-crew.jpg"
        alt="Toledo teens working together at a library table"
        ratio="21 / 8"
        sizes="100vw"
        className="civic-photo-band"
        priority
      />

      <section className="wrap civic-section">
        <p className="civic-kicker-dark">At a glance</p>
        <h2>Paid work. Real beats. Published under your own name.</h2>
        <div className="civic-cards">
          {GLANCE.map((row) => (
            <div className="civic-card" key={row.label}>
              <div className="tag">{row.label}</div>
              <p style={{ fontSize: 18, fontWeight: 600, color: "#0F2A44" }}>{row.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="civic-steps">
        <div className="wrap">
          <p className="civic-kicker">The idea</p>
          <h2>A new model of local journalism, run by the people who will inherit Toledo.</h2>
          <ol>
            {FOUR_WAYS.map((item, i) => (
              <li key={item.title}>
                <span className="civic-step-n">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="wrap civic-section">
        <p className="civic-kicker-dark">How it works</p>
        <h2>Pairs and desks.</h2>
        <p className="lede" style={{ maxWidth: "44em" }}>
          Fellows work in pairs, and each pair staffs one desk for the season. Pairs share a
          creator kit: phone gimbal, wireless mics, ring light, and an editing app.
          Investigations are organized as numbered cases, not assignments. Every case has a
          question, a records request, and a reveal. Residents submit questions through the
          Receipts Queue, and monthly pitch meetings decide which cases the crew takes on.
        </p>
        <div className="civic-cards">
          {DESKS.map((desk, i) => (
            <div className={`civic-card ${["tone-navy", "tone-teal", "tone-gold", "", ""][i]}`} key={desk.name}>
              <div className="tag">Desk</div>
              <h3>{desk.name}</h3>
              <p>{desk.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="civic-band civic-band-teal">
        <div className="wrap">
          <p className="civic-kicker">The season</p>
          <h2>Thirty weeks in three phases.</h2>
          <div className="civic-cards">
            {SEASON.map((phase) => (
              <div className="civic-card" key={phase.title}>
                <div className="tag">{phase.when}</div>
                <h3>{phase.title}</h3>
                <p>{phase.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="wrap civic-section">
        <p className="civic-kicker-dark">The Decision Room Pipeline</p>
        <h2>Investigation without a path to power teaches cynicism.</h2>
        <p className="lede" style={{ maxWidth: "44em" }}>
          So the pipeline is built in. Three stages carry fellows from findings into the rooms
          where decisions are made.
        </p>
        <ol className="civic-numbered">
          {PIPELINE.map((stage, i) => (
            <li key={stage.title}>
              <span className="n">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <h3>{stage.title}</h3>
                <p>{stage.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="civic-note">
          The power is in the paper trail: a public body must answer a young person&apos;s
          recommendation in writing, on the record.
        </p>
      </section>

      <section className="civic-band civic-band-navy">
        <div className="wrap">
          <p className="civic-kicker">What fellows walk away with</p>
          <h2>More than a line on a resume.</h2>
          <div className="civic-cards">
            {WALK_AWAY.map((item) => (
              <div className="civic-card" key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="wrap civic-section">
        <p className="civic-kicker-dark">Safeguards</p>
        <h2>Fellows first. Accuracy second. Nothing else close.</h2>
        <ol className="civic-numbered">
          {SAFEGUARDS.map((rule, i) => (
            <li key={rule}>
              <span className="n">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <p style={{ fontSize: 20, fontWeight: 600, color: "#0F2A44" }}>{rule}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="civic-note">
          No program funds are used for voter registration, lobbying, or partisan activity.
          Corrections are posted openly on our <Link href="/corrections">corrections page</Link>.
        </p>
      </section>

      <section className="civic-band civic-band-gold">
        <div className="wrap">
          <p className="civic-kicker">Who it serves</p>
          <h2>No experience needed.</h2>
          <p className="sub" style={{ maxWidth: "44em" }}>
            Receipts recruits teens who need the paycheck and the adult in their corner, not
            only those already headed to college. Toledo high school students ages 15 to 18,
            with reserved seats for 18 to 21 year olds who are out of school and not working.
            No writing samples, no grade minimums, no prior video work. We look for curiosity,
            reliability, and a willingness to show up for a full season. At least half of each
            cohort is recruited from underinvested Toledo neighborhoods.
          </p>
        </div>
      </section>

      <section className="wrap civic-section" id="interest">
        <p className="civic-kicker-dark">Get on the list</p>
        <h2>Season Zero recruits in January 2027.</h2>
        <p className="lede" style={{ maxWidth: "44em" }}>
          Teens, parents, teachers, mentors, and funders: tell us who you are and we will
          reach out when applications open. Funders and partners can also read the full
          program document on request.
        </p>
        <InquiryForm
          kind="contact"
          idPrefix="receipts"
          submitLabel="Keep me posted on Receipts"
          audiences={["A teen who wants to apply", "A parent or guardian", "A teacher or counselor", "A potential mentor or guest speaker", "A funder or partner"]}
          messageLabel="Anything we should know"
        />
        <p className="civic-note" style={{ marginTop: 32 }}>
          Questions? Email <a href="mailto:hello@monakproject.org">hello@monakproject.org</a>.
        </p>
      </section>
    </>
  );
}
