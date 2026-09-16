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
