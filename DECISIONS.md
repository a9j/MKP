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

The how-we-work photo arrived on 2026-09-24: someone holding a stack of tax
forms in front of their face. It is cropped to 4:5 at 1200 x 1500 from the
hair to the belt. On a phone it sits above "How a 400-page PDF becomes a
four-minute read." and on a desktop it sits to its left, as the brief laid out.

### The promise band has a visually hidden heading
The brief gives the band no heading. A hidden "Our promise" h2 keeps the
heading outline unbroken for screen reader users without changing the page.

## 2026-10-05, ballot, levy and contract explainers

### They are the Phase One explainers, with a template
The brief described a new `explainers` table with its own draft and publish
switch. One already existed, from 0008: claim-level sourcing, a publish gate in
the database, frozen versions, and an audit trail, with no screens yet. A
second table of the same name could not exist, and a second way to publish
beside the first is the thing "Publishing goes through one path" rules out.
So 0011 adds a `template` column (ballot, levy, contract) to the existing
table, puts the issue cards, levy figures and timeline in their own tables,
and gives `explainer_problems()` a checklist for templated explainers in place
of the claim checks. A claim-based explainer, `template` null, behaves exactly
as before. This was put to the director and agreed before building.

What that costs: an edit to a live page stays private until it is published
again, and from version 2 a change note is required. The contract tracker's
quick update writes that note itself.

### The public reads the snapshot, not the new tables
The brief asked for public read on the new tables where the parent is
published. They are admin only instead, and the public page is built from the
snapshot `publish_explainer()` freezes, which now carries the issues, figures,
events and sources. Public read on the live tables would show an unpublished
edit the moment it was saved.

### A ballot page uses the ballot_issue kind
A ballot page covers a whole election. It is stored as kind `ballot_issue`
rather than a new enum value, because Postgres does not let a migration add an
enum value and use it in the same transaction. A check constraint ties each
template to its kind, and the home page's "what's on the ballot" test, which
filters on kind, picks ballot pages up unchanged. The election date is the
explainer's `decision_date`, not a column on each issue.

### A figure's source must belong to the same explainer
The source columns are composite foreign keys on (explainer_id, id), so an
issue cannot cite another explainer's document. Removing a source clears the
figures that cited it (`on delete set null (column)`), which puts them back on
the checklist.

### The checklist reads like the house rules
Besides sources, a templated explainer cannot publish with an em dash in reader
facing text or with "vote yes" or "vote no" in it. Samples can never publish,
and `explainers_public` and the public read policies exclude them as well.

### The reading grade is computed on save
`reading_grade` was "computed by the app on save" in 0008, but nothing computed
it. `src/lib/reading-grade.ts` is a plain Flesch-Kincaid over the summary and
the plain-language fields, not the titles, which are names.

### Old files are never deleted
A new PDF or photo is a new object. The previous one stays, because the
published version still points at it until the next publish.

### Missing tables are a state the site survives
Until 0011 is applied, every explainer read logs the reason and returns
nothing, so the build and the home page carry on. This is the same rule as
"An empty table used to take the whole site down".

### Two local fixes the tests needed
`0009_ballot_explainer.sql` could not run on a fresh database, because the
`latest_feed` view depends on `reports.type`. Production had it applied by
hand and never recorded it. It is now guarded: it runs only while the column
is still the enum, and saves and restores the view and its grant. The local
shim now grants the `auth` schema the way Supabase does, which
`publish_explainer()` needs as the caller. The local auth stand in also
accepts a password, since the admin login no longer sends magic links.

### Still open
The `/explainers` index lists only templated explainers. The Phase One spec's
`/explainers/[slug]` page for claim-based explainers is still not built. The
Reports page still describes ballot, levy and contract work in its own cards
and was left alone.

## 2026-10-05

### Reports read on the page; the PDF is a download
Explainers were only reachable as an embedded PDF. `reports.body` (migration
0013) holds the full explainer in markdown and renders on `/reports/[slug]`.
The summary stays capped at 600 characters as the lede and card text. The PDF
is offered as a download: the attached file when there is one, otherwise a
"Download as PDF" button that prints the page with a print stylesheet that
strips the site chrome. A report with no body still falls back to the inline
PDF. Markdown tables are not used because react-markdown runs without GFM.

### Levy card links to the levy explainers
The Levy Explainers card on `/reports` now links to published
`levy_explainer` reports, and the status-note fallbacks use `||` so an empty
setting no longer renders a blank label.

## 2026-10-05, the templated explainer system turned on in production

### 0011 was applied in six pieces, then checked against the file
The Supabase tool this session has times out at 60 seconds, and the whole
migration in one call rolled back twice. It went up in six verified pieces
instead. Because hand applied SQL can drift from the file it came from, the
result was checked rather than trusted: a digest over every column, constraint,
index, function body, view definition, policy expression and trigger on the
five affected tables came to the same md5 (155 objects) in production and in a
local database built from the migration files. Nothing in 0011 drops or
rewrites data, and `explainers` was empty when it ran.

### alter policy, not drop and create
`drop policy` on `explainers` hung past the tool's timeout every time, while
every other statement ran in under a second. `alter policy` changes the same
`using` clause in place and ran immediately. It is the better statement here
anyway: drop and create leaves a window, however short, in which the table has
no read policy at all.

### The levy pairing is listed in code, not stored
A levy now reaches a reader two ways: the written report at `/reports/[slug]`,
and the structured page at `/levy/[slug]` with the calculator. The pairing
between them is editorial, not structural, so `src/lib/levy-pairs.ts` lists it
rather than a column carrying it. Each side links to the other only when the
other is published, so an unpaired or draft page shows one less link and never
a broken one.

### The four real explainers were created as drafts
Publishing goes through `publish_explainer()` as a signed in admin, which this
session cannot be: it has no admin session, and the egress policy blocks
monakproject.org and the Supabase host. The three levy explainers and the
ballot page were written as drafts with their figures sourced, and
`explainer_problems()` returns an empty list for all four, so each is one
Publish press away. The publish path itself was proved locally: the same rows,
published through `publish_explainer()` as an admin, produced version 1 and a
rendered page with the cross link.

### The ballot page carries three of twelve measures
The verified October 4 text for the other nine lives only in the PDF attached
to the ballot report, which this session cannot read for the same egress
reason. Rather than paraphrase a ballot issue from memory, the three levy cards
that could be sourced from published copy were written and the rest left out,
with the page held as a draft.

### The ballot overview reads on the page, and names its own gap
The 12-measure overview had an empty body, so it reached a reader only as an
embedded PDF. It now reads on the page, written from material already verified
and already published: the inventory of the 12 measures comes from this
report's own summary, and the Issue 8, 9 and 13 figures come from the three
levy explainers. Nothing on it is a new claim.

What it does not do is paraphrase the nine measures whose verified text exists
only inside the attached PDF, which this session cannot read. Rather than
write nine plausible ballot summaries from memory, the page names all twelve so
a reader knows what they will see, explains the three that are checked, and
sends them to the Board of Elections for their own ballot. The page says this
in a line of its own, because a reader is owed the shape of what is missing
rather than a page that looks complete.

Measured with the repo's own Flesch-Kincaid: the overview is grade 6.3, and the
three levy explainers are 5.4, 4.8 and 5.4. The editorial cap is 8th grade.


## 2026-10-05, phase 2 step 3: ballot explainers

Step three of the build order, the one with the deadline: early voting opens in
early October. Part D, plus the repairs it took to get there.

### The repo had moved, and three of the four decisions were already made

Between the step 2 merge and this work, fourteen commits landed: a visual
redesign, photography, and a switch of admin sign in from magic links to email
and password. Part D was also started by someone else, differently from the
brief: `ballot_explainer` was added as a fourth report type alongside
`levy_explainer`, rather than replacing it, with its own card and copy on
`/reports`.

The brief says rename. The repo says keep both. Asked, and the answer was keep
both, so an explainer is now either type: both carry the ballot fields, both
group under the "On the ballot" heading, both render the fixed three part
page. `EXPLAINER_TYPES` in `src/lib/report-types.ts` is the one place that
decides, so merging them later is a one line change and a data update.

### The migration chain could not be applied to a new database

`0009_ballot_explainer.sql` converts `reports.type` from an enum to text, and
Postgres refuses to change the type of a column a view depends on. `latest_feed`
depends on it. So the migration failed partway on any fresh database, which
means nobody could set up this project from scratch, and `local-supabase.sh`
stopped dead. It had worked on the live project, where it was presumably
applied by hand with the view out of the way.

The migration now drops the view and rebuilds it. Both 0009 files were already
applied to the live project, so editing the file changes nothing there; it is
the next clean setup it saves. The duplicate 0009 number is left alone for the
same reason: both are applied everywhere, they touch different tables, and they
sort in an order that works.

### Sign in was switched to a password, and nothing else moved with it

The October commit changed the login form to `signInWithPassword`. The local
auth stub only implements the magic link endpoints, so every test that signs in
hung for twenty seconds and then failed, and local development could not sign in
at all. The stub now accepts a password grant with one development password,
and the helper signs in the way the screen now works.

Two tests were about the old flow and are now about the new one: "there is no
password field anywhere" asserted something that is deliberately false, so it
is "a wrong password is refused" instead, and the single use magic link test is
gone with the links.

One thing did not survive the switch and is not mine to rebuild: under magic
links, an address that was not on the administrator list was turned away at the
confirm route with a message saying so. Password sign in has no confirm route,
so a non-administrator now signs in, sees the workspace shell and is told by
each page that they are not an administrator. Nothing is exposed, because every
page and every action checks, and RLS refuses the write either way. It is worse
to read than it was. Worth deciding what that path should say.

### Three things from steps 1 and 2 had been reverted

The redesign undid the phone gutter fix, the two row admin tab bar, and the
City Budget Explorer card on the home page. All three are restored, and all
three had tests, which is how they were found rather than being noticed on a
phone months later. The brief asks for four programs on the home page, so the
budget card is not a preference.

### Every photograph on the site was positioned against the viewport

`next/image` with `fill` positions itself against the nearest positioned
ancestor. The `Photo` component gave it none, because `.photo` had no CSS at
all. Four full screen images were therefore stacked over the top of the home
page, painting over whatever was there, which is what hid the new ballot strip
and is why the strip's link could not be clicked.

Fixing that uncovered the next one: `.civic-hero-bg` and `.civic-hero-scrim`
had no CSS either, so the hero had no scrim and its white headline sat on a
pale photograph. The markup already named the layers; these are the rules that
make them layers.

### The contrast failures the photographs had been hiding

With the photographs out of the way, axe found three, all from translucency or
from gold on white:

- `.civic-cta p` at 85% white on teal, 4.34:1. Solid white clears it at 4.6:1.
- The footer's admin link at 70% opacity, 3.02:1. The opacity is gone.
- `.civic-kicker`, gold on white, 2.24:1 at 13px. Gold is now scoped to the
  three dark sections it was drawn for, and the kicker takes an ink colour
  everywhere else. The dark sections are named rather than the light ones,
  because a new section is light by default and would otherwise inherit a
  colour it cannot carry.

### The explainer's shape is fixed, and the server enforces it

Three questions, always the same three, always in that order: what it asks for,
what it would fund, what happens if it fails. A fourth, what it costs a
homeowner, is optional because the auditor's certification is not always out
when the explainer is written.

The three are required by the form and again by the server action, so the rule
does not depend on the browser having run the right JavaScript. The homeowner
figure is refused unless the text names the auditor, because that is the number
a reader checks against their own tax bill and it has one legitimate source.
A ballot date and an issue number have to arrive together, in the form and in a
check constraint, since half an identity is a half entered explainer rather
than a state anybody meant.

### One heading per election, not one heading for the page

The brief groups explainers under "On the ballot, November 3, 2026". With one
election coming that is exactly what renders. With two, a single heading
carrying the soonest date would be labelling issues that are not on that
ballot, so there is a heading per election date, each with its own list, sorted
by issue number inside it. `compareIssueNumbers` sorts Issue 2 above Issue 12,
which a string sort does not.

Nothing is hardcoded to November 2026. An explainer joins the group when its
ballot date is still ahead and leaves the day after, including the home page
strip, without anyone remembering to take it down.

### What is still red

One test: "the Explorer below Latest" expects the Explorer section to come
after the Latest feed, and on the page it comes before. Both are from the
redesign, so one of the two drifted from the intent and I do not know which.
Reordering sections of the home page is a visible design change and not mine to
guess at. Everything else passes: 65 end to end, 56 data, the RLS suite, and
visual parity.

The home page feed is ordered by date alone, so items published on the same day
tie in an arbitrary order. It makes one test fragile once a development
database has collected a few same day rows. A tiebreak column on `latest_feed`
would fix it properly.

## 2026-10-05, phase 2 steps 5 and 6: the daily digest and the status line

The two leftovers from step 3, then Part B and the parts of Part E that do not
wait on the council watcher. Step 4 is deliberately not here: the brief says
not to start it until a council meeting has been posted by hand, and none has.

### The two leftovers

The sign in screen turns away an address that is not on the administrator list
again, with the sentence it used to use. Under magic links the confirm route
did that; password sign in has no confirm route, so the check happens in the
form: sign in, read `admins`, and sign straight back out when it comes back
empty. The table is readable only to an administrator, so an empty read is the
answer. This is a courtesy and not the boundary, which is still the check on
every page and RLS underneath it.

The home page test asked for the Explorer below the Latest feed and looked for
an element with id `latest`, which the page has never had. It was measuring
nothing and could not pass. The page puts the one worked example above the
news, which is the order a reader meets the site in, so the page is taken as
the answer and the test now measures that.

### Two of the digest's six categories have nothing to count

The brief lists six things the digest counts. Four exist: AI draft votes,
report drafts, listening drafts, and records requests past ten business days.
Two do not.

"Flagged roll-call disagreements" needs the roll call extractor, which is step
4. "Forecasts waiting to be entered" needs a forecasts table, which no
migration has ever created. Rather than invent either, the digest counts the
four that exist and is built so a fifth is a few lines: everything comes from
one list in `src/lib/review-queue.ts`.

### The dashboard and the digest read the same queue

They have to agree about what "waiting" means. A count on a screen and a count
in an email that disagree is worse than either alone, so both read
`getReviewQueue`, and the dashboard filters out the records requests only
because it shows them in their own section underneath.

### Nothing waiting sends nothing

A message that arrives every morning whether or not it matters is a message
people stop opening, and the whole value of this one is that its arrival means
something. A day with an empty queue writes a `skipped` job row and sends no
mail. So does a day when `digest_enabled` is false, or when the master switch
is off, and each row says which of those it was.

### Three ways the digest declines to run, and all of them are recorded

A caller without the shared secret gets a 401 and no job row: an
unauthenticated request is not a run of the job, and letting one write to the
log would be a way to fill it with noise. Everything else writes a row.

A route with no `CRON_SECRET` set refuses every caller rather than being left
open. An unauthenticated endpoint that writes to the database is worse than one
nobody can reach. The comparison is constant time over equal lengths, so a
wrong secret cannot be found one character at a time by timing the refusal.

### site_settings is a key and value table, so digest_enabled is a row

The brief asks for "a `digest_enabled` boolean on `site_settings`". That table
has been key and value since 0001, so the switch is a row whose value is the
string "false" when off. Reading it treats anything other than "false" as on,
which means a typo leaves the digest running rather than silently stopping it.

### AUTOMATION_BODIES defaults to the school board alone

Switching the master on should not also start fetching a body whose output
nobody has checked. An unrecognised name in the list is dropped with a warning
rather than guessed at, because the cost of guessing is a collector reading the
wrong agenda. `automationEnabledFor` is what a watcher asks, and it is false
unless both switches agree.

### `automation.ts` carries no server-only guard, on purpose

`email.ts` has one because it holds the Resend key, and that guard is what put
its template beyond the reach of a test until `email-disk.ts` was split out. The
same split is made twice more here: `email-template.ts` holds the layout, and
`review-queue.ts` holds the sorting and grouping rules. Nothing in any of the
three is a secret, and all three are now tested directly.

`automation.ts` reads `CRON_SECRET` but never returns it, so it is testable as
it stands. What it would do in a browser is return false, which is the safe
answer.

### A skipped run still counts as the watcher being heard from

The status line marks a job amber when nothing has succeeded in 48 hours, and
a skipped run counts as success for that purpose. A watcher that found nothing
new, or one deliberately switched off, has still been heard from; what the
amber is for is a job that has stopped reporting at all.

### The cron hour is UTC, so it moves with daylight saving

Vercel's scheduler has no timezone. The brief asks for 7:00 am, and
`0 11 * * *` is 7:00 am in Toledo while daylight saving is in effect and 6:00
am outside it. An hour early in winter seemed better than an hour late, but it
is worth knowing the digest does not stay at 7:00 all year.

### The RLS suite counts settings rows

`admin sees all settings` asserts an exact count, which 0012 moved from 24 to
25. The count is what proves an administrator sees the operational settings as
well as the public ones, so it was updated rather than loosened to "more than
none".

### Three em dashes removed, two of them from copy I did not write

The house rule is no em dashes anywhere. The digest's own "AI draft,
unreviewed" marker had one, which became a full stop. Two more were already on
the site from the redesign: the home page meta description and the separator
between an agency and its records officer address on `/records`. The rule is
not about those two lines in particular, so they were fixed as well: a colon in
both places, no wording changed. The home page description is metadata and
never rendered, so visual parity is untouched.

### The end to end suite needs a freshly seeded database

Two feed assertions failed on a second run against the same local database and
passed again after reseeding. Nothing was wrong with the code: the tests post
real votes and leave them behind, the home page feed shows a fixed number of
items, and after enough runs a new vote no longer fits on it. The fix is a note
in README rather than a change to the tests, because the thing the test is
checking, that a saved vote reaches the feed, is the right thing to check.

## 2026-10-05, merging the templated explainers into the phase 2 branch

`main` moved while steps 5 and 6 were being built: PR 17 landed a complete
templated explainer system, about 5,400 lines of it, plus a new home page
design. Merging it raised five conflicts and a handful of things that only
showed up once both halves were in one tree.

### Where the two sides disagreed, main won on design

`main`'s home page, its `globals.css` and its version of
`0009_ballot_explainer.sql` were taken whole. Its 0009 is strictly better than
the fix this branch had made for the same problem: both drop and rebuild
`latest_feed` so the column type can change, but main's saves the view's own
definition with `pg_get_viewdef` and is guarded so it can run twice, which the
live project needed and a hand written copy of the 0006 view did not give.

### Two ways to publish a ballot explainer now exist, and that is not resolved

This branch added six columns to `reports`, so an explainer is a report that
answers three fixed questions. `main` added a dedicated system: its own
tables, templates, snapshots, a levy calculator, a reading grade check, admin
screens, and `/explainers`, `/ballot/[slug]`, `/levy/[slug]`,
`/contract/[slug]`. Both are in this branch and both work. Nothing was deleted,
because deleting either is an editorial decision about where a reader goes to
read about a ballot issue, not a merge conflict. It is written up on the pull
request for a decision.

### This branch's migrations moved to 0013 and 0014

`main` took 0011 and 0012 for the explainer templates and samples. Renumbering
was the honest fix, since two files sharing a number stops the sequence meaning
anything. Both had already been applied to the live project by hand, so both
are now guarded with `if not exists` and a constraint check, the same way
main's 0009 is, and both are no-ops where they have already run.

### The redesign reverted the same four repairs again

The phone gutter, the two row admin tab bar, the City Budget Explorer card and
the duplicate `id="explorer"` were all fixed in September or in step three, all
reverted by this redesign, and all restored here. The gutter one is now fixed
at the cause rather than overridden: `.civic-everything`,
`.civic-page-hero-inner` and `.civic-section` sit on the same element as
`.wrap` and were setting the `padding` shorthand, which wipes the gutter
`.wrap` gives. They set `padding-block` now, so the inline gutter survives.
Each of the four has a test, which is how all four were found.

### Six accessibility failures came with the redesign, five of them new

Axe found, and this fixes: the program card number at 3.23:1 on teal, the call
to action paragraph at 4.34:1, the numbered list marker at 2.24:1 on white and
2:1 on navy, the "nothing here yet" line at 1.81:1 on gold and 2.22:1 on navy,
the gold kicker at 2.38:1 on teal, and seven form labels at 2.92:1 and 1.07:1
on the two coloured bands of `/get-involved`. The rule that came out of it:
gold reads on navy at 6.5:1 and on teal at 2.38:1, so gold belongs on navy,
white goes on teal, and teal ink goes on paper. Three of these had been fixed
in step three and came back.

### The visual parity check was comparing two different headings

`sectionHeading` selected the first `section.wrap h2`, and the redesign put two
new display headings above the Latest feed, so the mockup's heading and the
built page's were no longer the same element and a deliberate design change
read as a drift. It now selects the heading over the feed, which both documents
still share, and matches at 800px again. Narrowing a selector to compare the
same thing is not the same as loosening a check to make it pass.

### A setting shows up everywhere, so saving one revalidates the layout
The EIN and the mailing address sit in the footer of every public page, but a
settings save only revalidated six routes by name. Putting the real EIN in
showed the gap: it appeared on the six and left the placeholder on
`/corrections`, `/reports`, `/votes`, `/budget`, `/listening` and
`/explainers`. Listing routes one by one was never going to hold for something
the whole site renders, so a settings save now calls
`revalidatePath("/", "layout")`, which covers every page under the public
layout. The per route list stays for the saves that really do touch named
pages.

## 2026-10-07, the five remaining ballot issues

### "A yes vote means" is not a position
The house rule is no positions, no endorsements, no vote recommendations. The
five new sections each end with a matched pair: what a yes vote does, what a no
vote does, in parallel wording and at the same length. That is the League of
Women Voters shape, and it is the opposite of a recommendation: it tells a
reader the consequence of either choice and leaves the choice alone. The test
applied to every pair was whether the two lines could be swapped in order
without changing which one reads as preferred. They can. A section that could
only be written persuasively would have been left as a bare description
instead.

### The certified ballot is still unread, and the page still says so
WebFetch and curl are both blocked by the egress proxy for every official
domain: the Lucas County sample ballot, lucascountyohiovotes.gov,
toledo.oh.gov, ohiosos.gov, codelibrary.amlegal.com, even Wikipedia. WebSearch
runs server side and does work, so the sourcing for these five came through
search results that quote the official documents, and each figure links to the
document itself for a reader who can reach it.

That is good enough for Issue 3, where the Secretary of State publishes the
ballot language and the enrolled Senate Joint Resolution 10 is online, and for
Issue 16, where Ordinance 301-26 is quoted at length. It is not good enough for
Issues 17, 18 and 19, whose charter chapters and sections come from Toledo City
Paper's account of the ballot wording rather than from the wording. So the page
keeps a section saying exactly that, naming what was read and what was not. The
alternative was a page that looks finished and is not, which is the failure
mode the whole project exists to avoid.

### Three ordinance numbers came out again
A search attributed Issues 17, 18 and 19 to Ordinances 302-26, 304-26 and
305-26 but gave no mapping from issue to ordinance, and no page was reachable
to confirm either the set or the mapping. Every number on the site links to its
source, so three numbers that cannot be sourced do not go on the page. "Toledo
City Council put all three on the ballot" is what is actually known.

### The fourth Issue 18 change is not on the page
The draft handed over listed four changes for Issue 18, the fourth being that
all petitions would have to use the state's official forms. Three are sourced
to named charter sections. The fourth could only be sourced as far as write-in
declarations, which is already item two, so a general petition forms
requirement is not stated as fact. Issue 18 is described as three changes.

### Grade 5.3, against a target of 8
The ask was eighth grade. Flesch-Kincaid over the finished body, with markdown
stripped, scores 5.3, well inside the explainer cap of 9. Short sentences did
most of it. The unavoidably long words, "constitution", "identification",
"unclassified", are each given a plain gloss the first time they appear rather
than being swapped for something vaguer.

### The expansion is logged as a correction
The page was already published saying five of the eight issues had one line
each. Replacing that with full sections is a material change to something
readers had already seen, so it goes in the corrections log with what changed
and why, the same as an error would. The log is the record of what the page
used to say.

## 2026-10-07, the stock decorations audit

Checked against a list of fifteen tells, the ones that mark a page as having
been assembled from a template rather than designed. Eleven were already
absent, which the house rules had done on their own: Instrument Sans rather
than Inter, a navy and teal and gold palette with no purple, no gradient text,
no icon tiles, no giant "10M+", no beige italic serif, and "one animation on
the site" meaning the stylesheet holds no `@keyframes` at all, so there is
nowhere for a pulsing green dot to live. No em dashes and no marketing verbs,
because both were already banned.

Four were present and are gone.

### The sticky nav was frosted glass
`backdrop-filter: saturate(180%) blur(14px)` over an 88 percent background. It
is the stock look, and it costs something real: text sliding under a
half transparent bar is unreadable for the moment it crosses, and the blur
repaints the whole strip on every scroll frame. The nav is opaque now. The
hairline under it was already doing the separating.

### The step numbers were hollow outlined numerals
`.civic-step-n` was 44 to 72px, `color: transparent`, drawn with a 2px gold
`-webkit-text-stroke`. Besides being decoration, anything whose only colour
comes from a prefixed property disappears entirely where that property is not
honoured, and the fill underneath was transparent. The numbers are 15px solid
gold on the section's navy, 6.5:1.

### "01, 02" ran down four lists, three of which were not sequences
The home page programs, the Explorer's features and the principles on /about
were all numbered. None of them is ordered: nobody opens the Explorer before
the Records Desk, and no principle outranks another, so the numerals asserted
an order that does not exist. Those three lost their numbers, and the two that
were `<ol>` became `<ul>`, which is the same correction in the markup. They are
hairline divided lists now, which is what the house rule said in the first
place.

The records desk list kept its numbers, because filing a request really does
happen in that order, and so did the home page's five steps. Both dropped the
zero padding. The rule that came out of it: a numeral earns its place only when
the order is real, and it is never zero padded.

### The numeral column outlived the numeral
Shrinking the numbers left them floating in a 120px column sized for the old
display type, with the heading stranded across a gap. Caught by looking at the
page rather than by a test. Column is 28px now, 24px on phones.

### This is a test, not a note
Two comments in the stylesheet already said a fix had been made once and came
back with a redesign, so tests/e2e/house-style.spec.ts now checks for all
fifteen. It reads two places, because there are two ways in: the authored
globals.css, with its comments stripped, since several of them name the
property they removed and would otherwise fail on their own changelog; and the
computed style of every element the pages render, which catches the same
decoration arriving as a Tailwind utility class in JSX. Reading the built
bundle instead does not work, because Tailwind ships definitions for utilities
nobody uses, so the bundle contains the string "backdrop-filter" whether or not
anything is frosted. The test was checked by putting a frosted nav, a purple
glow and a "01" back and watching all three fail.
