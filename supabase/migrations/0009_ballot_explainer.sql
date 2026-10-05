-- 0009_ballot_explainer
-- Add the 'ballot_explainer' report type for ballot issues that are not
-- school levies: library levies, income taxes, charter amendments,
-- statewide issues, and anything else that appears on a Toledo ballot.
--
-- Why convert instead of ALTER TYPE ... ADD VALUE:
-- Postgres forbids ALTER TYPE ... ADD VALUE inside a transaction block,
-- which is how `supabase db push` applies migrations. Converting the
-- column to text with a CHECK constraint keeps this migration
-- transaction-safe and makes future type additions one-line changes.

-- latest_feed reads reports.type to build its subtitle, and Postgres refuses to
-- change the type of a column a view depends on. The view is dropped here and
-- rebuilt at the end of this file exactly as 0006 left it. Without this the
-- whole migration chain stops dead on a fresh database, which is how it was
-- found: scripts/local-supabase.sh could not build one at all.
drop view if exists public.latest_feed;

alter table public.reports alter column type drop default;

alter table public.reports alter column type type text using type::text;

drop type public.report_type;

alter table public.reports
  add constraint reports_type_check
  check (type in (
    'pay_report',
    'levy_explainer',
    'contract_tracker',
    'ballot_explainer'
  ));

-- Rebuilt as 0006 left it. A later migration replaces it again to add the
-- body slug; this one only has to put back what it took away.
create view public.latest_feed
with (security_invoker = true)
as
  select
    'report'::text                          as kind,
    r.title                                 as title,
    replace(initcap(replace(r.type::text, '_', ' ')), ' ', ' ') as subtitle,
    r.report_date                           as date,
    '/reports/' || r.slug                   as href
  from public.reports r
  where r.status = 'published'

  union all

  select
    'records_request'::text,
    rr.request_text,
    a.name,
    rr.date_filed,
    '/records'
  from public.records_requests rr
  join public.agencies a on a.id = rr.agency_id

  union all

  select
    'vote'::text,
    v.item_title,
    b.name,
    m.meeting_date,
    '/votes'
  from public.votes v
  join public.meetings m on m.id = v.meeting_id
  join public.bodies b on b.id = m.body_id
  where v.status = 'published' and not v.ai_draft

  union all

  select
    'listening'::text,
    'Listening session: ' || initcap(ls.audience::text),
    to_char(ls.session_date, 'FMMonth FMDD, YYYY'),
    ls.session_date,
    '/listening'
  from public.listening_sessions ls
  where ls.status = 'published';

grant select on public.latest_feed to anon, authenticated;
