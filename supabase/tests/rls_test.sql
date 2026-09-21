-- Row level security assertions. Run against a fresh database that has had
-- supabase_shim.sql and 0001_init.sql applied. Any failure raises an exception.

\set ON_ERROR_STOP on

insert into admins (email, name) values ('ed@monakproject.org', 'ED');
insert into inquiries (kind, name, email, message) values ('contact', 'A', 'a@x.com', 'hi');
insert into subscribers (email, confirmed) values ('s@x.com', true);
insert into people (name, role, active, sort_order, email) values
  ('Council One', 'advisory', true, 1, 'one@example.com'),
  ('Council Two', 'advisory', true, 2, 'two@example.com');

create or replace function pg_temp.want(label text, got bigint, expected bigint)
returns void language plpgsql as $$
begin
  if got is distinct from expected then
    raise exception 'FAIL % : got %, want %', label, got, expected;
  end if;
  raise notice 'OK % = %', label, got;
end; $$;

-- Asserts that a statement is refused, and that it is refused for the right
-- reason. A typo that errors some other way must not read as a pass.
create or replace function pg_temp.denied(label text, stmt text)
returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAIL % : statement was allowed', label;
exception
  when insufficient_privilege then raise notice 'OK % refused', label;
  when others then
    if sqlstate = 'P0001' then raise; end if;
    raise exception 'FAIL % : wrong error % %', label, sqlstate, sqlerrm;
end; $$;

\echo '== anon =='
set role anon;
select pg_temp.want('anon sees published reports only', (select count(*) from reports), 1);
select pg_temp.want('anon sees published listening only', (select count(*) from listening_sessions), 1);
select pg_temp.want('anon sees votes', (select count(*) from votes), 1);
-- These two counts are deliberately exact: a settings key that is public when
-- it should not be moves the first number without moving the second, which is
-- the mistake worth catching. Bump them on purpose when a migration adds a
-- setting, never to make a red test go green.
-- 0008 added explainer_max_reading_grade, public. 24 total, 1 private.
select pg_temp.want('anon sees public settings only', (select count(*) from site_settings), 23);
select pg_temp.want('anon sees latest_feed', (select count(*) from latest_feed), 4);
select pg_temp.denied('anon read admins',      'select 1 from admins');
select pg_temp.denied('anon read inquiries',   'select 1 from inquiries');
select pg_temp.denied('anon read subscribers', 'select 1 from subscribers');
select pg_temp.denied('anon write vote',
  $q$insert into votes (meeting_id, item_title, summary)
     select id, 'hack', 'x' from meetings limit 1$q$);
select pg_temp.want('anon sees the published roll call only',
  (select count(distinct vote_id) from vote_members), 1);
insert into inquiries (kind, name, email, message) values ('contact', 'B', 'b@x.com', 'hi');
insert into subscribers (email) values ('t@x.com');
\echo 'OK anon may submit an inquiry and subscribe'
reset role;

\echo '== authenticated, not an admin =='
set role authenticated;
set request.jwt.claims = '{"email":"stranger@example.com"}';
select pg_temp.want('stranger sees no admins',    (select count(*) from admins), 0);
select pg_temp.want('stranger sees no inquiries', (select count(*) from inquiries), 0);
select pg_temp.want('stranger sees no drafts',    (select count(*) from reports), 1);
select pg_temp.denied('stranger write vote',
  $q$insert into votes (meeting_id, item_title, summary)
     select id, 'hack', 'x' from meetings limit 1$q$);
reset role; reset request.jwt.claims;

\echo '== authenticated admin, email match is case insensitive =='
set role authenticated;
set request.jwt.claims = '{"email":"ED@MonaKProject.org"}';
select pg_temp.want('admin sees drafts too',   (select count(*) from reports), 2);
select pg_temp.want('admin sees draft votes too', (select count(*) from votes), 3);
select pg_temp.want('admin sees inquiries',    (select count(*) from inquiries), 2);
select pg_temp.want('admin sees subscribers',  (select count(*) from subscribers), 2);
select pg_temp.want('admin sees all settings', (select count(*) from site_settings), 24);
insert into votes (meeting_id, item_title, summary, status, published_at)
  select id, 'admin vote', 'x', 'published', now() from meetings limit 1;
\echo 'OK admin may publish a vote'
delete from votes where item_title = 'admin vote';
reset role; reset request.jwt.claims;

\echo '== a council member address is not public =='
set role anon;
-- people is public because the About page and Vote Watch name them, but their
-- email is not. A table wide grant would cover it, so the column is granted
-- back one by one and this proves the address is not among them.
select pg_temp.denied('anon read people.email', 'select email from people');
select pg_temp.want('anon still reads the public columns', (select count(*) from people where role = 'advisory'), 2);
reset role;

\echo '== software collects and drafts, a person publishes =='
-- The service role is what the scheduled jobs and the model calls run as. It
-- bypasses row level security by design, so the rule is enforced by a trigger
-- instead: it may write a draft and it may never write a published row.
set role service_role;

insert into votes (meeting_id, item_title, summary, ai_draft, ai_model, ai_confidence)
  select id, 'watcher draft', 'x', true, 'test-model', 0.91 from meetings limit 1;
\echo 'OK the service role may write an AI draft'

select pg_temp.denied('service role cannot insert a published vote',
  $q$insert into votes (meeting_id, item_title, summary, status, published_at)
     select id, 'x', 'x', 'published', now() from meetings limit 1$q$);
select pg_temp.denied('service role cannot publish an existing vote',
  $q$update votes set status = 'published', published_at = now(), ai_draft = false
     where item_title = 'watcher draft'$q$);
select pg_temp.denied('service role cannot publish a report',
  $q$insert into reports (slug, title, type, report_date, summary, status, published_at)
     values ('sneak', 'x', 'pay_report', '2026-01-01', 'x', 'published', now())$q$);
select pg_temp.denied('service role cannot publish a listening session',
  $q$insert into listening_sessions (session_date, audience, attendee_count, summary, status, published_at)
     values ('2026-01-01', 'teachers', 1, 'x', 'published', now())$q$);
reset role;

delete from votes where item_title = 'watcher draft';

\echo '== an AI draft is not public =='
set role anon;
select pg_temp.want('anon sees published votes only', (select count(*) from votes), 1);
select pg_temp.want('anon sees no AI drafts',
  (select count(*) from votes where item_title = 'Machine drafted vote'), 0);
reset role;

\echo 'ALL RLS ASSERTIONS PASSED'
