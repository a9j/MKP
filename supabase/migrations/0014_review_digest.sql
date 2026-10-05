-- Phase 2, step 5: the daily note saying what is waiting.
--
-- One mail a day, listing what nobody has looked at yet, with a deep link into
-- the form for each item. It sends nothing on a day with nothing waiting,
-- because a message that arrives every morning whether or not it matters is a
-- message people stop opening.

-- Where the digest goes for an administrator who reads mail somewhere other
-- than the address they sign in with. Null means use the sign in address.
-- Guarded for the same reason 0013 is: applied to the live project by hand
-- before the file was renumbered.
alter table public.admins add column if not exists digest_email text;

comment on column public.admins.digest_email is
  'Where the daily review digest goes for this administrator. Null means send it to the address they sign in with.';

-- site_settings is a key and value table, so the switch is a row rather than a
-- column: 'false' turns the digest off, anything else leaves it on. Seeded
-- true, because the point of the digest is that nobody has to remember to
-- check.
insert into public.site_settings (key, value, is_public) values
  ('digest_enabled', 'true', false)
on conflict (key) do nothing;
