-- Row level security assertions. Run against a fresh database that has had
-- supabase_shim.sql and 0001_init.sql applied. Any failure raises an exception.

\set ON_ERROR_STOP on

insert into admins (email, name) values ('ed@monakproject.org', 'ED');
insert into inquiries (kind, name, email, message) values ('contact', 'A', 'a@x.com', 'hi');
insert into subscribers (email, confirmed) values ('s@x.com', true);

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
select pg_temp.want('anon sees public settings only', (select count(*) from site_settings), 20);
select pg_temp.want('anon sees latest_feed', (select count(*) from latest_feed), 4);
select pg_temp.denied('anon read admins',      'select 1 from admins');
select pg_temp.denied('anon read inquiries',   'select 1 from inquiries');
select pg_temp.denied('anon read subscribers', 'select 1 from subscribers');
select pg_temp.denied('anon write vote',
  $q$insert into votes (body_id, meeting_date, item_title, summary)
     select id, '2026-01-01', 'hack', 'x' from bodies limit 1$q$);
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
  $q$insert into votes (body_id, meeting_date, item_title, summary)
     select id, '2026-01-01', 'hack', 'x' from bodies limit 1$q$);
reset role; reset request.jwt.claims;

\echo '== authenticated admin, email match is case insensitive =='
set role authenticated;
set request.jwt.claims = '{"email":"ED@MonaKProject.org"}';
select pg_temp.want('admin sees drafts too',   (select count(*) from reports), 2);
select pg_temp.want('admin sees inquiries',    (select count(*) from inquiries), 2);
select pg_temp.want('admin sees subscribers',  (select count(*) from subscribers), 2);
select pg_temp.want('admin sees all settings', (select count(*) from site_settings), 21);
insert into votes (body_id, meeting_date, item_title, summary)
  select id, '2026-01-02', 'admin vote', 'x' from bodies limit 1;
\echo 'OK admin may write a vote'
reset role; reset request.jwt.claims;

\echo 'ALL RLS ASSERTIONS PASSED'
