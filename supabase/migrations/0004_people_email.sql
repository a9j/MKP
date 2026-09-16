-- "Send to council" emails the advisory council, but 0001 gave people no
-- address to write to.
--
-- people is public read, because the About page lists staff and council and
-- Vote Watch names board members. A personal email address is not something
-- this organization should publish on their behalf, so the column is added and
-- then taken away from the anonymous role at the column level. Row level
-- security cannot express "this row but not this column"; a column grant can.

alter table public.people add column email text;

comment on column public.people.email is
  'Not public. Used to email advisory council members a report preview. The anon role cannot read this column.';

-- The table wide grant in 0001 covers every column, including ones added
-- later, and a column level revoke does not cut into it. The table grant has
-- to go first, then the readable columns are granted back one by one. Without
-- this the address is simply public, which is how it was caught.
revoke select on public.people from anon;

grant select (
  id, name, title, role, body_id, term_start, term_end,
  active, bio, photo_path, sort_order, created_at
) on public.people to anon;
