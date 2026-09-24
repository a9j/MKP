# Decisions

Choices made while building that were not spelled out in the brief. Each one
notes what was decided and why, so it can be reversed quickly if it is wrong.

Both reference files arrived after the first commit and are now in the
repository root. Phase 1 is built from them.

## 2026-09-16

### Next.js 15, not 16
`create-next-app@latest` now installs Next 16. The brief pins Next.js 15 and
says not to substitute, so the project was scaffolded with `create-next-app@15`
and sits on Next 15.5.25 with React 19.

### `site_settings` gained an `is_public` column
The brief gives `site_settings (key, value, updated_at)` but also asks for a
public read policy on every table "except ... `site_settings` private keys".
There was no way to tell a private key from a public one, so a
`is_public boolean not null default true` column was added. The anonymous read
policy filters on it. Records officer emails seed as private, everything else
public. If you would rather mark private keys by naming convention, say so and
the column comes out.

### `business_days_between` counts the start date exclusive, end inclusive
A request filed Monday and answered Tuesday reports 1 business day, not 0 or 2.
A request with no response yet returns null rather than 0, so the Records Desk
can render "no response yet" instead of a misleading zero. Weekends are
excluded. Public holidays are not, because holiday rules differ per agency and
guessing them would put a wrong number on a public page.

### Drafts are invisible to the anonymous key
`reports` and `listening_sessions` have a public read policy of
`status = 'published'`. Draft rows and their `preview_token` are therefore not
reachable with the anon key at all. The unauthenticated preview route
`/reports/preview/[token]` will read through the service role on the server, so
a preview link cannot be turned into a way to enumerate drafts.

### Explicit grants in the migration
Supabase projects grant table privileges to `anon` and `authenticated` by
default, so RLS alone usually appears to work. The migration sets the grants
itself rather than depending on project defaults, and it revokes `select` on
`admins`, `inquiries` and `subscribers` from `anon` entirely. Those three are
refused at the privilege layer, not merely filtered to zero rows by RLS.

### Admin email matching is case insensitive
`is_admin()` compares `lower(admins.email)` against the lowercased JWT email,
so an Executive Director who types a capitalised address into a magic link
request is still recognised.

### `listening_points.kind` is a check constraint, not an enum
Every other enum in the brief is reused across columns. This one is local to a
single table, so a check constraint on `('heard', 'changes')` keeps the enum
list shorter without changing behaviour.

### A local Postgres test harness
`supabase/tests/supabase_shim.sql` recreates the `auth` schema and the
`anon` / `authenticated` / `service_role` roles so the migration can be applied
to a plain Postgres 16 cluster. `scripts/test-db.sh` applies the migration and
runs 41 assertions covering `business_days_between`, the `latest_feed` view,
the source_url and summary length constraints, and the RLS rules for anonymous,
signed in non-admin, and admin callers. This is separate from the Playwright
suite and touches no Supabase project.

### `documents.owner_id` is nullable
The `template` owner type is the request template file, which belongs to the
site rather than to a row in another table.

## 2026-09-16, phase 1

### Two mockup values fail WCAG AA and were changed
Design rule 10 requires AA contrast, and rule 9 wants Lighthouse 95 on
accessibility. Two values in the mockup cannot meet that, so they were
changed. Everything else in the palette is the mockup's value untouched.

1. `--ink-3` in light mode was `#8593A2`, which is 3.14:1 on white. It carries
   small text throughout: the hero pledge line, feed dates, field labels, step
   numbers, the footer fine print. It is now `#697684`, 4.64:1, the closest
   value to the original that clears 4.5:1 with margin. The dark mode value
   passes as written at 5.22:1 and is unchanged.
2. `.cta` was `background: var(--ink); color: #fff`. In dark mode `--ink`
   becomes `#F2F5F8`, so the block rendered white text on a near white
   background at 1.09:1, effectively invisible. This is not theoretical, it
   reproduces in a browser. The block now uses its own `--cta-bg`, `--cta-ink`,
   `--cta-ink-2` and `--cta-line` tokens that stay navy and white in both
   themes, which also matches design rule 3.

A third token was added for the same reason: `--teal-btn-ink`. A `.btn.teal`
is white on `--teal`, which is 4.70:1 in light mode but 2.12:1 against the
lighter dark mode teal. The button now takes dark text in dark mode.

axe-core reports zero WCAG 2.1 A and AA violations on the home page in light
desktop, dark desktop, and mobile.

### Section padding follows the mockup's specificity, not a class
In the mockup, `.wrap { padding: 0 24px }` outranks `section { padding: 72px 0 }`,
so a `<section class="wrap">` ends up with no vertical padding and only
`<section class="band">` keeps the 72px. Rewriting this as a `.section` utility
class looked tidier but silently changed every section's spacing and widened
the content box from 1072px to 1120px. The element selector is kept so the
cascade behaves exactly as the approved design does.

### Verifying against the mockup needs the real font
The mockup loads Instrument Sans from the Google Fonts CDN. Where that is
unreachable it falls back to a system font, every text measurement drifts, and
a correct build looks wrong. `scripts/visual-parity.mjs` serves the mockup from
a local origin and proxies the app's self hosted font files to it so both
pages render with the same font, then compares eleven elements and fails on any
size difference. All eleven match. Run it with `pnpm test:visual` against a
running `pnpm start -p 3100`.

### Where the copy doc and the mockup disagree, the copy doc wins
The copy doc is the approved copy, so its wording is used verbatim and the
mockup supplies the layout.

- Navigation is the copy doc's six items, which adds "Get Involved" to the
  mockup's five.
- The header button is "Support The Mona K Project", not "Support the work".
- The footer opening line is "The Mona K Project makes Toledo's public data
  understandable so residents can push for better decisions." The mockup opens
  it with "We make".
- The neutrality line is the copy doc's "We do not take positions", used in
  both the hero and the footer. The mockup's hero says "We don't take
  positions", which would leave two phrasings of the same sentence on one page.
- The hero subhead drops the mockup's ", like this one" aside, which the copy
  doc does not have. It existed to demonstrate the gold underline, and the
  Explorer widget beside it already does that.
- The Latest heading is the copy doc's "Latest from The Mona K Project".

### Where the mockup has copy the copy doc does not, the mockup is kept
The programs heading, "Three things we build, all from public records.", the
how we work heading, and the five step titles with their supporting sentences
exist only in the mockup. The copy doc's "How we work" list is the same five
steps in summary form, so the mockup's fuller treatment is used.

### The Latest feed shows six items, not three
The copy doc says three. The build brief says "most recent 6 published items
across reports, records requests, votes, and listening summaries". The brief is
the functional spec, so six. This is the only reason the built page is taller
than the mockup: 2753px against 2558px, which is exactly the two extra 98px
rows.

### The support button moves into the menu on mobile
The mockup hides the nav links below 820px and puts nothing in their place,
which leaves the site unnavigable on a phone. A disclosure button holds them
instead, with 44px rows. The copy doc's longer "Support The Mona K Project"
also wraps to two lines in a 390px bar and crowds out the menu button, so on
mobile it moves into the menu rather than being shortened. The desktop bar is
unchanged and still matches the mockup.

### 44px touch targets are scoped to admin
Rule 7 asks for 44px minimum targets so the Executive Director can work from an
iPhone, and names admin forms. Applying it to public links as well pushed the
footer and the programs list out of alignment with the mockup, so public pages
follow the mockup and 44px applies to the admin panel and to the mobile menu
that the mockup does not have.

### Sourced links open in a new tab
A source document is a PDF on an agency's site. Opening it in place would lose
the reader's position on the page, so `<Sourced>` uses `target="_blank"` with
`rel="noopener noreferrer"`.

### The Explorer preview animates only the headline figure
Rule 5 allows the salary figure to animate. The comparison, scenario and
inflation rows are derived from the real value and update immediately, so only
one number is ever in motion. The animation is 400ms with a cubic ease out and
is skipped entirely under `prefers-reduced-motion`.

## 2026-09-16, phase 2

### Public pages use the anonymous client, not the cookie bound one
`@supabase/ssr`'s `createServerClient` reads cookies, and reading cookies opts a
route out of static rendering, which would quietly disable the ISR the brief
asks for. Nothing on a public page depends on who is asking, so public reads go
through a plain anonymous client and RLS does the filtering. The cookie bound
client arrives in phase 4 with the admin panel, where the session is the point.

### Types are generated from the catalog, not by the Supabase CLI
`supabase gen types` shells out to Docker, which is not available everywhere.
`scripts/gen-types.mjs` reads the Postgres catalog through psql and emits the
same shape: 20 tables, the `latest_feed` view, 9 enums, and the 7 foreign keys.

The foreign keys matter. postgrest-js requires a `Relationships` key on every
table and view, and without it the whole `Database` type silently degrades to
`never`, so `.from("latest_feed")` type checks as an error with no clue why.
Emitting real relationships rather than empty arrays also keeps embedded selects
such as `.select("*, agencies(name)")` typed for the later phases.

### Every column of latest_feed is nullable
Postgres cannot prove non-nullability through a union, so the generated view
type is nullable throughout. `getLatestFeed` skips any row missing what it takes
to render rather than showing a half built row. That is the honest reading of
the type, not a workaround.

### Feed dates are formatted from parts
`new Date("2026-09-12")` parses as midnight UTC and then renders in local time,
which shows a September 12 vote as September 11 for anyone west of UTC. Dates
are built with `Date.UTC` and formatted with `timeZone: "UTC"`. There is a
regression test for this that pins the process time zone.

### A missing environment variable fails loudly
`src/lib/env.ts` throws a message naming the variable and pointing at
`.env.example`. The alternative, rendering an empty page when the database is
unreachable, would look like a site with nothing published, which for this
organization is the worst possible failure mode.

### A local stand in for Supabase, so the data layer is tested for real
`scripts/local-supabase.sh` brings up Postgres, PostgREST, and a small gateway
that serves PostgREST under `/rest/v1` the way Supabase does. `pnpm test:data`
then runs the real query modules through real `supabase-js` against real RLS,
rather than against a mock that would agree with whatever the code does. It
proved useful immediately: the anonymous key is refused on `admins`,
`inquiries` and `subscribers`, and cannot write to `corrections`.

The Docker daemon is unavailable in this environment, so `supabase start` was
not an option. Nothing in this setup is used in production.

### Development seed content
`supabase/seed/dev_seed.sql` holds clearly fake content, including a draft
report and a draft listening session that must never reach the public feed, and
a records request left open past ten business days for the dashboard flag in
phase 4. It is a development aid and is never run against production.

## 2026-09-16, phase 3

### Two more contrast failures, found on the grey band
Phase 1 checked the palette against white. The grey band is a second surface,
and two tokens fail on it, so both were darkened again. Measured, not judged.

- `--ink-3` was 4.28:1 on `--band`, and it carries every table caption and
  helper line. It is now `#64717D`: 5.00:1 on white, 4.62:1 on the band.
- `--teal` is the mockup's `#1B7F8E`, which is 4.69:1 on white but 4.33:1 on the
  band, where links and the primary button also sit. It is now `#187585`:
  5.35:1 and 4.94:1. White text on it reads 5.35:1, so the teal button improved
  too.

A link inside running text also needs something other than color to mark it,
so prose links are underlined. Navigation, buttons and sourced figures are not
in running text and keep the mockup's undecorated treatment.

axe reports zero WCAG 2.1 A and AA violations across the home page, the
Explorer and the admin panel, in light, dark and at 390px.

### Chart colors are the brand's, with identity never resting on color
The palette validator passes the two checks that decide whether the series can
be told apart: CVD separation is 27.1 against a threshold of 8, and the
normal-vision floor is 27.7 against 15. It fails the lightness band and chroma
floor, because navy and teal are deliberately muted and the design system
forbids anything else. Gold is not available: it means "this links to a source
document" and nothing else.

Since the palette is restrained, identity carries on more than hue: the base
year line is dashed, a legend is always present, and the table under the chart
lists every plotted figure. That table is also how the chart meets the sourcing
rule, since a line cannot carry a gold underline per point.

Recharts writes its own `stroke` attribute onto the generated path, so a class
on the wrapping group does nothing. Both series were silently rendering in the
library's default blue, which is off palette and identical for both, while the
legend showed the right colors. The CSS now targets the path itself.

### Scenario B carries no gold underline
Every other figure in the Explorer links to the record it came from. Scenario B
is a flat amount set in `site_settings`; it is the scenario's own definition,
not a number read off a public document. Putting a gold underline on it would
promise a source that does not exist, from an organization whose whole standing
rests on that promise. The label states the amount, and the figure is plain.

Scenario A is different: it is a percentage of the sourced salary, so it links
to the same document that salary came from.

### An upload adds and updates, it never deletes
A partial CSV should not wipe rows the uploader did not mean to touch, so the
diff counts rows the file leaves alone and shows that count before committing.
A file with any problem in it is refused whole: a half imported salary schedule
is worse than a rejected one.

### The vacancies snapshot key uses NULLS NOT DISTINCT
0001 gave vacancies no natural key, so re-uploading a month would duplicate
every row. The first attempt was a unique index over `coalesce(building, '')`,
which dedupes correctly but cannot be used: `ON CONFLICT` only accepts a plain
column list, so the upsert failed with "no unique or exclusion constraint
matching the ON CONFLICT specification". Postgres 15 added `NULLS NOT
DISTINCT`, which gives a plain column index that still treats nulls as equal.

### A blank source_url is now a constraint, not just a convention
0001 made `source_url` NOT NULL, which still allows an empty string. 0002 adds
a check for a non-blank value on all four sourced tables, the CSV validator
rejects the row with its line number, and `getExplorerData` throws during the
build if one ever reaches it. Three layers, because an unsourced number on this
site is the one thing that cannot ship.

### Admin writes go through the caller's own session
The upload actions use the cookie bound client, not the service role key, so
RLS decides what a signed in administrator may touch. Sign in itself is not
permission: membership is checked against the `admins` table. Both actions
refuse before reading a file, so the endpoint is never open while the login
screen is still to be built in phase 4.

### Public and admin are separate route groups
The admin panel was inheriting the public sticky nav and the 501(c)(3) footer.
The root layout is now the document shell only, and `(public)` and `admin` each
bring their own chrome.

### Recharts is loaded on demand
Importing it directly put 107kB into the home page bundle for a chart the home
page does not draw. Loading it lazily took the home page back to 109kB total.

### shadcn/ui is not in yet
The brief lists it for form controls, dialogs, tables and toasts. Phase 3 needs
a file input, a small form and a toast, which are plain controls styled from
the tokens, and shadcn components are copied into the repo and restyled by hand
anyway. It lands in phase 4 with the screens that need its dialogs and selects:
the vote roll call, the records desk and the confirm dialogs.

## 2026-09-16, phase 4

### shadcn/ui cannot be installed from this environment
`ui.shadcn.com` is refused by the network policy here, so the CLI cannot fetch
a component and neither `init` nor `add` completes. shadcn components are thin
wrappers over Radix primitives plus Tailwind classes, and the brief says to
restyle them anyway, so the primitives are installed directly from npm and the
styled wrappers are written here. The result is the same accessible behaviour
under the site's own tokens. If the registry is reachable from your machine,
`shadcn add` will drop into `src/components/ui/` without disturbing this.

Native `<select>` is kept rather than a custom listbox. On a phone it opens the
system picker, which is easier one handed than any scripted menu, and the
Executive Director runs this from an iPhone. Radix is used where it genuinely
adds behaviour: the roll call segmented control is a RadioGroup, so arrow keys
move between choices, and the add agency dialog is a Dialog, so focus is
trapped and restored.

### A local stand in for the auth server
The Supabase auth server is not downloadable here either, so the dev gateway
grew a small stub. It issues genuine JWTs signed with the same secret PostgREST
verifies, so a signed in administrator really does arrive as the authenticated
role and really is filtered by RLS. What is faked is the auth server's own
internals, not any code in this project. Magic links are written to
`.local-storage/magic-links.json` rather than emailed, which is what lets the
end to end tests sign in the way a person does instead of forging a session.

Two faithfulness bugs surfaced while building it, both of which would have hit
real Supabase the same way: the browser client needs CORS headers on the auth
origin, and `emailRedirectTo` travels as a `redirect_to` query parameter rather
than in the body.

### The redirect is a convenience, not the boundary
Middleware sends a signed out visitor to `/admin/login`, but it is not what
keeps them out. Every admin page checks for an administrator itself, every
server action checks before reading its input, and RLS refuses the write
regardless. A request that slipped past the middleware still reads and changes
nothing. Signing in is also not the same as being allowed in: membership is
checked against the `admins` table, so a stranger who requested a link is
signed out again with a clear message rather than landing in an empty
workspace.

### Sign in sits outside the workspace shell
It was inheriting the admin rail, so a signed out visitor saw navigation into
pages they could not open, a sign out button, and a burst of prefetches that
each redirected back to sign in. The shell moved into an `(workspace)` route
group and sign in now renders on its own.

### Admin writes use the caller's session, never the service role
The service role key bypasses RLS entirely. Nothing in the admin panel needs
that, so every write goes through the cookie bound client and the policies stay
in force for a signed in administrator too.

### Vote Watch publishes the counts, not a verdict
The mockup shows "Passed 4 to 1". Whether a vote carried depends on the body's
own majority rule, which the minutes do not state, and abstentions change the
answer under some rules. Deriving "Passed" from yes against no would eventually
publish a wrong claim, which is the one thing this organization cannot afford,
so the tally reads "4 yes, 1 no" and the reader draws the conclusion. This is
consistent with the copy doc's own note that summaries describe what was
decided, not whether it was a good decision.

### The roll call defaults to Yes, and the tally is derived
Most roll calls are unanimous, so the Executive Director only touches the
exceptions. The tally is counted from the roll call rather than typed, so the
published totals and the per member breakdown cannot disagree. If the roll call
fails to save, the vote row is removed rather than left published with a tally
nobody can check.

### Bodies are ordered so the default one has members
Alphabetically, "Lucas County Commissioners" sorts first and has no members
recorded, so the form opened with an empty roll call. Bodies with active
members now come first, which puts TPS Board where it belongs for the board
this organization actually tracks.

### Wide tables scroll inside their own box
`/votes/members` has seven columns and was pushing the whole page sideways at
390px. The table now scrolls within a labelled region that is reachable from
the keyboard, so the page itself never scrolls horizontally. An end to end test
asserts this for every public route.

### Documents are PDF only, refused before anything is saved
A file that is not a PDF, or is over 25MB, stops the whole save rather than
being skipped quietly, so the request and its documents are never half
recorded. A denial cannot be saved without the reason the office gave, enforced
in the form, in the action, and by a check constraint, because an unexplained
denial is exactly what the Records Desk exists to surface.

## 2026-09-16, phase 5

### people gained an email column, and it is not public
"Send to council" has to write to someone, and the schema in the brief gives
`people` no address. The column was added, but `people` is public read because
the About page lists staff and council and Vote Watch names board members, and
publishing a volunteer's personal email on their behalf is not this
organization's call to make.

Row level security cannot express "this row but not this column", so the
address is withheld at the column level instead. The first attempt did not
work: a column level revoke does not cut into the table wide grant that 0001
gave `anon`, so the emails were simply readable. They were, and a curl against
the running stack showed them. The table grant is now revoked and the readable
columns granted back one by one, `email` not among them. There is an assertion
for it in the RLS suite.

### The service role needed grants the migration was not making
A Supabase project grants `service_role` everything automatically, so this is
invisible there, but the migration is meant to stand on its own and the preview
link failed with "permission denied for table reports". BYPASSRLS skips the
policies, not the table privileges. 0005 grants them, and default privileges so
a later table is covered too.

### The preview link is unlisted, not secret
A draft is hidden from the anonymous key by RLS, so the preview route reads
through the service role on an exact match of a `gen_random_uuid()` token. That
is what stops the route being used to enumerate unpublished work: there is
nothing to list, and a token cannot be guessed. A malformed token is rejected
before any query runs, and the page is `force-dynamic` with `noindex, nocache`
so a draft cannot sit in a CDN or turn up in a search result while the council
is still reading it.

It does not require a login on purpose. Asking a volunteer reviewer to hold an
account is how a report goes out unreviewed. The banner on the page says the
link is unlisted so a reviewer knows not to forward it.

### Mail goes through one function, and never silently nowhere
`sendEmail` uses Resend when `RESEND_API_KEY` is set and otherwise writes the
message to `.local-storage/emails`. Dropping mail on the floor in development
would be worse than either: a council review that never arrives looks exactly
like one nobody answered. The tests read those files, which is how "send to
council reaches both advisory members and nobody else" is actually checked.

The house layout is one function too: navy heading, a gold rule under the
title, and a font stack that falls back to the system sans, which in mail is
almost everywhere. This is the one place outside the sourced underline where
gold is used, and the brief asks for it explicitly.

### Report summaries are markdown, rendered on the server
`react-markdown` renders in the server component and disallows raw HTML, so a
summary cannot smuggle markup onto the page and no markdown parser reaches the
browser. The 600 character limit is enforced in the form, in the action, and by
the counter that shows how much is left.

### Sources are replaced wholesale on save
Matching existing source rows against submitted ones is more code and more ways
to go wrong. Deleting and reinserting cannot leave an edited report citing a
document that is no longer in its list. A report cannot be saved with no
sources at all.

### A published date is set once
Editing a published report does not move its publication date. Only the first
publish sets it.

### Shared report types live outside the query module
The filter bar is a client component, and importing the query module pulled the
service role client into the browser bundle. The `server-only` guard turned
that into a build error rather than a shipped key, which is what it is for, and
the shared labels and shapes moved to `src/lib/report-types.ts`.

## 2026-09-16, phase 6

### Nothing is sent to an address that has not confirmed
Subscribing writes an unconfirmed row and sends exactly one message: a signed,
expiring link. Only clicking it sets `confirmed`. Publish notices go to
confirmed addresses only, and only when a person presses the button and
confirms the recipient count in a dialog. No save anywhere sends a notice.

The token is an HMAC over the address and an expiry, so nothing is stored for
it, it cannot be guessed, and an old link stops working on its own. The
signature is compared in constant time so a near miss cannot be narrowed down
by timing it. Tests cover both the happy path and a link with one character of
the signature flipped.

### The subscribe form gives nothing away
It says the same thing whether or not the address is already on the list, and
an address that already confirmed is not sent another link. Otherwise the form
would answer "is this person a subscriber" to anyone who asked.

### The inquiry row is written before the mail is sent
If the mail fails, the message is still recorded and readable in the admin.
Losing what somebody took the trouble to write is worse than a missed
notification.

### Confirming is its own page, not a redirect
Redirecting back to `/get-involved` with a query parameter would force that
page to read the query string, which takes it out of static rendering. The
confirmation is its own dynamic page and says plainly which of the four things
went wrong when a link does not work.

### The footer keeps the mockup's links
Two links to the new pages were added and then taken out again: the footer grew
by 60px and the parity check caught it. Both pages are already reachable,
`/listening` from About and `/corrections` from About and Contact, so the
approved design stands. A footer link to Corrections would suit an organization
whose credibility rests on correcting in public, and it is a one line change if
that is wanted.

### A correction cannot be logged without a reason
"What changed" and "why" are both required. A change with no reason is an edit,
not a correction, and the whole point of the page is that nothing is quietly
edited.

### A listening summary needs at least one thing heard
The copy doc promises that what we hear is published and shapes what we build.
A summary with neither list does neither, so at least one point is required.

### Settings are grouped, and an unknown key still appears
The settings screen lays the keys out in sections rather than as one long list,
and anything seeded later that is not in a group is rendered under "Other", so
a new key is never quietly uneditable. Records officer addresses are edited
here but stored on the agency, since the Records Desk publishes them next to
the office they belong to.

### A data test asserted a seeded value that the admin can change
`test:data` checked that `org_ein` equalled the seeded string, which broke as
soon as the end to end suite saved a setting through the admin screen, as it
should be able to. The test now asserts the rule it cares about, that a filled
setting is returned and an empty one is omitted, rather than a particular
string.

## 2026-09-16, phase 7

### The Lighthouse pass found three real defects
Running it rather than assuming was the point. All eleven public routes now
score 95 or above on mobile in every category, but they did not at first.

1. `/favicon.ico` was returning 404 on every page, and had been since the
   scaffold's default icon was deleted in phase 1. Nothing else noticed: axe
   does not check it and the pages looked right. There is now a brand mark as
   `icon.svg`, a real `favicon.ico` for clients that ask for it directly, and an
   apple touch icon, all rendered from the same two shapes.
2. `/reports` failed heading order: the three report type blocks were `h3`
   directly under the `h1`. They are section headings, so they are `h2` now. The
   same fault was on `/votes`, `/listening` and `/get-involved`. No copy was
   invented to paper over it; the level was simply wrong, and the size is set by
   the block rather than the level.
3. Several text links were 23px tall, under the 24px minimum, so they were hard
   to hit on a phone. Everything tappable now clears 44px, which is what the
   Explorer and the admin panel already used.

Accessibility and SEO are 100 on every route. Best Practices sits at 96 locally
for one reason: the Plausible script cannot load in a sandbox without outbound
network and logs a console error. It is the only console error on any page, so
that becomes 100 in production.

### Open Graph images are generated at build, from a font on disk
`src/lib/og.tsx` renders the card and each route has a four line file naming its
own title. The font is committed under `src/assets` and read from disk rather
than fetched, so generating a share card never depends on the network being up
during a build.

### The share card is the third sanctioned use of gold
The rule is that gold means "this links to a source document". The card uses it
as a rule under the title, the same motif as the logo mark and the Explorer
legend, and the brief asks for exactly that. On the site itself, gold is still
only the sourced underline.

### Plausible is on public pages only
It is in the public layout, not the root layout, so the admin panel is not
measured. It sets no cookies and collects nothing personal, so there is nothing
to ask consent for and nothing that follows a reader anywhere else.

### robots and sitemap keep crawlers out of two places
The admin panel and the unlisted report previews are disallowed in
`robots.txt`, carry `noindex` in their own metadata, and get an `X-Robots-Tag`
header from `vercel.json`. Three layers, because a draft appearing in a search
result while the council is still reading it is not recoverable.

### A test tracked a heading level it should not have
Promoting the vote title from `h3` to `h2` broke an end to end test that
selected `.vote h3`. The heading now carries a class the test matches on, so a
correct change to the document outline does not read as a regression.

## Open questions

1. The copy doc's own "What I still need from you" list is unanswered: legal
   name confirmation, EIN, mailing address, Sasha Kabarday's title, advisory
   council names, two sentences for the About page, DNS access, and whether the
   Explorer has its own URL. Everything there is a `site_settings` value or a
   `people` row, so none of it blocks building. The site renders the bracket
   placeholder until a value is filled in.
2. The Explorer preview still uses the mockup's illustrative numbers. Phase 3
   replaces them with `salary_schedule` rows, at which point every figure
   carries its own `source_url` and a missing one fails the build.
3. `src/lib/revalidate.ts` maps each kind of admin save to the public routes it
   affects. The Explorer upload calls it; the rest arrive with their screens.
   The route lists are worth a read, since a route missing from one of them is
   a page that silently goes stale after a publish.
4. Resolved in phase 4. The upload screen is now covered end to end: the suite
   signs in through the real magic link flow and drives the file input.
5. The mockup uses gold in three places: the sourced underline, the bar in the
   logo mark, and the legend square that explains the underline. Design rule 2
   says gold is for exactly one thing. The mockup is the approved design and
   both extra uses are about the device itself, so they are kept. Worth a word
   at review if that is not the intent.

## 2026-09-17, the revised brief

The brief arrived again with an eighth phase, Automation and AI, and with
changes reaching back into phases 2, 4 and 6. Phases 1 to 7 are already built
and merged, so this is a revision pass across them rather than a fresh start.

### Phase 8 is not started

The brief ends the build order with "Do not start Phase 8 until Phase 7 is
deployed and I say go." Phase 7 is built but has not been deployed, and there
is no go. So nothing here fetches a BoardDocs page, calls a model, or serves a
cron route. No `@anthropic-ai/sdk` dependency, no `/api/cron/*` routes, no
prompt files, no neutrality guard, no fixture PDFs.

What is here is everything phase 8 will need to exist against: the `meetings`
table it discovers into, the `jobs` and `ai_runs` tables it writes its audit
to, the `vacancy_snapshots` table the monthly diff hangs off, the `ai_draft`
columns on `votes`, the review gate in the admin, and the rule that only a
person may publish. Switching the collectors on adds routes; it does not
reshape anything.

### The publish rule is a trigger, not a policy

The brief says the service role should have "a Postgres policy forbidding
writes where status = 'published'". A policy cannot do this. The Supabase
service role holds `BYPASSRLS`, so its policies are never consulted, which is
the whole reason that role exists. The rule is enforced by a trigger on
`votes`, `reports` and `listening_sessions` instead, which every writer passes
through, and it raises `insufficient_privilege` so a refusal reads the same way
a denied policy would.

The database is the right place for this either way. A rule kept only in the
application is a rule that holds until somebody adds a second caller.

### Meetings became a table, and votes moved onto it

`votes` carried `body_id` and `meeting_date` directly. The revised schema gives
meetings their own row with an agenda, minutes and video link, which the agenda
watcher needs in order to recognise a meeting it has already seen. The
migration builds those rows from the votes already recorded, so nothing is
lost. The vote keeps `agenda_item_url`, the paper for its own item; the agenda
and minutes for the meeting as a whole live on the meeting.

On the public page, the "Agenda" link prefers the item link when the vote has
one and falls back to the meeting agenda. A reader clicking it wants the
document behind this decision, not a hundred page packet.

### The stored tally is gone

`votes` held `yes_count` and its three siblings beside the roll call they
summarised. The revised schema does not, and it should not: the roll call
extractor will write `vote_members` rows without touching a count, and a stored
total that drifts from the names under it is a published number that is wrong.
The tally is now counted from the roll call everywhere it is shown.

A vote with no roll call recorded yet reads "No roll call yet" in the admin
rather than "0 yes, 0 no". That is the honest answer: the tally is not known,
which is different from being zero.

### Publishing goes through one path

The review gate would be worth little with a second way to publish beside it,
so there is no one tap publish in the vote list. Opening the draft is the only
route, and the gate is on that screen. The server checks the confirmation too,
so the rule does not depend on a disabled button.

### Amber in the admin, gold on the site

The brief asks for "a distinct amber 'AI draft, unreviewed' badge", and design
rule 2 says gold is used for exactly one thing. Both hold: amber is a separate
token, a different hue, used only in the admin workspace, and it never appears
on a published page. Gold still means a sourced number and nothing else.
`--amber` is 5.86:1 on its own background in light mode and 7.67:1 in dark.

### The dashboard lost its stat tiles

It had four counts of things already finished. The revised brief says the
screen shows exactly three things and names them: post a vote, what is waiting
for review, what an agency has not answered. Counts of completed work are not
work, so they are gone, and the empty state now reads "Nothing waiting on you."

Machine written drafts sort to the top of the review list, because they are the
only items on it that nobody has read.

### `jobs` and `ai_runs` are not public

Every other table that backs a page is public read. These two are not. A job
run is operational, and a raw model response is not a document anybody has
checked. Publishing either would put text on the site that no person approved,
which is the thing this organization exists not to do. Both are admin read
only.

`vacancy_snapshots` is public, because the stored PDF is the source every
vacancy row points at.

### The accessibility check is now a test

The WCAG pass was run by hand in phase 7. It is `tests/e2e/a11y.spec.ts` now:
axe over every public and admin screen, in light mode, dark mode and at 390px,
failing on any 2.1 A or AA violation. New screens arrived in this pass, and a
bar that is only ever checked by hand is a bar that slips.

### Still open

The `claude-sonnet-4-6` model id in the brief is not one this build can
confirm. Nothing depends on it yet, since no model is called. Worth checking
against the current model list when phase 8 starts rather than pinning an id
that may have moved.

### The mail fallback had to survive a host with no writable disk

`sendEmail` without `RESEND_API_KEY` wrote the message to
`.local-storage/emails` so that development could read it, on the stated
principle that silently dropping mail is worse than either sending or
failing loudly. On Vercel the filesystem is read only outside `/tmp`, so that
write throws, and it threw straight out of `sendEmail`. The first contact form
submission after a deploy with no Resend key would have stored the inquiry and
then returned a server error to the person who wrote it.

It now returns rather than throws, logs the message so it is still recoverable,
and reports that nothing was sent. The inquiry is written before any mail is
attempted, so a missing key costs the office its notification and never costs
the sender their message.

Writing it to disk moved to `src/lib/email-disk.ts`. `email.ts` is server only
because it holds the Resend key, and that guard throws outside a server
component, which put the one branch that can fail on a real host beyond the
reach of a test. Nothing in the filesystem half is a secret, so it is testable
on its own.

Those tests immediately found a second fault: the filename was the timestamp
plus the subject, so two messages sent in the same millisecond with the same
subject became one file. A loop over recipients does exactly that. The name now
carries a random suffix.

## 2026-09-22, phase 2 step 1: the roster past the school board

The second brief widens the site to city council, the ballot and the city
budget. This is step one of its build order: the roster, the district, and the
public body filter. Nothing here fetches an agenda or calls a model.

### The automation this brief builds on does not exist yet

The brief says to read "the automation code from Phase 8" before writing
anything. There is none. Phase 8 was never started, for the reason logged on
2026-09-17: the brief that introduced it said not to start until phase 7 was
deployed and there was a go, and neither happened. What exists is the shape it
will write into: `meetings`, `jobs`, `ai_runs`, the `ai_draft` columns, the
review gate and the trigger that stops the service role publishing.

So the council watcher in Part A item 2 has no TPS watcher to copy. It will be
the first `/api/cron/*` route on the site, not a second one. That is a real
difference in the size of step 4, and it is worth knowing before that step is
scheduled rather than during it.

### agenda_system is on the body, and it defaults to manual

The brief lists `boarddocs`, `granicus` and `manual`. TPS is set to boarddocs
and council to granicus; the county keeps manual. Manual is the default for a
new body because it is the honest answer for one nobody has automated: the
agendas arrive because a person went and got them.

### district is text, and it is a column grant

A district is an identifier, not a quantity. Nothing sums them, the county and
the school board name their seats differently from council, and a leading zero
or a letter would be lost by an integer. Null means no district, which on
council means at large.

The column had to be granted to the anonymous role by name. 0004 replaced the
table wide grant on `people` with a column list so that an email address could
be stored without publishing it, and a column added afterwards is not in that
list. Without the grant the voting records page fails the build with
"permission denied for table people", which is exactly what happened. Any
future column on `people` needs the same decision made out loud: public or not.

### At large is not printed against a body that has no districts

The public voting record shows a Seat column only for a body where at least one
member holds a district. Printing "At large" against all five school board
members says nothing, and it costs a column on a phone. The admin roll call
does the same: council splits into "At large" and "By district", the board
renders as one ungrouped list exactly as before.

### Short names live in code, keyed by slug

The filter has to read "City Council", not "Toledo City Council", and the feed
has to read "City Council vote". `bodies.name` is the legal name and stays that
way on the record, so the short names sit in `src/lib/bodies.ts` keyed by slug,
with the full name as the fallback. Keying by slug rather than by name means
renaming a body in the admin cannot silently lose its short name.

`latest_feed` gained a `body_slug` column to carry that lookup, rather than the
feed matching on the displayed name.

### Two filters need two labels

The body filter goes first, as the brief asks. Two rows of pills with nothing
between them read as one long bar, especially on a phone where both wrap, so
each control carries a small label: "Body" and "What it touches". That is UI
labelling rather than editorial copy, and the labels are what name each group
for a screen reader too.

### The phone report, which was two faults

"Everything doesn't fit right on the screen when looking at a phone" turned out
to be two separate things. Both are fixed, and both now have a test.

The first: `.wrap` sets the 24px gutter, and `.hero` and `.page-head` are the
same element with their own `padding` shorthand, which wipes the horizontal
half of it. Every interior page's headline, lede and button therefore ran to
the very edge of the screen while everything below them kept the gutter. The
gutter is given back only below the container width, so the desktop rendering
the mockup approves is untouched and `visual-parity.mjs` still matches on all
eleven tracked elements.

The same misalignment exists on the desktop, where the headline block sits
24px wider than the sections under it. It is in the mockup, so it is the
approved design, and it is not what was reported. Left alone, and flagged.

The second: the admin bottom tab bar laid eleven screens across 390px in one
row. The last four sat past the right edge and could only be reached by
swiping a 48px strip, with nothing on screen to say they were there. It is two
rows of six now, which fits every label at a readable size and leaves room for
the Budget screen that step two adds.

### The Vote Watch lede still says the board

The page copy reads "Every Toledo Public Schools board vote ... As we grow, the
same treatment extends to city council and county." Council votes now appear
under it. The sentence is not false, but it is behind the page. Copy is not
mine to change, so it is left as written and raised here.

### Types are edited by hand, not regenerated

`scripts/gen-types.mjs` rewrote all 1,800 lines of `database.types.ts` in its
own formatting, undoing the switch to the live project's own generator made in
the previous commit. The five additions from this migration were applied by
hand instead. Regenerating from the live project after this migration is
applied there will produce the same result with less noise.

## 2026-09-22, phase 2 step 2: the empty state, and the city budget

Step two of the build order: make an empty table a page rather than a build
failure, then build `/budget` and the uploader behind it.

### An empty table used to take the whole site down

`getExplorerData` threw when `salary_schedule` was empty, and the public pages
are rendered at build time, so one unfilled table failed the build for every
page on the site, Vote Watch and the Records Desk included. The README even
documented the circle it created: the screen that accepts the first upload was
on the site that would not build until the upload happened.

It returns null now, and the two pages that render the Explorer say "The salary
schedule has not been loaded yet." The same holds when the home district named
in `explorer_home_district` has no rows, which is the more likely fault in
practice, since it is a misspelling rather than an absence. Both log the reason
to the build output, because "not loaded yet" and "loaded under a different
name" read identically to a visitor and are not the same problem for the person
who has to fix it.

What still stops the build is a figure with no source link. That is the
difference worth holding: missing data is a state the site has to survive, and
an unsourced number is not.

### The city budget is its own table, not more budget_categories

`budget_categories` is the school district's budget, one category per row. The
city's book is a fund, then a department, then a line within it. Bending one
table to hold both would have meant a fund column that is null for half the
rows and a reader who could add a school figure to a city figure and get a
number that means nothing. Two tables, and the page never mixes them.

A department is the sum of its categories within one fund and year. The
categories stay in the table so a figure can be traced to the line it came
from; the panel a resident reads is by department, which is the level the
question is asked at.

### Which document a total links to

A department links to the largest line in it, which is the page somebody
checking the figure would open first. A fund total links to the budget book
only when every row in that fund names the same document, and to nothing when
they do not, since a total assembled from two sources cannot honestly claim
either.

The per resident figure carries no gold rule at all. It is one sourced number
divided by another from a different document, so there is no page to open that
shows it. Both inputs are underlined in the sentence beneath it. This follows
the rule already set for Scenario B: a figure the organization worked out is
never dressed as a figure it read.

### The slider says what the slider is set to

The brief fixes the label as "If one percent moved, it would equal" and also
asks for a slider from 0.5 to 5 percent. Those two cannot both be literal: at
3 percent a label reading "one percent" is simply wrong, and a wrong number is
the one thing this site cannot print. The heading stays "What one percent would
change" and the label tracks the slider, reading exactly the specified sentence
at its default of 1 percent. Worth a word at review if the fixed wording was
deliberate.

The panel also says, underneath, that it is a comparison and not a proposal.
The brief asks for no recommendation language; it seemed worth saying what the
panel is rather than only avoiding saying what it is not.

### No PDF extraction, because there is none to match

The brief asks for the uploader to use "the same CSV and PDF-extraction flow as
salary schedules". The salary schedule flow is CSV only: validate, diff,
preview, commit. There is no PDF extraction anywhere in the site, and building
one here would be inventing a second way to get figures in, unreviewed, for the
tool with the largest numbers on it. The budget uses the same flow the salary
schedule actually has. Extraction belongs with the drafting work, where a
person still checks the result against the document.

### Four programs, and one thing the mockup no longer fixes

The home page list is four items, so the grid is four columns on a desktop, two
where four would be too narrow to read, and one on a phone. The heading reads
"Four things we build" rather than "Three".

`visual-parity.mjs` compared the program card against the mockup, where it is a
third of the row. It is a quarter now by instruction, so the card was replaced
in the tracked list by the row it sits in, compared on width alone. The row is
what the mockup actually fixes: the grid's width and its hairline rules, not
how many programs the organization happens to run. Ten of the eleven tracked
elements still match on both dimensions.

### `/budget` is not in the navigation

The brief puts the Budget Explorer in the home page program list and says
nothing about the nav, and the nav is copy. So the page is reachable from the
home page, from the Teacher Pay Explorer, and from the sitemap, but not from
the bar at the top of every page. That is worth a decision rather than a
default: a tool nobody can find from `/votes` is a tool with one entrance.

## 2026-09-23, homepage redesign

### Which photos exist is decided at build
`next.config.ts` lists `public/photos` into `MKP_PHOTOS`. Any slot whose file
is missing renders a navy block of the same shape. The list is read at build,
not at request time, because on Vercel `public/` is not on the function's disk
and the home page revalidates at runtime. Adding a photo needs a redeploy,
which pushing it does anyway.

### "See what's on the ballot" reads `explainers_public`
It shows when a published explainer of kind `ballot_issue` or `levy` has a
`decision_date` of today or later, Toledo time. It links to `/explainers`,
the index in the Phase One spec. Until then the button reads "See the latest
votes" and goes to `/votes`.

### The City Budget Explorer card follows the data
The card links to `/budget` when `getCityBudget()` returns at least one fund
year, the same test `/budget` itself uses. With no budget loaded it shows
"Loading soon." with no link.

### Alt text is written to the shot list
The alt text describes the shot list's subject for each file. When the real
photos arrive, check each one against what is actually in the frame, since
the hero may be One Government Center or the Thurgood Marshall building.

The three "Who this is for" photos arrived on 2026-09-23 and their alt text
now describes those frames. They were resized to 1200 x 800. The parents photo
is portrait, so it is cropped to the band holding all three faces.

### The promise band has a visually hidden heading
The brief gives the band no heading. A hidden "Our promise" h2 keeps the
heading outline unbroken for screen reader users without changing the page.
