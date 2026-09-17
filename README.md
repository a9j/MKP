# The Mona K Project

The public website and admin panel for The Mona K Project, a Toledo, Ohio
501(c)(3) nonprofit that reads public records and explains them in plain
language. Every published number links to the public document it came from.

The organization takes no positions, endorses no candidates, and makes no vote
recommendations.

## Stack

Next.js 15 with the App Router and React Server Components, TypeScript in strict
mode, Tailwind CSS v4, Supabase for Postgres, Auth and Storage, Resend for mail,
Plausible for analytics, and Vercel for hosting. Package manager is pnpm.

## Environment variables

Copy `.env.example` to `.env.local` and fill it in.

| Variable | What it is |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL, from Project Settings, API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anonymous key. Safe in the browser, limited by RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key. Server only, bypasses RLS, never expose it |
| `RESEND_API_KEY` | Resend API key for the contact form, council previews and subscriber mail. Without it, mail is written to `.local-storage/emails` instead of being sent, so nothing is ever dropped silently |
| `NEXT_PUBLIC_SITE_URL` | Absolute site URL. Confirmation links, council preview links, Open Graph images and the sitemap are all built from it |
| `EMAIL_FROM` | Optional. The from address on outgoing mail. Defaults to `The Mona K Project <hello@monakproject.org>` |
| `SUBSCRIBE_TOKEN_SECRET` | Optional. Signs subscriber confirmation links. Defaults to the service role key |
| `AUTOMATION_ENABLED` | Master switch for the scheduled collectors and every model call. `false` by default, and nothing reads it yet |
| `ANTHROPIC_API_KEY` | For drafting only, once the collectors land. A model never publishes anything |
| `CRON_SECRET` | Shared secret the scheduled routes check before doing any work |

The last three are for the collection and drafting work, which is not built
yet. The site runs completely without them.

Every read of these goes through `src/lib/env.ts`, so a missing variable fails
with a message naming it rather than showing an empty page.

## Running it locally

The public pages are statically rendered at build time, so the database has to
be reachable before `pnpm build` will succeed.

### Option A: against a Supabase project

1. Create a project at supabase.com.
2. Run `supabase/migrations/0001_init.sql` in the SQL editor.
3. Create a Storage bucket named `documents` with public read.
4. Fill in `.env.local` and run `pnpm install && pnpm dev`.

### Option B: against a local stack, no Supabase account needed

Needs Postgres 16 and the `postgrest` binary on your PATH.

```sh
bash scripts/local-supabase.sh
```

That creates the `mkp_dev` database, applies the migration and the development
seed, starts PostgREST, and starts a small gateway that serves PostgREST under
`/rest/v1` the way Supabase does.

Then copy `.env.example` to `.env.local` and uncomment the local stack block at
the bottom of it. Those keys are JWTs signed with the script's development
secret and only work against Postgres on your own machine.

```sh
pnpm install
pnpm dev
```

## Signing in

Magic link only. Ask for a link at `/admin/login`, follow it, and you are in.
The link works once. Middleware sends a signed out visitor to sign in, but that
is a convenience: every admin page and every server action checks for an
administrator itself, and RLS refuses the write regardless.

Being signed in is not the same as being allowed in. An address that is not in
the `admins` table is signed straight back out with a clear message.

## Adding an admin

Magic link sign in is limited to addresses listed in the `admins` table. There
is no password anywhere in the system. To add someone:

```sql
insert into admins (email, name) values ('them@example.org', 'Their Name');
```

Case does not matter: `is_admin()` compares lowercased addresses.

## Tests

| Command | What it covers |
| --- | --- |
| `pnpm test:db` | Applies the migrations to a throwaway Postgres and runs 67 assertions on `business_days_between`, the `latest_feed` view, the source and length constraints, the rule that only a person may publish, and the RLS rules for anonymous, non-admin, admin and service role callers |
| `pnpm test:data` | 45 tests. Runs the query layer against real PostgREST: feed ordering, draft exclusion, settings filtering, the Explorer rules, CSV parsing and validation, and the RLS boundaries as `supabase-js` sees them. Also the site URL and the mail fallback, neither of which needs the database |
| `pnpm test:visual` | Compares the rendered home page against `mona-k-homepage-mockup.html` element by element |
| `pnpm test:lighthouse` | Lighthouse over all 11 public routes in mobile emulation. Fails if any category on any route drops below 95 |
| `pnpm test:e2e` | Playwright, 47 tests. Public pages render, the Explorer updates on input change, admin routes redirect to sign in, a vote posted through the admin UI appears on `/votes` and in the Latest feed, a salary CSV with a missing `source_url` is refused, a draft report stays off the public site while its preview link opens without a login, "Send to council" reaches every advisory member, a subscriber is never written to before confirming, a publish notice reaches confirmed addresses only, a machine written draft appears on no public page, and the Publish button on such a draft stays disabled until the reviewer confirms they checked it against the document. It also runs axe over every public and admin screen in light mode, dark mode and at 390px, and fails on any WCAG 2.1 A or AA violation |

`pnpm test:data`, `pnpm test:visual` and `pnpm test:e2e` need the local stack
and a running app.

The local stack includes a small stand in for the Supabase auth server, so the
end to end tests sign in through the real magic link flow rather than forging a
session. Links are written to `.local-storage/magic-links.json` instead of being
emailed; `scripts/local-supabase.sh` prints them too.

The mockup loads Instrument Sans from the Google Fonts CDN. Where that is
unreachable it silently falls back to a system font and every measurement
drifts, so `test:visual` serves the mockup from a local origin and proxies the
app's self hosted font files to it. Both pages then render with the same font.

## Uploading the first salary schedule

Sign in at `/admin/login`, then go to `/admin/explorer`. Upload a CSV with these
columns, in any order:

```
school_year,district,lane,step,salary,source_url
2026-2027,Toledo Public Schools,BA,1,44000,https://example.com/schedule.pdf
```

`data/samples/` holds an example of each file in the exact expected format.

Before anything is written you get the problems, a count of rows added, changed,
unchanged and left alone, and a preview of the rows themselves. Nothing is
imported until you press commit.

A row with no `source_url` is refused with its line number, and a file with any
problem in it is refused whole. That rule is enforced three times over: by the
CSV validator, by a check constraint in the database, and by the Explorer query
layer, which stops the build rather than render a figure with nothing behind it.

Uploading again updates the rows in the file and leaves every other row alone.
It never deletes.

The Explorer reads the newest `school_year` present, and treats the district
named in the `explorer_home_district` setting as "you". A district that
publishes different lane names shows "Not directly comparable" rather than a
guess. The inflation line needs a 2010 schedule and CPI rows for 2010 and a
later year; without them the line is hidden rather than estimated.

## Posting a vote

At `/admin/votes`. Choose the meeting, or add one with **New meeting** without
leaving the screen. Give the agenda item title, one sentence of plain summary
capped at 200 characters, a category, an amount if the record states one, and a
link to the paper for that item. The roll call opens with every active member of
that body set to Yes, so only the exceptions need touching, and the tally is
counted from the roll call rather than typed, so the two can never disagree.

**Publish** puts it on the site at once. **Save as draft** keeps it in the admin
until the minutes are out. Drafts appear on the dashboard under "Waiting for
review" and nowhere public.

## Software collects and drafts, a person publishes

This is the one rule the database enforces rather than trusting the code to
keep. `status` reaches `published` only from a signed in admin: a trigger on
`votes`, `reports` and `listening_sessions` refuses the write when the caller is
the service role, which is what the scheduled collectors and any model call run
as. A row level policy could not do this, because the Supabase service role
holds `BYPASSRLS` and policies are never consulted for it.

A vote a machine drafted carries `ai_draft = true`. It is invisible to the
anonymous key, it is kept out of `latest_feed` and the voting record, and it is
marked "AI draft, unreviewed" wherever it appears in the admin. The Publish
button on such a draft stays disabled until the reviewer opens the source
document and ticks "I checked this against the document", and the server refuses
the write without that confirmation as well. Publishing records who reviewed it
and when, and clears the AI flag, because a person has now read it.

The About page carries the disclosure this implies, in one sentence, from
`site_settings.ai_disclosure`. It ships filled in and is editable at
`/admin/settings`.

None of the collectors or drafters exist yet. The tables they will write to
(`meetings`, `jobs`, `ai_runs`, `vacancy_snapshots`), the columns they will set,
and the rule above are all in place, so switching them on adds routes rather
than changing the shape of anything.

## Publishing a report

At `/admin/reports`: title, address (made from the title unless you type one),
type, date, a markdown summary of up to 600 characters, a PDF, and at least one
source. A report cannot be saved without a source.

Leave the status on Draft and it stays off the public site. Open it for editing
and you get an unlisted preview link plus a **Send to council** button, which
emails that link to every active advisory council member who has an address on
file. The link needs no account, because asking a volunteer reviewer to hold one
is how a report goes out unreviewed. It is unlisted rather than secret: the page
is never indexed or cached, and the token cannot be guessed, but anyone holding
the link can read the draft.

Advisory council addresses are stored on `people.email`, which the anonymous
role cannot read. The rest of a person's record is public, since the About page
and Vote Watch name them.

Switch the status to Published and it appears on `/reports`, at its own address,
and in the Latest feed. Editing a published report does not move its publication
date.

## Subscribers and mail

Subscribing is double opt in. The form writes an unconfirmed row and sends one
signed link; nothing else is ever sent to an address that has not clicked it.
The link expires after seven days and is verified by signature, so it cannot be
guessed or edited.

Publish notices are never automatic. Nothing that saves in the admin sends mail
to subscribers. `/admin/subscribers` has the only button that does, and it
states the recipient count in a dialog before anything goes out. It reaches
confirmed addresses only.

Without `RESEND_API_KEY`, every message is written to `.local-storage/emails`
as JSON instead of being sent, which is how the tests check who a message went
to. Mail is never silently dropped.

That fallback is for development only. A deployed host serves from a read only
filesystem, so the write cannot succeed there: the message goes to the server
log instead and `sendEmail` reports that nothing was sent, rather than throwing
and taking the form down with it. An inquiry is written to the database before
any mail is attempted, so a missing key costs the office its notification and
never costs the person their message. Set `RESEND_API_KEY` in production.

## Regenerating database types

`src/lib/database.types.ts` is generated, not written by hand. After changing a
migration:

```sh
bash scripts/local-supabase.sh
node scripts/gen-types.mjs
```

The Supabase CLI's own `gen types` needs Docker. This reads the Postgres catalog
through `psql` instead and emits the same shape, including foreign keys so
embedded selects stay typed.

## Deploying to Vercel

1. **Create the Supabase project.** Run every file in `supabase/migrations/` in
   order in the SQL editor. Create a Storage bucket named `documents` with
   public read: report PDFs, records request documents and people photos are
   all served from it.
2. **Add yourself as an administrator**, as above. Nobody can sign in until
   their address is in `admins`.
3. **Import the repository in Vercel.** `vercel.json` sets the framework, the
   build and install commands, and the security headers, so there is nothing to
   configure by hand.
4. **Set the environment variables** from the table above, for Production and
   Preview both. `NEXT_PUBLIC_SITE_URL` must be the real origin: it is what
   confirmation links, council preview links and the sitemap are built from, so
   a wrong value sends people to the wrong place.
5. **Point `monakproject.org` at the project** in Vercel, then set
   `NEXT_PUBLIC_SITE_URL` to `https://monakproject.org`.
6. **Verify the Supabase redirect URLs.** In Authentication,"URL Configuration",
   add `https://monakproject.org/**` so magic links come back to the site rather
   than to localhost.
7. **Verify the Resend domain** and set `EMAIL_FROM` if you want something other
   than `hello@monakproject.org`. Without `RESEND_API_KEY` no mail is sent, and
   the sign in link will not arrive.
8. **Check Plausible** is receiving traffic for `monakproject.org`. The script
   is on public pages only, never on the admin panel.

Public pages use ISR. Every admin save calls `revalidatePath` for the routes it
affects, so published work appears within seconds without a rebuild.

### What the build needs

The public pages are rendered at build time, so the database has to be
reachable and the Explorer must have data. A build will stop with a clear
message if `salary_schedule` is empty, if the home district named in
`explorer_home_district` has no rows, or if any figure is missing its source
link. That is deliberate: an unsourced number is the one thing that must never
reach the site.

## Performance and accessibility

`pnpm test:lighthouse` runs all 11 public routes in mobile emulation and fails
below 95 in any category. Current scores: Performance 96 to 99, Accessibility
100, SEO 100, Best Practices 96 locally and 100 in production. The local Best
Practices cap is the Plausible script, which cannot load in a sandbox without
outbound network and logs a console error; it is the only error on any page.

Every page carries an Open Graph image generated at build: navy background, the
page title in Instrument Sans, the gold rule. `/robots.txt` and `/sitemap.xml`
are generated too, and both keep crawlers away from the admin panel and the
unlisted report previews.

## Project conventions

- Gold is used for exactly one thing: the underline on a number that links to a
  source document, rendered by the `<Sourced>` component. It appears nowhere
  else.
- No em dashes or en dashes anywhere: not in the UI, the copy, code comments, or
  commit messages.
- Judgment calls made during the build are recorded in `DECISIONS.md`.
