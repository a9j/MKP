-- Schema assertions: business_days_between, the latest_feed view, and the
-- constraints that keep an unsourced or overlong row out of the database.

\set ON_ERROR_STOP on

create or replace function pg_temp.eq(label text, got anyelement, expected anyelement)
returns void language plpgsql as $$
begin
  if got is distinct from expected then
    raise exception 'FAIL % : got %, want %', label, got, expected;
  end if;
  raise notice 'OK %', label;
end; $$;

create or replace function pg_temp.rejects(label text, stmt text, want_sqlstate text)
returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAIL % : statement was accepted', label;
exception when others then
  if sqlstate = 'P0001' then raise; end if;
  if sqlstate <> want_sqlstate then
    raise exception 'FAIL % : wrong error % %', label, sqlstate, sqlerrm;
  end if;
  raise notice 'OK % rejected', label;
end; $$;

-- business_days_between: start exclusive, end inclusive, weekends skipped.
select pg_temp.eq('mon to tue is 1',        business_days_between('2026-09-14','2026-09-15'), 1);
select pg_temp.eq('fri to mon is 1',        business_days_between('2026-09-11','2026-09-14'), 1);
select pg_temp.eq('mon to next mon is 5',   business_days_between('2026-09-07','2026-09-14'), 5);
select pg_temp.eq('same day is 0',          business_days_between('2026-09-14','2026-09-14'), 0);
select pg_temp.eq('sat to sun is 0',        business_days_between('2026-09-12','2026-09-13'), 0);
select pg_temp.eq('reversed is 0',          business_days_between('2026-09-15','2026-09-14'), 0);
select pg_temp.eq('null end is null',       business_days_between('2026-09-14', null), null::integer);
select pg_temp.eq('null start is null',     business_days_between(null, '2026-09-14'), null::integer);
-- A request open past 10 business days is what /admin flags.
select pg_temp.eq('three weeks is 15',      business_days_between('2026-08-24','2026-09-14'), 15);

-- Seed one row per feed source, plus a draft of each kind that must stay hidden.
insert into reports (slug, title, type, report_date, summary, status, published_at) values
  ('tps-pay-2026', 'What TPS Pays Teachers', 'pay_report', '2026-09-01', 'x', 'published', now()),
  ('draft-one',    'Unpublished Draft', 'levy_explainer', '2026-09-10', 'x', 'draft', null);

insert into records_requests (agency_id, request_text, date_filed, status, date_responded)
select id, 'Salary schedule, 2025 to 2026', '2026-09-05', 'fulfilled', '2026-09-12'
from agencies where name = 'Toledo Public Schools';

insert into votes (body_id, meeting_date, item_title, summary, category, amount, yes_count, no_count)
select id, '2026-09-09', 'Approve roof replacement',
       'The board approved a roof replacement at one building.', 'facilities', 1250000, 4, 1
from bodies where slug = 'tps-board';

insert into listening_sessions (session_date, audience, attendee_count, summary, status, published_at) values
  ('2026-09-03', 'teachers', 22, 'x', 'published', now()),
  ('2026-09-04', 'parents',   9, 'x', 'draft',     null);

select pg_temp.eq('feed has one row per published item', (select count(*) from latest_feed), 4::bigint);
select pg_temp.eq('feed hides draft report',   (select count(*) from latest_feed where title = 'Unpublished Draft'), 0::bigint);
select pg_temp.eq('feed hides draft listening',(select count(*) from latest_feed where kind = 'listening'), 1::bigint);
select pg_temp.eq('feed is ordered by date desc',
  (select kind from latest_feed order by date desc limit 1), 'vote');
select pg_temp.eq('report href uses slug',
  (select href from latest_feed where kind = 'report'), '/reports/tps-pay-2026');
select pg_temp.eq('records href',   (select href from latest_feed where kind = 'records_request'), '/records');
select pg_temp.eq('vote subtitle is the body',
  (select subtitle from latest_feed where kind = 'vote'), 'TPS Board');
select pg_temp.eq('no null hrefs', (select count(*) from latest_feed where href is null), 0::bigint);

-- 23514 check_violation, 23502 not_null_violation.
select pg_temp.rejects('201 character vote summary',
  $q$insert into votes (body_id, meeting_date, item_title, summary)
     select id, '2026-09-09', 'x', repeat('a', 201) from bodies limit 1$q$, '23514');
select pg_temp.rejects('salary row with no source_url',
  $q$insert into salary_schedule (school_year, district, lane, step, salary, source_url)
     values ('2025-2026', 'TPS', 'BA', 1, 45000, null)$q$, '23502');
select pg_temp.rejects('vacancy with no source_url',
  $q$insert into vacancies (as_of_date, position, source_url)
     values ('2026-09-01', 'Math Teacher', null)$q$, '23502');
select pg_temp.rejects('budget row with no source_url',
  $q$insert into budget_categories (fiscal_year, category, amount, source_url)
     values ('2026', 'Instruction', 1, null)$q$, '23502');
select pg_temp.rejects('cpi row with no source_url',
  $q$insert into cpi (year, index_value, source_url) values (2011, 1.0, null)$q$, '23502');
select pg_temp.rejects('denied request with no reason',
  $q$insert into records_requests (agency_id, request_text, status)
     select id, 'x', 'denied' from agencies limit 1$q$, '23514');
select pg_temp.rejects('duplicate salary step',
  $q$insert into salary_schedule (school_year, district, lane, step, salary, source_url) values
     ('2025-2026', 'TPS', 'BA', 1, 1, 'https://example.com/source.pdf'),
     ('2025-2026', 'TPS', 'BA', 1, 2, 'https://example.com/source.pdf')$q$, '23505');

\echo 'ALL SCHEMA ASSERTIONS PASSED'
