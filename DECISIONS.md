# Decisions

Choices made while building that were not spelled out in the brief. Each one
notes what was decided and why, so it can be reversed quickly if it is wrong.

## Blocked: the two reference files were not in the repository

The brief says `mona-k-homepage-mockup.html` and `mona-k-project-site-copy.md`
are in the folder. They are not, and the repository had no commits at all when
this build started. Nothing has been invented in their place. See "Open
questions" at the bottom.

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

## Open questions

1. `mona-k-homepage-mockup.html` is needed before any design token, spacing
   value, or component can be written. The palette, type scale and layout all
   come from it and none of it is safe to guess.
2. `mona-k-project-site-copy.md` is needed for page copy, which the brief says
   to use verbatim, and for the full list of `[BRACKET]` placeholder keys to
   seed into `site_settings`. The migration currently seeds only the keys named
   directly in the build brief: `org_ein`, `mailing_address`, `donate_url`,
   `explorer_url`, `scenario_a_pct`, `scenario_b_flat`,
   `request_template_path`, `contact_email`, the four social links, and three
   private records officer emails. Any placeholder the copy doc adds needs a
   follow up migration.
