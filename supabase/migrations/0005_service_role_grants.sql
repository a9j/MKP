-- The service role reads past RLS for the two places that need it: the
-- unlisted report preview, and anything server side that must see a draft.
--
-- A Supabase project grants this role automatically, so this is invisible
-- there. The migration is meant to stand on its own against a plain Postgres,
-- and without these grants the preview link fails with "permission denied for
-- table reports" even though the role can bypass row level security: BYPASSRLS
-- skips the policies, not the table privileges.

grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant all privileges on all functions in schema public to service_role;

alter default privileges in schema public
  grant all privileges on tables to service_role;
alter default privileges in schema public
  grant all privileges on sequences to service_role;
