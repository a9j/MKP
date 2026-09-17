-- Meetings become a table of their own, votes gain a draft state and a review
-- trail, and the tables the scheduled jobs will write to are created ahead of
-- the jobs themselves.
--
-- Nothing in this migration runs any automation. It puts the shape in place so
-- that when the collectors are switched on they have somewhere to write, and
-- so that the one rule that matters is enforced by the database from the start:
-- software may collect and draft, only a person may publish.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type meeting_kind      as enum ('regular', 'special');
create type meeting_discovery as enum ('watcher', 'admin');
create type job_status        as enum ('ok', 'error', 'skipped');

-- Attachments collected from an agenda listing hang off the meeting.
alter type document_owner_type add value if not exists 'meeting';

-- ---------------------------------------------------------------------------
-- Meetings
-- ---------------------------------------------------------------------------

create table public.meetings (
  id            uuid primary key default gen_random_uuid(),
  body_id       uuid not null references public.bodies (id) on delete restrict,
  meeting_date  date not null,
  kind          meeting_kind not null default 'regular',
  agenda_url    text,
  minutes_url   text,
  video_url     text,
  discovered_by meeting_discovery not null default 'admin',
  created_at    timestamptz not null default now()
);

-- The agenda watcher reruns daily and must not create a second row for a
-- meeting it already has. One body holds at most one meeting of a given kind
-- on a given day.
create unique index meetings_body_date_kind_key
  on public.meetings (body_id, meeting_date, kind);
create index on public.meetings (meeting_date desc);

-- The feed reads votes.body_id and votes.meeting_date, both of which are about
-- to move to the meeting. It is rebuilt at the end of this file.
drop view if exists public.latest_feed;
drop view if exists public.member_vote_tallies;

-- ---------------------------------------------------------------------------
-- Votes hang off a meeting, carry a status, and record who reviewed them
-- ---------------------------------------------------------------------------

alter table public.votes add column meeting_id uuid references public.meetings (id) on delete cascade;

-- Every vote already recorded belongs to a meeting that was never written down
-- as such. Build those meetings from the votes themselves, then point the votes
-- at them. Agenda and minutes links were held per vote; at the meeting level
-- they are the same link, so one is kept.
insert into public.meetings (body_id, meeting_date, kind, agenda_url, minutes_url, discovered_by)
select v.body_id, v.meeting_date, 'regular', max(v.agenda_url), max(v.minutes_url), 'admin'
from public.votes v
group by v.body_id, v.meeting_date;

update public.votes v
set meeting_id = m.id
from public.meetings m
where m.body_id = v.body_id and m.meeting_date = v.meeting_date and m.kind = 'regular';

alter table public.votes alter column meeting_id set not null;

-- The vote keeps a link to its own agenda item. The meeting keeps the links to
-- the agenda and the minutes as a whole.
alter table public.votes rename column agenda_url to agenda_item_url;
alter table public.votes drop column minutes_url;
alter table public.votes drop column body_id;
alter table public.votes drop column meeting_date;

-- The tally is counted from the roll call rather than stored beside it. A
-- stored count can drift from the members it claims to summarise, and the
-- roll call extractor will write members without touching a count.
alter table public.votes
  drop column yes_count,
  drop column no_count,
  drop column abstain_count,
  drop column absent_count;

alter table public.votes
  add column status        publish_status not null default 'draft',
  add column ai_draft      boolean not null default false,
  add column ai_model      text,
  add column ai_confidence numeric(3,2) check (ai_confidence is null or (ai_confidence >= 0 and ai_confidence <= 1)),
  add column reviewed_by   uuid references public.admins (id) on delete set null,
  add column reviewed_at   timestamptz,
  add column published_at  timestamptz,
  add column updated_at    timestamptz not null default now();

-- Everything recorded before this migration was published by hand.
update public.votes set status = 'published', published_at = created_at;

-- A draft is a draft: it cannot carry a publication date, and a published vote
-- must have one. This is what keeps "published" from being a label a writer can
-- set without the row actually being complete.
alter table public.votes add constraint votes_published_has_date check (
  (status = 'draft'     and published_at is null) or
  (status = 'published' and published_at is not null)
);

-- An AI draft is by definition unreviewed, so it cannot also be published.
alter table public.votes add constraint votes_ai_draft_is_unpublished check (
  not (ai_draft and status = 'published')
);

create index on public.votes (meeting_id);
create index on public.votes (status, published_at desc);
create index on public.votes (ai_draft) where ai_draft;

create trigger votes_set_updated_at
  before update on public.votes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Tables the scheduled jobs write to
-- ---------------------------------------------------------------------------

-- One row per monthly posting snapshot. The stored PDF is the source_url every
-- vacancy row points at, which is why the snapshot is kept rather than just the
-- diff it produced.
create table public.vacancy_snapshots (
  id           uuid primary key default gen_random_uuid(),
  as_of_date   date not null,
  storage_path text not null,
  row_count    integer not null default 0,
  created_at   timestamptz not null default now()
);
create unique index on public.vacancy_snapshots (as_of_date);

-- Every scheduled run writes a row here whether it succeeded or not, so a
-- watcher that quietly stopped working is visible rather than merely silent.
create table public.jobs (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  status      job_status not null default 'ok',
  detail      jsonb not null default '{}'::jsonb
);
create index on public.jobs (name, started_at desc);

-- The audit trail for anything a model wrote. Kept so that a published number
-- can always be traced back to the document and the prompt that produced the
-- draft a person then checked.
create table public.ai_runs (
  id             uuid primary key default gen_random_uuid(),
  kind           text not null,
  target_table   text,
  target_id      uuid,
  model          text not null,
  prompt_version text not null,
  input_hash     text not null,
  raw_response   jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);
create index on public.ai_runs (target_table, target_id);
create index on public.ai_runs (created_at desc);

-- ---------------------------------------------------------------------------
-- Software collects and drafts. A person publishes.
-- ---------------------------------------------------------------------------
--
-- The brief asks for a policy forbidding the service role from writing a
-- published row. A policy cannot do it: the Supabase service role holds
-- BYPASSRLS, so policies are not consulted for it at all. A trigger is
-- consulted for every writer, which is what this needs to be.
--
-- The rule is the same either way: a row reaches status 'published' only from
-- a signed in admin session. Cron routes and model calls use the service role
-- and are refused here, in the database, not merely in the code that calls it.
create or replace function public.forbid_automation_publish()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'published'
     and (current_user = 'service_role' or current_setting('role', true) = 'service_role')
  then
    raise exception
      'automation may not publish. %.% must be published by a signed in admin.',
      tg_table_schema, tg_table_name
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger votes_forbid_automation_publish
  before insert or update on public.votes
  for each row execute function public.forbid_automation_publish();

create trigger reports_forbid_automation_publish
  before insert or update on public.reports
  for each row execute function public.forbid_automation_publish();

create trigger listening_sessions_forbid_automation_publish
  before insert or update on public.listening_sessions
  for each row execute function public.forbid_automation_publish();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.meetings          enable row level security;
alter table public.vacancy_snapshots enable row level security;
alter table public.jobs              enable row level security;
alter table public.ai_runs           enable row level security;

-- A meeting is a public fact and the snapshot PDF is a published source.
create policy "public read" on public.meetings          for select using (true);
create policy "public read" on public.vacancy_snapshots for select using (true);

-- Job runs and model responses are operational. They are not part of what the
-- organization publishes, and a raw model response is not a document anyone
-- has checked, so neither is readable without signing in.
create policy "admin read" on public.jobs    for select using (public.is_admin());
create policy "admin read" on public.ai_runs for select using (public.is_admin());

do $$
declare
  t text;
begin
  foreach t in array array['meetings', 'vacancy_snapshots', 'jobs', 'ai_runs']
  loop
    execute format(
      'create policy "admin all" on public.%I for all to authenticated
         using (public.is_admin()) with check (public.is_admin())', t
    );
  end loop;
end;
$$;

-- A draft vote, and an AI draft above all, must not be reachable with the
-- anonymous key. Reports and listening sessions already work this way.
drop policy "public read" on public.votes;
create policy "public read published" on public.votes
  for select using (status = 'published' and not ai_draft);

-- The roll call follows the vote it belongs to. Without this, the members of an
-- unpublished vote would be readable even though the vote itself is not.
drop policy "public read" on public.vote_members;
create policy "public read published" on public.vote_members
  for select using (
    exists (
      select 1 from public.votes v
      where v.id = vote_members.vote_id
        and v.status = 'published'
        and not v.ai_draft
    )
  );

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant select on public.meetings, public.vacancy_snapshots to anon, authenticated;
grant select on public.jobs, public.ai_runs to authenticated;
grant insert, update, delete on
  public.meetings, public.vacancy_snapshots, public.jobs, public.ai_runs
  to authenticated;
grant all privileges on
  public.meetings, public.vacancy_snapshots, public.jobs, public.ai_runs
  to service_role;

-- ---------------------------------------------------------------------------
-- Views rebuilt on the new shape
-- ---------------------------------------------------------------------------

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

-- Voting record by member. Counts only published votes: a draft roll call is
-- not a voting record, and an AI draft has not been checked against anything.
create view public.member_vote_tallies
with (security_invoker = true)
as
  select
    p.id            as person_id,
    p.name,
    p.title,
    b.name          as body_name,
    b.slug          as body_slug,
    p.term_start,
    p.term_end,
    p.active,
    p.sort_order,
    count(vm.vote)                                             as votes_cast,
    count(*) filter (where vm.vote = 'yes')                     as yes_count,
    count(*) filter (where vm.vote = 'no')                      as no_count,
    count(*) filter (where vm.vote = 'abstain')                 as abstain_count,
    count(*) filter (where vm.vote = 'absent')                  as absent_count
  from public.people p
  left join public.bodies b on b.id = p.body_id
  left join public.vote_members vm
    on vm.person_id = p.id
   and exists (
     select 1 from public.votes v
     where v.id = vm.vote_id and v.status = 'published' and not v.ai_draft
   )
  where p.role = 'body_member'
  group by p.id, p.name, p.title, b.name, b.slug, p.term_start, p.term_end, p.active, p.sort_order;

grant select on public.latest_feed to anon, authenticated;
grant select on public.member_vote_tallies to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------

-- Rendered on the About page. Editable from /admin/settings like every other
-- public string, but it ships with the sentence the brief specifies so the
-- disclosure is never missing by default.
insert into public.site_settings (key, value, is_public) values
  ('ai_disclosure',
   'We use software to collect documents and draft summaries. A person reads every document and approves every number before it publishes.',
   true)
on conflict (key) do nothing;
