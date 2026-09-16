-- The Mona K Project: initial schema.
-- Every published number links to a public document, so source_url columns are NOT NULL
-- on the three Explorer data tables and on cpi.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type records_request_status as enum ('filed', 'partial', 'fulfilled', 'denied');
create type document_owner_type    as enum ('records_request', 'report', 'listening', 'template');
create type person_role            as enum ('staff', 'board', 'advisory', 'body_member');
create type vote_choice            as enum ('yes', 'no', 'abstain', 'absent');
create type vote_category          as enum ('money', 'staffing', 'contracts', 'facilities', 'other');
create type report_type            as enum ('pay_report', 'levy_explainer', 'contract_tracker');
create type publish_status         as enum ('draft', 'published');
create type listening_audience     as enum ('teachers', 'parents');
create type inquiry_kind           as enum ('contact', 'council', 'volunteer', 'briefing');

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------

-- Business days between two dates, counting Monday through Friday only.
-- The start date is exclusive and the end date is inclusive, so a request filed
-- Monday and answered Tuesday took 1 business day. Returns null when either
-- date is null, which is how an open request renders as "no response yet".
create or replace function public.business_days_between(start_date date, end_date date)
returns integer
language sql
immutable
set search_path = public
as $$
  select case
    when start_date is null or end_date is null then null
    when end_date < start_date then 0
    else (
      select count(*)::integer
      from generate_series(start_date + 1, end_date, interval '1 day') as d
      where extract(isodow from d) < 6
    )
  end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.admins (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique,
  name       text,
  created_at timestamptz not null default now()
);

-- is_public marks which settings the anonymous site may read. Operational keys
-- such as records officer emails stay private.
create table public.site_settings (
  key        text primary key,
  value      text,
  is_public  boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.agencies (
  id                     uuid primary key default gen_random_uuid(),
  name                   text not null,
  records_officer_email  text,
  records_officer_name   text,
  website                text,
  created_at             timestamptz not null default now()
);

create table public.records_requests (
  id            uuid primary key default gen_random_uuid(),
  agency_id     uuid not null references public.agencies (id) on delete restrict,
  request_text  text not null,
  date_filed    date not null default current_date,
  status        records_request_status not null default 'filed',
  date_responded date,
  denial_reason text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint records_requests_denial_reason_required
    check (status <> 'denied' or denial_reason is not null)
);

create table public.documents (
  id           uuid primary key default gen_random_uuid(),
  owner_type   document_owner_type not null,
  owner_id     uuid,
  storage_path text not null,
  file_name    text not null,
  file_size    bigint,
  page_count   integer,
  created_at   timestamptz not null default now()
);

create table public.bodies (
  id   uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique
);

create table public.people (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  title      text,
  role       person_role not null,
  body_id    uuid references public.bodies (id) on delete set null,
  term_start date,
  term_end   date,
  active     boolean not null default true,
  bio        text,
  photo_path text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.votes (
  id            uuid primary key default gen_random_uuid(),
  body_id       uuid not null references public.bodies (id) on delete restrict,
  meeting_date  date not null,
  item_title    text not null,
  summary       text not null check (length(summary) <= 200),
  category      vote_category not null default 'other',
  amount        numeric(14,2),
  agenda_url    text,
  minutes_url   text,
  yes_count     integer not null default 0,
  no_count      integer not null default 0,
  abstain_count integer not null default 0,
  absent_count  integer not null default 0,
  created_at    timestamptz not null default now()
);

create table public.vote_members (
  vote_id   uuid not null references public.votes (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete restrict,
  vote      vote_choice not null,
  primary key (vote_id, person_id)
);

create table public.reports (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  title         text not null,
  type          report_type not null,
  report_date   date not null,
  summary       text,
  status        publish_status not null default 'draft',
  preview_token uuid not null default gen_random_uuid(),
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.report_sources (
  id         uuid primary key default gen_random_uuid(),
  report_id  uuid not null references public.reports (id) on delete cascade,
  label      text not null,
  url        text not null,
  sort_order integer not null default 0
);

create table public.listening_sessions (
  id             uuid primary key default gen_random_uuid(),
  session_date   date not null,
  audience       listening_audience not null,
  attendee_count integer,
  summary        text,
  status         publish_status not null default 'draft',
  published_at   timestamptz,
  created_at     timestamptz not null default now()
);

create table public.listening_points (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.listening_sessions (id) on delete cascade,
  kind       text not null check (kind in ('heard', 'changes')),
  text       text not null,
  sort_order integer not null default 0
);

create table public.salary_schedule (
  id          uuid primary key default gen_random_uuid(),
  school_year text not null,
  district    text not null,
  lane        text not null,
  step        integer not null,
  salary      numeric(12,2) not null,
  source_url  text not null,
  unique (school_year, district, lane, step)
);

create table public.vacancies (
  id          uuid primary key default gen_random_uuid(),
  as_of_date  date not null,
  position    text not null,
  building    text,
  posted_date date,
  filled_date date,
  source_url  text not null
);

create table public.budget_categories (
  id          uuid primary key default gen_random_uuid(),
  fiscal_year text not null,
  category    text not null,
  amount      numeric(16,2) not null,
  source_url  text not null,
  unique (fiscal_year, category)
);

create table public.cpi (
  year        integer primary key,
  index_value numeric(10,3) not null,
  source_url  text not null
);

create table public.corrections (
  id              uuid primary key default gen_random_uuid(),
  correction_date date not null default current_date,
  page_path       text not null,
  what_changed    text not null,
  why             text not null,
  created_at      timestamptz not null default now()
);

create table public.inquiries (
  id         uuid primary key default gen_random_uuid(),
  kind       inquiry_kind not null,
  name       text not null,
  email      text not null,
  audience   text,
  message    text,
  created_at timestamptz not null default now()
);

create table public.subscribers (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique,
  confirmed  boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Triggers and indexes
-- ---------------------------------------------------------------------------

create trigger records_requests_set_updated_at
  before update on public.records_requests
  for each row execute function public.set_updated_at();

create trigger reports_set_updated_at
  before update on public.reports
  for each row execute function public.set_updated_at();

create index on public.records_requests (date_filed desc);
create index on public.records_requests (agency_id);
create index on public.documents (owner_type, owner_id);
create index on public.people (role, sort_order);
create index on public.people (body_id) where active;
create index on public.votes (meeting_date desc);
create index on public.votes (body_id);
create index on public.votes (category);
create index on public.vote_members (person_id);
create index on public.reports (status, report_date desc);
create index on public.reports (preview_token);
create index on public.report_sources (report_id, sort_order);
create index on public.listening_sessions (status, session_date desc);
create index on public.listening_points (session_id, kind, sort_order);
create index on public.salary_schedule (school_year, district, lane, step);
create index on public.budget_categories (fiscal_year);
create index on public.vacancies (as_of_date desc);
create index on public.corrections (correction_date desc);

-- ---------------------------------------------------------------------------
-- latest_feed view
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
    v.meeting_date,
    '/votes'
  from public.votes v
  join public.bodies b on b.id = v.body_id

  union all

  select
    'listening'::text,
    'Listening session: ' || initcap(ls.audience::text),
    to_char(ls.session_date, 'FMMonth FMDD, YYYY'),
    ls.session_date,
    '/listening'
  from public.listening_sessions ls
  where ls.status = 'published';

-- True when the caller is signed in and their email is listed in admins.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admins a
    where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.admins             enable row level security;
alter table public.site_settings      enable row level security;
alter table public.agencies           enable row level security;
alter table public.records_requests   enable row level security;
alter table public.documents          enable row level security;
alter table public.bodies             enable row level security;
alter table public.people             enable row level security;
alter table public.votes              enable row level security;
alter table public.vote_members       enable row level security;
alter table public.reports            enable row level security;
alter table public.report_sources     enable row level security;
alter table public.listening_sessions enable row level security;
alter table public.listening_points   enable row level security;
alter table public.salary_schedule    enable row level security;
alter table public.vacancies          enable row level security;
alter table public.budget_categories  enable row level security;
alter table public.cpi                enable row level security;
alter table public.corrections        enable row level security;
alter table public.inquiries          enable row level security;
alter table public.subscribers        enable row level security;

-- Public read on the tables that back public pages.
create policy "public read" on public.agencies           for select using (true);
create policy "public read" on public.records_requests   for select using (true);
create policy "public read" on public.documents          for select using (true);
create policy "public read" on public.bodies             for select using (true);
create policy "public read" on public.people             for select using (true);
create policy "public read" on public.votes              for select using (true);
create policy "public read" on public.vote_members       for select using (true);
create policy "public read" on public.report_sources     for select using (true);
create policy "public read" on public.listening_points   for select using (true);
create policy "public read" on public.salary_schedule    for select using (true);
create policy "public read" on public.vacancies          for select using (true);
create policy "public read" on public.budget_categories  for select using (true);
create policy "public read" on public.cpi                for select using (true);
create policy "public read" on public.corrections        for select using (true);

-- Reports and listening sessions are readable only once published. Drafts and
-- preview tokens are served through the service role, never the anon key.
create policy "public read published" on public.reports
  for select using (status = 'published');
create policy "public read published" on public.listening_sessions
  for select using (status = 'published');

-- site_settings exposes only the keys marked public.
create policy "public read public keys" on public.site_settings
  for select using (is_public);

-- admins, inquiries and subscribers are never publicly readable.
create policy "admin read" on public.admins       for select using (public.is_admin());
create policy "admin read" on public.inquiries    for select using (public.is_admin());
create policy "admin read" on public.subscribers  for select using (public.is_admin());

-- Anyone may submit a contact form or subscribe. Neither can be read back.
create policy "anon insert" on public.inquiries   for insert with check (true);
create policy "anon insert" on public.subscribers for insert with check (true);

-- Full write access for signed in admins.
do $$
declare
  t text;
begin
  foreach t in array array[
    'admins', 'site_settings', 'agencies', 'records_requests', 'documents',
    'bodies', 'people', 'votes', 'vote_members', 'reports', 'report_sources',
    'listening_sessions', 'listening_points', 'salary_schedule', 'vacancies',
    'budget_categories', 'cpi', 'corrections', 'inquiries', 'subscribers'
  ]
  loop
    execute format(
      'create policy "admin all" on public.%I for all to authenticated
         using (public.is_admin()) with check (public.is_admin())', t
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
-- RLS is the real gate, but the table grants are set here too so the migration
-- does not depend on a project's default privileges.

grant usage on schema public to anon, authenticated;

grant select on all tables in schema public to anon, authenticated;

-- Defense in depth: anon has no reason to hold select on these three at all.
revoke select on public.admins, public.inquiries, public.subscribers from anon;

-- The contact form and the subscribe field are the only anonymous writes.
grant insert on public.inquiries, public.subscribers to anon;

grant insert, update, delete on all tables in schema public to authenticated;

-- ---------------------------------------------------------------------------
-- Seeds
-- ---------------------------------------------------------------------------

insert into public.bodies (name, slug) values
  ('TPS Board',                 'tps-board'),
  ('Toledo City Council',       'toledo-city-council'),
  ('Lucas County Commissioners','lucas-county-commissioners');

insert into public.agencies (name, website) values
  ('Toledo Public Schools', null),
  ('City of Toledo',        null),
  ('Lucas County',          null);

-- Every [BRACKET] placeholder in mona-k-project-site-copy.md, plus the values
-- the build brief names. Values stay empty until they are filled in from
-- /admin/settings, where an empty value renders as the bracket placeholder.
--
-- Records officer addresses are deliberately not here. The copy doc publishes
-- them on the Records Desk page and the schema already holds them on
-- agencies.records_officer_email, which is public read.
insert into public.site_settings (key, value, is_public) values
  -- Global and footer
  ('org_ein',                 '', true),   -- [XX-XXXXXXX]
  ('mailing_address',         '', true),   -- [Mailing address]
  ('contact_email',           'hello@monakproject.org', true),
  ('social_facebook',         '', true),
  ('social_instagram',        '', true),
  ('social_linkedin',         '', true),
  ('social_x',                '', true),
  -- Explorer
  ('explorer_url',            '', true),
  ('explorer_data_asof',      '', true),   -- [MONTH YEAR]
  ('explorer_sources_list',   '', true),   -- [list]
  ('scenario_a_pct',          '3',    true),
  ('scenario_b_flat',         '2000', true),
  -- Reports
  ('reports_next_report_note','', true),   -- [Coming November 2026]
  ('levy_status_note',        '', true),   -- [No levy currently on the ballot.]
  ('contract_status_note',    '', true),   -- [Talks are not currently open.]
  -- Records Desk
  ('request_template_path',   '', true),
  -- About and Get Involved
  ('partners_note',           '', true),   -- [Other partners as confirmed]
  ('form_990_url',            '', true),   -- [Link: Form 990 / financials]
  ('donate_url',              '', true),
  ('donate_amounts',          '25,50,100', true),
  -- Operational. Never read by the public site, so is_public is false.
  ('resend_audience_id',      '', false);

-- A single note row. Real CPI values are entered from /admin/explorer.
insert into public.cpi (year, index_value, source_url) values
  (2010, 1.000, 'https://example.com/source.pdf');
