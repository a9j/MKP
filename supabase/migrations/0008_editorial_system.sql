-- 0008_editorial_system
-- MKP Phase One: claim-level sourcing, explainers, the four-label rule,
-- versioned publishing, coverage rules, the admin inbox, and the audit trail.
--
-- Builds on what 0001 to 0007 already created. Reuses:
--   public.is_admin()                  admin check by JWT email
--   public.set_updated_at()            updated_at trigger
--   public.forbid_automation_publish() service_role can never publish
--   public.publish_status              draft | published
--   public.ai_runs                     raw AI output, kept apart from what is published
--
-- The three layers never mix:
--   1. documents (+ document_pages)   the original. Immutable once hashed.
--   2. ai_runs                        what the AI extracted. Never shown to the public.
--   3. explainer_versions             what a human approved. The only thing the public reads.

-- ---------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------

create type public.claim_label as enum ('fact', 'estimate', 'argument', 'unknown');

create type public.explainer_kind as enum (
  'board_item', 'contract', 'levy', 'ordinance', 'legislation', 'ballot_issue', 'other'
);

create type public.explainer_section as enum (
  'exists_today', 'what_changes', 'who_affected', 'cost',
  'supporters_say', 'opponents_say', 'uncertain', 'what_next'
);

create type public.editorial_stage as enum (
  'captured', 'ai_draft', 'citation_check', 'in_review', 'approved'
);

create type public.capture_method as enum (
  'upload', 'url', 'paste', 'records_request', 'watcher'
);

create type public.source_kind as enum (
  'bill_text', 'fiscal_note', 'agenda', 'meeting_packet', 'minutes', 'contract',
  'public_record', 'ballot_language', 'vote_record', 'budget', 'salary_schedule',
  'report', 'other'
);

create type public.coverage_decision as enum ('pending', 'cover', 'skip');

-- ---------------------------------------------------------------------------
-- 2. documents: turn the existing table into the immutable source layer
-- ---------------------------------------------------------------------------

alter table public.documents
  add column title           text,
  add column source_kind     public.source_kind    not null default 'other',
  add column capture_method  public.capture_method not null default 'upload',
  add column source_url      text,
  add column agency_id       uuid references public.agencies(id),
  add column body_id         uuid references public.bodies(id),
  add column meeting_id      uuid references public.meetings(id),
  add column mime_type       text,
  add column sha256          text check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  add column retrieved_at    timestamptz not null default now(),
  add column document_date   date,
  add column is_publishable  boolean not null default true,
  add column withheld_reason text,
  add column supersedes_id   uuid references public.documents(id),
  add column captured_by     uuid references public.admins(id),
  add constraint documents_withheld_needs_reason
    check (is_publishable or length(btrim(coalesce(withheld_reason, ''))) > 0);

comment on column public.documents.sha256 is
  'SHA-256 of the stored file. Once set, the file, hash, URL and retrieved_at can never change. A new version of a document is a new row with supersedes_id pointing at the old one.';
comment on column public.documents.is_publishable is
  'False when the file cannot legally be published. Those files live in the documents-private bucket. The public still sees the title and withheld_reason.';

create unique index documents_sha256_key on public.documents (sha256) where sha256 is not null;
create index documents_meeting_id_idx   on public.documents (meeting_id);
create index documents_supersedes_idx   on public.documents (supersedes_id);

create or replace function public.protect_document_original()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if old.sha256 is not null and (
       new.sha256       is distinct from old.sha256
    or new.storage_path is distinct from old.storage_path
    or new.source_url   is distinct from old.source_url
    or new.retrieved_at is distinct from old.retrieved_at
  ) then
    raise exception
      'documents % is an original and cannot be overwritten. Capture a new document and set supersedes_id.', old.id
      using errcode = 'integrity_constraint_violation';
  end if;
  return new;
end;
$$;

create trigger documents_protect_original
  before update on public.documents
  for each row execute function public.protect_document_original();

-- Public sees only publishable files. Withheld files stay admin only.
drop policy if exists "public read" on public.documents;
create policy "public read publishable" on public.documents
  for select to public using (is_publishable);

-- Page text, so a citation can point at a page and search can reach inside PDFs.
create table public.document_pages (
  document_id uuid    not null references public.documents(id) on delete cascade,
  page_number integer not null check (page_number >= 1),
  text        text    not null,
  search      tsvector generated always as (to_tsvector('english', text)) stored,
  primary key (document_id, page_number)
);
create index document_pages_search_idx on public.document_pages using gin (search);

-- ---------------------------------------------------------------------------
-- 3. explainers: the working draft. The public never reads this table's prose.
-- ---------------------------------------------------------------------------

create table public.explainers (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  kind              public.explainer_kind not null,
  title             text not null check (length(btrim(title)) > 0),
  identifier        text,
  body_id           uuid references public.bodies(id),
  meeting_id        uuid references public.meetings(id),
  vote_id           uuid references public.votes(id) on delete set null,
  decision_date     date,
  decision_label    text,
  process_steps     text[] not null default '{}',
  current_step      integer check (current_step is null or current_step >= 1),
  one_sentence      text check (one_sentence is null or length(one_sentence) <= 280),
  summary_30s       text check (summary_30s is null or length(summary_30s) <= 900),
  reading_grade     numeric check (reading_grade is null or reading_grade >= 0),
  stage             public.editorial_stage not null default 'captured',
  status            public.publish_status  not null default 'draft',
  version           integer not null default 0,
  ai_draft          boolean not null default false,
  reviewed_by       uuid references public.admins(id),
  reviewed_at       timestamptz,
  published_at      timestamptz,
  last_published_at timestamptz,
  created_by        uuid references public.admins(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on column public.explainers.identifier     is 'Official number as printed on the source, for example a resolution or ordinance number.';
comment on column public.explainers.decision_label is 'Who decides and how, for example "TPS Board vote". Shown in the Upcoming Vote block.';
comment on column public.explainers.process_steps  is 'Ordered steps for the What Happens Next tracker. current_step is the 1-based position.';
comment on column public.explainers.reading_grade  is 'Flesch-Kincaid grade of one_sentence + summary_30s + all claim text. Computed by the app on save.';
comment on column public.explainers.vote_id        is 'Set after the meeting. This is how an explainer hands off to Vote Watch.';

create index explainers_decision_date_idx on public.explainers (decision_date);
create index explainers_body_id_idx       on public.explainers (body_id);
create index explainers_status_idx        on public.explainers (status);

-- ---------------------------------------------------------------------------
-- 4. claims and citations: the four-label rule and claim-level sourcing
-- ---------------------------------------------------------------------------

create table public.claims (
  id            uuid primary key default gen_random_uuid(),
  explainer_id  uuid references public.explainers(id) on delete cascade,
  report_id     uuid references public.reports(id)    on delete cascade,
  vote_id       uuid references public.votes(id)      on delete cascade,
  section       public.explainer_section,
  label         public.claim_label not null,
  text          text not null check (length(btrim(text)) > 0),
  attributed_to text,
  sort_order    integer not null default 0,
  ai_generated  boolean not null default false,
  ai_run_id     uuid references public.ai_runs(id) on delete set null,
  verified_by   uuid references public.admins(id),
  verified_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint claims_one_owner
    check (num_nonnulls(explainer_id, report_id, vote_id) = 1),
  constraint claims_explainer_needs_section
    check (explainer_id is null or section is not null),
  constraint claims_argument_needs_attribution
    check (label <> 'argument' or length(btrim(coalesce(attributed_to, ''))) > 0),
  constraint claims_say_sections_are_arguments
    check (section not in ('supporters_say', 'opponents_say') or label = 'argument'),
  constraint claims_verified_pair
    check ((verified_at is null) = (verified_by is null))
);

comment on table public.claims is
  'One checkable statement. FACT and ESTIMATE need a citation. ARGUMENT needs a named source in attributed_to. UNKNOWN says what the record does not establish.';

create index claims_explainer_idx on public.claims (explainer_id, section, sort_order);
create index claims_report_idx    on public.claims (report_id, sort_order);
create index claims_vote_idx      on public.claims (vote_id, sort_order);

create table public.citations (
  id          uuid primary key default gen_random_uuid(),
  claim_id    uuid not null references public.claims(id) on delete cascade,
  document_id uuid references public.documents(id) on delete restrict,
  source_url  text,
  page_number integer check (page_number is null or page_number >= 1),
  locator     text,
  quote       text check (quote is null or length(quote) <= 600),
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  constraint citations_has_source
    check (document_id is not null or length(btrim(coalesce(source_url, ''))) > 0)
);

comment on column public.citations.locator is 'Where on the page, for example "Section 3" or "Line 14".';
comment on column public.citations.quote   is 'The exact words from the source that support the claim. Shown in the receipt drawer.';

create index citations_claim_idx    on public.citations (claim_id, sort_order);
create index citations_document_idx on public.citations (document_id);

-- Editing a verified claim, or touching its citations, sends it back for review.
-- Only a signed in admin can verify. Automation never can.
create or replace function public.claims_guard_verification()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if tg_op = 'UPDATE'
     and new.verified_at is not distinct from old.verified_at
     and (   new.text          is distinct from old.text
          or new.label         is distinct from old.label
          or new.section       is distinct from old.section
          or new.attributed_to is distinct from old.attributed_to)
  then
    new.verified_at := null;
    new.verified_by := null;
  end if;

  if new.verified_at is not null
     and (tg_op = 'INSERT' or new.verified_at is distinct from old.verified_at)
     and not public.is_admin()
  then
    raise exception 'Only a signed in admin may verify a claim.'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

create trigger claims_guard_verification
  before insert or update on public.claims
  for each row execute function public.claims_guard_verification();

create trigger claims_set_updated_at
  before update on public.claims
  for each row execute function public.set_updated_at();

create or replace function public.citations_unverify_claim()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  v_claim uuid;
begin
  if tg_op = 'DELETE' then
    v_claim := old.claim_id;
  else
    v_claim := new.claim_id;
  end if;

  update public.claims
     set verified_at = null, verified_by = null
   where id = v_claim and verified_at is not null;

  return null;
end;
$$;

create trigger citations_unverify_claim
  after insert or update or delete on public.citations
  for each row execute function public.citations_unverify_claim();

-- ---------------------------------------------------------------------------
-- 5. explainer_versions: the only explainer content the public reads
-- ---------------------------------------------------------------------------

create table public.explainer_versions (
  explainer_id uuid    not null references public.explainers(id) on delete cascade,
  version      integer not null check (version >= 1),
  snapshot     jsonb   not null,
  search_text  text    not null default '',
  change_note  text,
  published_by uuid references public.admins(id),
  published_at timestamptz not null default now(),
  search       tsvector generated always as (to_tsvector('english', search_text)) stored,
  primary key (explainer_id, version),
  constraint explainer_versions_update_needs_note
    check (version = 1 or length(btrim(coalesce(change_note, ''))) > 0)
);
create index explainer_versions_search_idx on public.explainer_versions using gin (search);

comment on table public.explainer_versions is
  'Frozen copy of an explainer at the moment a human published it. Version 2 and later must say what changed. Old versions stay readable.';

create or replace function public.forbid_update()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  raise exception '%.% rows are permanent and cannot be edited.', tg_table_schema, tg_table_name
    using errcode = 'integrity_constraint_violation';
end;
$$;

create trigger explainer_versions_forbid_update
  before update on public.explainer_versions
  for each row execute function public.forbid_update();

-- ---------------------------------------------------------------------------
-- 6. The MKP Standard, enforced by the database
-- ---------------------------------------------------------------------------

create or replace function public.explainer_problems(p_id uuid)
returns text[]
language sql
stable
set search_path to 'public'
as $$
  select coalesce(array_agg(problem order by ord, problem), '{}')
  from (
    select 1 as ord, 'Explainer not found.' as problem
     where not exists (select 1 from explainers e where e.id = p_id)

    union all
    select 2, 'Missing the one sentence summary.'
      from explainers e
     where e.id = p_id and length(btrim(coalesce(e.one_sentence, ''))) = 0

    union all
    select 3, 'Missing the 30-second version.'
      from explainers e
     where e.id = p_id and length(btrim(coalesce(e.summary_30s, ''))) = 0

    union all
    select 4, 'Reading grade is missing or above the limit of '
              || coalesce((select s.value from site_settings s where s.key = 'explainer_max_reading_grade'), '9') || '.'
      from explainers e
     where e.id = p_id
       and (e.reading_grade is null
            or e.reading_grade > coalesce(
                 (select s.value::numeric from site_settings s where s.key = 'explainer_max_reading_grade'), 9))

    union all
    select 5, 'Section has no claims: ' || req.section::text
      from unnest(array['exists_today', 'what_changes']::explainer_section[]) as req(section)
     where not exists (
             select 1 from claims c where c.explainer_id = p_id and c.section = req.section)

    union all
    select 6, 'No source document is cited anywhere in this explainer.'
     where not exists (
             select 1
               from claims c
               join citations ci on ci.claim_id = c.id
              where c.explainer_id = p_id and ci.document_id is not null)

    union all
    select 7, 'Not verified by a human: "' || left(c.text, 70) || '"'
      from claims c
     where c.explainer_id = p_id and c.verified_at is null

    union all
    select 8, upper(c.label::text) || ' has no citation: "' || left(c.text, 70) || '"'
      from claims c
     where c.explainer_id = p_id
       and c.label in ('fact', 'estimate')
       and not exists (select 1 from citations ci where ci.claim_id = c.id)
  ) p;
$$;

create or replace function public.build_explainer_snapshot(p_id uuid)
returns jsonb
language sql
stable
set search_path to 'public'
as $$
  select jsonb_build_object(
    'explainer', jsonb_build_object(
      'id', e.id,
      'slug', e.slug,
      'kind', e.kind,
      'title', e.title,
      'identifier', e.identifier,
      'body', (select jsonb_build_object('id', b.id, 'name', b.name, 'slug', b.slug)
                 from bodies b where b.id = e.body_id),
      'meeting_id', e.meeting_id,
      'vote_id', e.vote_id,
      'decision_date', e.decision_date,
      'decision_label', e.decision_label,
      'process_steps', to_jsonb(e.process_steps),
      'current_step', e.current_step,
      'one_sentence', e.one_sentence,
      'summary_30s', e.summary_30s,
      'reading_grade', e.reading_grade
    ),
    'claims', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'id', c.id,
                 'section', c.section,
                 'label', c.label,
                 'text', c.text,
                 'attributed_to', c.attributed_to,
                 'citations', coalesce((
                   select jsonb_agg(
                            jsonb_build_object(
                              'id', ci.id,
                              'page_number', ci.page_number,
                              'locator', ci.locator,
                              'quote', ci.quote,
                              'source_url', coalesce(ci.source_url, d.source_url),
                              'document', case when d.id is null then null else
                                jsonb_build_object(
                                  'id', d.id,
                                  'title', coalesce(d.title, d.file_name),
                                  'source_kind', d.source_kind,
                                  'document_date', d.document_date,
                                  'retrieved_at', d.retrieved_at,
                                  'sha256', d.sha256,
                                  'is_publishable', d.is_publishable,
                                  'withheld_reason', d.withheld_reason,
                                  'storage_path', case when d.is_publishable then d.storage_path end
                                ) end
                            )
                            order by ci.sort_order, ci.created_at)
                     from citations ci
                     left join documents d on d.id = ci.document_id
                    where ci.claim_id = c.id), '[]'::jsonb)
               )
               order by c.section, c.sort_order, c.created_at)
        from claims c
       where c.explainer_id = e.id), '[]'::jsonb)
  )
  from explainers e
  where e.id = p_id;
$$;

-- Status can only become 'published' through publish_explainer().
create or replace function public.explainers_guard_publish()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  v_via_rpc boolean := coalesce(current_setting('mkp.publishing', true), '') = 'on';
begin
  if tg_op = 'INSERT' then
    if new.status = 'published' or new.version <> 0 then
      raise exception 'New explainers start as drafts at version 0. Publish with publish_explainer().'
        using errcode = 'check_violation';
    end if;
    return new;
  end if;

  if not v_via_rpc and (
       (new.status = 'published' and old.status is distinct from new.status)
    or new.version is distinct from old.version
  ) then
    raise exception 'Publish with publish_explainer() so the MKP Standard checks run.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger explainers_guard_publish
  before insert or update on public.explainers
  for each row execute function public.explainers_guard_publish();

create trigger explainers_forbid_automation_publish
  before insert or update on public.explainers
  for each row execute function public.forbid_automation_publish();

create trigger explainers_set_updated_at
  before update on public.explainers
  for each row execute function public.set_updated_at();

create or replace function public.publish_explainer(p_id uuid, p_change_note text default null)
returns integer
language plpgsql
set search_path to 'public'
as $$
declare
  v_admin    uuid;
  v_row      explainers%rowtype;
  v_problems text[];
  v_version  integer;
  v_snapshot jsonb;
  v_search   text;
begin
  if not is_admin() then
    raise exception 'Only a signed in admin may publish.' using errcode = 'insufficient_privilege';
  end if;

  select a.id into v_admin
    from admins a
   where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''));

  select * into v_row from explainers where id = p_id for update;
  if not found then
    raise exception 'Explainer % not found.', p_id using errcode = 'no_data_found';
  end if;

  v_problems := explainer_problems(p_id);
  if cardinality(v_problems) > 0 then
    raise exception 'Cannot publish. %', array_to_string(v_problems, ' | ')
      using errcode = 'check_violation';
  end if;

  v_version := v_row.version + 1;
  if v_version > 1 and length(btrim(coalesce(p_change_note, ''))) = 0 then
    raise exception 'Version % needs a change note that tells readers what changed.', v_version
      using errcode = 'check_violation';
  end if;

  perform set_config('mkp.publishing', 'on', true);
  perform set_config('mkp.reason', coalesce(p_change_note, 'First publication'), true);

  update explainers
     set status            = 'published',
         stage             = 'approved',
         version           = v_version,
         ai_draft          = false,
         reviewed_by       = v_admin,
         reviewed_at       = now(),
         published_at      = coalesce(published_at, now()),
         last_published_at = now()
   where id = p_id;

  v_snapshot := build_explainer_snapshot(p_id);

  select concat_ws(' ',
           v_snapshot -> 'explainer' ->> 'title',
           v_snapshot -> 'explainer' ->> 'identifier',
           v_snapshot -> 'explainer' ->> 'one_sentence',
           v_snapshot -> 'explainer' ->> 'summary_30s',
           (select string_agg(c ->> 'text', ' ')
              from jsonb_array_elements(v_snapshot -> 'claims') as c))
    into v_search;

  insert into explainer_versions (explainer_id, version, snapshot, search_text, change_note, published_by)
  values (p_id, v_version, v_snapshot, coalesce(v_search, ''), nullif(btrim(p_change_note), ''), v_admin);

  perform set_config('mkp.publishing', 'off', true);
  perform set_config('mkp.reason', '', true);

  return v_version;
end;
$$;

comment on function public.publish_explainer(uuid, text) is
  'The only way to publish. Runs explainer_problems(), freezes a snapshot into explainer_versions, bumps the version. Call as the signed in admin, never with the service role key.';

-- Public read model. Title, summaries and claims come from the frozen snapshot,
-- so edits in progress on a published explainer are never visible.
create view public.explainers_public
with (security_invoker = true)
as
select
  e.id,
  e.slug,
  e.kind,
  e.body_id,
  e.meeting_id,
  e.vote_id,
  v.version,
  e.published_at                                       as first_published_at,
  v.published_at                                       as updated_at,
  v.change_note,
  v.snapshot -> 'explainer' ->> 'title'                as title,
  v.snapshot -> 'explainer' ->> 'identifier'           as identifier,
  v.snapshot -> 'explainer' ->> 'one_sentence'         as one_sentence,
  v.snapshot -> 'explainer' ->> 'summary_30s'          as summary_30s,
  (v.snapshot -> 'explainer' ->> 'decision_date')::date as decision_date,
  v.snapshot -> 'explainer' ->> 'decision_label'       as decision_label,
  v.snapshot,
  v.search
from public.explainers e
join public.explainer_versions v
  on v.explainer_id = e.id and v.version = e.version
where e.status = 'published' and not e.ai_draft;

-- ---------------------------------------------------------------------------
-- 7. Coverage rules and the admin inbox
-- ---------------------------------------------------------------------------

create table public.coverage_rules (
  id          uuid primary key default gen_random_uuid(),
  body_id     uuid references public.bodies(id),
  name        text not null,
  description text not null,
  min_amount  numeric check (min_amount is null or min_amount >= 0),
  item_type   text,
  active      boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint coverage_rules_has_test check (min_amount is not null or item_type is not null)
);

comment on table public.coverage_rules is
  'Published, objective tests for what MKP explains. body_id null means every body. A rule matches when the stated amount is at or above min_amount, or the item type equals item_type.';

create trigger coverage_rules_set_updated_at
  before update on public.coverage_rules
  for each row execute function public.set_updated_at();

create table public.intake_items (
  id               uuid primary key default gen_random_uuid(),
  title            text not null check (length(btrim(title)) > 0),
  body_id          uuid references public.bodies(id),
  meeting_id       uuid references public.meetings(id),
  document_id      uuid references public.documents(id) on delete set null,
  source_url       text,
  captured_via     public.capture_method not null default 'upload',
  item_type        text,
  stated_amount    numeric check (stated_amount is null or stated_amount >= 0),
  decision_date    date,
  coverage         public.coverage_decision not null default 'pending',
  coverage_rule_id uuid references public.coverage_rules(id),
  skip_reason      text,
  explainer_id     uuid references public.explainers(id) on delete set null,
  vote_id          uuid references public.votes(id) on delete set null,
  decided_by       uuid references public.admins(id),
  decided_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint intake_cover_needs_rule
    check (coverage <> 'cover' or coverage_rule_id is not null),
  constraint intake_skip_needs_reason
    check (coverage <> 'skip' or length(btrim(coalesce(skip_reason, ''))) > 0)
);

comment on table public.intake_items is
  'The admin inbox. Every detected or uploaded item lands here. It can only be covered by pointing at a coverage rule, and only skipped with a written reason.';
comment on column public.intake_items.stated_amount is 'Dollar amount exactly as stated in the source. Never an MKP estimate.';

create index intake_items_coverage_idx on public.intake_items (coverage, decision_date);
create index intake_items_meeting_idx  on public.intake_items (meeting_id);

create or replace function public.match_coverage_rule(p_body_id uuid, p_amount numeric, p_item_type text)
returns uuid
language sql
stable
set search_path to 'public'
as $$
  select r.id
    from coverage_rules r
   where r.active
     and (r.body_id is null or r.body_id = p_body_id)
     and (   (r.min_amount is not null and p_amount is not null and p_amount >= r.min_amount)
          or (r.item_type  is not null and lower(r.item_type) = lower(coalesce(p_item_type, ''))))
   order by (r.body_id is null), r.sort_order, r.created_at
   limit 1;
$$;

-- The system can suggest a rule. Only a human decides.
create or replace function public.intake_guard_decision()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if new.coverage <> 'pending'
     and (tg_op = 'INSERT' or new.coverage is distinct from old.coverage)
     and not public.is_admin()
  then
    raise exception 'Only a signed in admin may decide coverage.'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger intake_guard_decision
  before insert or update on public.intake_items
  for each row execute function public.intake_guard_decision();

create trigger intake_items_set_updated_at
  before update on public.intake_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 8. Corrections can point at an explainer version
-- ---------------------------------------------------------------------------

alter table public.corrections
  add column explainer_id      uuid references public.explainers(id) on delete set null,
  add column explainer_version integer;

-- ---------------------------------------------------------------------------
-- 9. Audit trail: who changed what, when, and why
-- ---------------------------------------------------------------------------

create table public.editorial_events (
  id             bigint generated always as identity primary key,
  occurred_at    timestamptz not null default now(),
  actor_admin_id uuid,
  actor_label    text not null,
  table_name     text not null,
  row_id         uuid,
  action         text not null check (action in ('insert', 'update', 'delete')),
  before         jsonb,
  after          jsonb,
  reason         text
);
create index editorial_events_row_idx  on public.editorial_events (table_name, row_id, occurred_at desc);
create index editorial_events_time_idx on public.editorial_events (occurred_at desc);

comment on table public.editorial_events is
  'Append only. Written by triggers. Nobody, including admins, can edit or delete rows through the API.';

create or replace function public.log_editorial_event()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_email  text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_admin  uuid;
  v_before jsonb;
  v_after  jsonb;
begin
  if tg_op in ('UPDATE', 'DELETE') then v_before := to_jsonb(old); end if;
  if tg_op in ('INSERT', 'UPDATE') then v_after  := to_jsonb(new); end if;

  if tg_op = 'UPDATE' and v_before = v_after then
    return null;
  end if;

  select a.id into v_admin from admins a where lower(a.email) = v_email and v_email <> '';

  insert into editorial_events (actor_admin_id, actor_label, table_name, row_id, action, before, after, reason)
  values (
    v_admin,
    case
      when v_admin is not null then v_email
      when coalesce(current_setting('role', true), '') = 'service_role' then 'automation'
      else coalesce(nullif(current_setting('role', true), ''), session_user::text)
    end,
    tg_table_name,
    (coalesce(v_after, v_before) ->> 'id')::uuid,
    lower(tg_op),
    v_before,
    v_after,
    nullif(current_setting('mkp.reason', true), '')
  );

  return null;
end;
$$;

revoke all on function public.log_editorial_event() from public, anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'documents', 'explainers', 'claims', 'citations', 'votes', 'reports',
    'records_requests', 'corrections', 'coverage_rules', 'intake_items'
  ] loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I
         for each row execute function public.log_editorial_event()',
      t || '_log_editorial_event', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 10. Row level security and grants
-- ---------------------------------------------------------------------------

alter table public.document_pages     enable row level security;
alter table public.explainers         enable row level security;
alter table public.claims             enable row level security;
alter table public.citations          enable row level security;
alter table public.explainer_versions enable row level security;
alter table public.coverage_rules     enable row level security;
alter table public.intake_items       enable row level security;
alter table public.editorial_events   enable row level security;

grant all on
  public.document_pages, public.explainers, public.claims, public.citations,
  public.explainer_versions, public.coverage_rules, public.intake_items
to authenticated, service_role;

-- Audit rows are written only by the security definer trigger function.
revoke all   on public.editorial_events from anon, authenticated, service_role;
grant select on public.editorial_events to authenticated, service_role;

-- Helper functions are for admins and server code, not the anon key.
revoke execute on function public.explainer_problems(uuid)                 from public, anon;
revoke execute on function public.build_explainer_snapshot(uuid)           from public, anon;
revoke execute on function public.publish_explainer(uuid, text)            from public, anon;
revoke execute on function public.match_coverage_rule(uuid, numeric, text) from public, anon;
grant  execute on function public.explainer_problems(uuid)                 to authenticated, service_role;
grant  execute on function public.build_explainer_snapshot(uuid)           to authenticated, service_role;
grant  execute on function public.publish_explainer(uuid, text)            to authenticated;
grant  execute on function public.match_coverage_rule(uuid, numeric, text) to authenticated, service_role;

-- Working tables: nothing for anon.
revoke all on public.claims, public.citations, public.intake_items from anon;

-- explainers: anon may read routing columns only. Never the draft prose.
revoke all on public.explainers from anon;
grant select (id, slug, kind, body_id, meeting_id, vote_id, version, status, ai_draft, published_at, last_published_at)
  on public.explainers to anon;

revoke all on public.document_pages, public.explainer_versions, public.coverage_rules from anon;
grant select on public.document_pages, public.explainer_versions, public.coverage_rules to anon;
grant select on public.explainers_public to anon, authenticated, service_role;

-- admin all (same shape as every other table in this project)
create policy "admin all" on public.document_pages     for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin all" on public.explainers         for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin all" on public.claims             for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin all" on public.citations          for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin all" on public.explainer_versions for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin all" on public.coverage_rules     for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin all" on public.intake_items       for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin read" on public.editorial_events  for select to authenticated using (public.is_admin());

-- public read
create policy "public read published" on public.explainers
  for select to public using (status = 'published' and not ai_draft);

create policy "public read published" on public.explainer_versions
  for select to public using (
    exists (select 1 from public.explainers e
             where e.id = explainer_versions.explainer_id
               and e.status = 'published' and not e.ai_draft));

create policy "public read publishable" on public.document_pages
  for select to public using (
    exists (select 1 from public.documents d
             where d.id = document_pages.document_id and d.is_publishable));

create policy "public read active" on public.coverage_rules
  for select to public using (active);

-- ---------------------------------------------------------------------------
-- 11. Settings and the private bucket
-- ---------------------------------------------------------------------------

insert into public.site_settings (key, value, is_public)
values ('explainer_max_reading_grade', '9', true)
on conflict (key) do nothing;

insert into storage.buckets (id, name, public)
values ('documents-private', 'documents-private', false)
on conflict (id) do nothing;

create policy "mkp private documents admin all" on storage.objects
  for all to authenticated
  using      (bucket_id = 'documents-private' and public.is_admin())
  with check (bucket_id = 'documents-private' and public.is_admin());
