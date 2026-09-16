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
| `RESEND_API_KEY` | Resend API key for the contact form and subscriber mail |
| `NEXT_PUBLIC_SITE_URL` | Absolute site URL, used for Open Graph images and signed links |

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
| `pnpm test:db` | Applies the migration to a throwaway Postgres and runs 41 assertions on `business_days_between`, the `latest_feed` view, the source and length constraints, and the RLS rules for anonymous, non-admin and admin callers |
| `pnpm test:data` | Runs the query layer against real PostgREST: feed ordering, draft exclusion, settings filtering, and the RLS boundaries as `supabase-js` sees them |
| `pnpm test:visual` | Compares the rendered home page against `mona-k-homepage-mockup.html` element by element |

`pnpm test:data` and `pnpm test:visual` need the local stack and a running app.

The mockup loads Instrument Sans from the Google Fonts CDN. Where that is
unreachable it silently falls back to a system font and every measurement
drifts, so `test:visual` serves the mockup from a local origin and proxies the
app's self hosted font files to it. Both pages then render with the same font.

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

1. Import the repository in Vercel.
2. Set the five environment variables above for Preview and Production.
3. Build command `pnpm build`, output handled by the Next.js preset.
4. Point `monakproject.org` at the project and set `NEXT_PUBLIC_SITE_URL` to it.

Public pages use ISR. Every admin save calls `revalidatePath` for the routes it
affects, so published work appears within seconds without a rebuild.

## Project conventions

- Gold is used for exactly one thing: the underline on a number that links to a
  source document, rendered by the `<Sourced>` component. It appears nowhere
  else.
- No em dashes or en dashes anywhere: not in the UI, the copy, code comments, or
  commit messages.
- Judgment calls made during the build are recorded in `DECISIONS.md`.
