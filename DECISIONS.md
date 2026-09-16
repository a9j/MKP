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
