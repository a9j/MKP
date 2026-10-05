-- 0011_explainer_templates
-- Ballot, levy and contract explainers as structured pages, built on the
-- editorial system from 0008 rather than beside it.
--
-- An explainer with a template is filled in through a form (issue cards, levy
-- figures, a contract timeline) instead of being written as labelled claims.
-- It still publishes only through publish_explainer(), so it still gets the
-- frozen snapshot, the version history, the change note from version 2 on,
-- the audit trail, and the rule that automation can never publish. What
-- changes is the checklist: explainer_problems() asks a templated explainer
-- for a summary, sources, and a source behind every figure, in place of the
-- claim and citation checks.
--
-- template null keeps the 0008 behaviour exactly, for the claim-based
-- explainers the Phase One spec describes.
--
-- The public never reads these working tables. Like the claims, everything
-- here reaches the site only inside the snapshot that publish_explainer()
-- freezes, so an edit to a live page stays invisible until it is published
-- again.

-- ---------------------------------------------------------------------------
-- 1. explainers: which template, and the fields every template shares
-- ---------------------------------------------------------------------------

alter table public.explainers
  add column template        text,
  add column current_status  text,
  add column pdf_path        text,
  add column hero_image_path text,
  add column hero_image_alt  text,
  add column is_sample       boolean not null default false,
  add constraint explainers_template_check
    check (template is null or template in ('ballot', 'levy', 'contract')),
  -- The template decides the page; the kind is what the 0008 system and the
  -- home page already filter on. A ballot page covers a whole election, so it
  -- uses the existing ballot_issue kind rather than a new enum value, which
  -- Postgres will not let a transactional migration add and use.
  add constraint explainers_template_matches_kind
    check (
      template is null
      or (template = 'ballot'   and kind = 'ballot_issue')
      or (template = 'levy'     and kind = 'levy')
      or (template = 'contract' and kind = 'contract')
    ),
  add constraint explainers_current_status_length
    check (current_status is null or length(current_status) <= 140),
  add constraint explainers_hero_needs_alt
    check (hero_image_path is null or length(btrim(coalesce(hero_image_alt, ''))) > 0);

comment on column public.explainers.template is
  'ballot, levy or contract: a structured page at /ballot, /levy or /contract. Null is a claim-based explainer from the Phase One spec.';
comment on column public.explainers.current_status is
  'Contract tracker only. One line shown at the top, for example "Talks ongoing".';
comment on column public.explainers.is_sample is
  'Placeholder content for seeing the pages and forms. Never public, and cannot be published.';
comment on column public.explainers.decision_date is
  'For a ballot or levy explainer, the election date.';

create index explainers_template_idx on public.explainers (template) where template is not null;

-- ---------------------------------------------------------------------------
-- 2. Sources. Every figure on a templated page points at one of these.
-- ---------------------------------------------------------------------------

create table public.explainer_sources (
  id            uuid primary key default gen_random_uuid(),
  explainer_id  uuid not null references public.explainers(id) on delete cascade,
  label         text not null check (length(btrim(label)) > 0),
  url           text not null check (url ~* '^https?://\S+$'),
  document_date date,
  note          text,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- Lets the tables below require that a figure's source belongs to the same
  -- explainer, not just to some explainer.
  unique (explainer_id, id)
);

create index explainer_sources_explainer_idx on public.explainer_sources (explainer_id, sort_order);

-- ---------------------------------------------------------------------------
-- 3. Ballot: one card per issue
-- ---------------------------------------------------------------------------

create table public.ballot_issues (
  id                       uuid primary key default gen_random_uuid(),
  explainer_id             uuid not null references public.explainers(id) on delete cascade,
  issue_number             text,
  title                    text not null check (length(btrim(title)) > 0),
  jurisdiction             text,
  what_yes_means           text not null default '',
  what_no_means            text not null default '',
  cost_note                text,
  cost_source_id           uuid,
  linked_levy_explainer_id uuid references public.explainers(id) on delete set null,
  sort_order               integer not null default 0,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  foreign key (explainer_id, cost_source_id)
    references public.explainer_sources (explainer_id, id)
    on delete set null (cost_source_id),
  constraint ballot_issues_not_own_link check (linked_levy_explainer_id is distinct from explainer_id)
);

create index ballot_issues_explainer_idx on public.ballot_issues (explainer_id, sort_order);
create index ballot_issues_linked_levy_idx on public.ballot_issues (linked_levy_explainer_id);

-- ---------------------------------------------------------------------------
-- 4. Levy: one row of figures per levy explainer
-- ---------------------------------------------------------------------------

create table public.levy_details (
  explainer_id             uuid primary key references public.explainers(id) on delete cascade,
  district_or_body         text not null default '',
  levy_kind                text not null default 'new'
    check (levy_kind in ('new', 'renewal', 'replacement', 'additional', 'renewal_with_increase')),
  mills                    numeric check (mills is null or mills > 0),
  years                    integer check (years is null or years between 1 and 99),
  purpose                  text,
  estimated_annual_revenue numeric check (estimated_annual_revenue is null or estimated_annual_revenue >= 0),
  cost_per_100k            numeric check (cost_per_100k is null or cost_per_100k >= 0),
  mills_source_id          uuid,
  revenue_source_id        uuid,
  cost_source_id           uuid,
  updated_at               timestamptz not null default now(),
  foreign key (explainer_id, mills_source_id)
    references public.explainer_sources (explainer_id, id) on delete set null (mills_source_id),
  foreign key (explainer_id, revenue_source_id)
    references public.explainer_sources (explainer_id, id) on delete set null (revenue_source_id),
  foreign key (explainer_id, cost_source_id)
    references public.explainer_sources (explainer_id, id) on delete set null (cost_source_id)
);

comment on column public.levy_details.years is 'Null means a continuing levy with no end date.';
comment on column public.levy_details.cost_per_100k is
  'The county auditor''s certified annual cost per $100,000 of home value. The calculator uses it when set, and the 35 percent formula when not.';

-- ---------------------------------------------------------------------------
-- 5. Contract: a timeline of events
-- ---------------------------------------------------------------------------

create table public.contract_events (
  id           uuid primary key default gen_random_uuid(),
  explainer_id uuid not null references public.explainers(id) on delete cascade,
  event_date   date not null,
  event_type   text not null check (event_type in (
    'talks_opened', 'session', 'offer', 'counteroffer', 'board_vote',
    'union_vote', 'mediation', 'agreement', 'other'
  )),
  headline     text not null check (length(btrim(headline)) > 0 and length(headline) <= 140),
  description  text,
  source_id    uuid,
  sort_order   integer not null default 0,
  ai_generated boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  foreign key (explainer_id, source_id)
    references public.explainer_sources (explainer_id, id) on delete set null (source_id)
);

create index contract_events_explainer_idx on public.contract_events (explainer_id, event_date desc, sort_order);

-- ---------------------------------------------------------------------------
-- 6. Housekeeping triggers: updated_at and the audit trail
-- ---------------------------------------------------------------------------

create trigger explainer_sources_set_updated_at before update on public.explainer_sources
  for each row execute function public.set_updated_at();
create trigger ballot_issues_set_updated_at before update on public.ballot_issues
  for each row execute function public.set_updated_at();
create trigger levy_details_set_updated_at before update on public.levy_details
  for each row execute function public.set_updated_at();
create trigger contract_events_set_updated_at before update on public.contract_events
  for each row execute function public.set_updated_at();

-- levy_details has no id column; the audit row keys on explainer_id instead.
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
    coalesce(coalesce(v_after, v_before) ->> 'id', coalesce(v_after, v_before) ->> 'explainer_id')::uuid,
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
  foreach t in array array['explainer_sources', 'ballot_issues', 'levy_details', 'contract_events'] loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I
         for each row execute function public.log_editorial_event()',
      t || '_log_editorial_event', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. The checklist. Templated explainers get their own rules.
-- ---------------------------------------------------------------------------

create or replace function public.explainer_problems(p_id uuid)
returns text[]
language plpgsql
stable
set search_path to 'public'
as $$
declare
  e         explainers%rowtype;
  l         levy_details%rowtype;
  v_max     numeric := coalesce(
                (select s.value::numeric from site_settings s where s.key = 'explainer_max_reading_grade'), 9);
  v_out     text[] := '{}';
  v_texts   text[];
  v_text    text;
  r         record;
begin
  select * into e from explainers where id = p_id;
  if not found then
    return array['Explainer not found.'];
  end if;

  -- A claim-based explainer keeps the 0008 checklist, unchanged.
  if e.template is null then
    return coalesce((
      select array_agg(problem order by ord, problem)
      from (
        select 2 as ord, 'Missing the one sentence summary.' as problem
         where length(btrim(coalesce(e.one_sentence, ''))) = 0

        union all
        select 3, 'Missing the 30-second version.'
         where length(btrim(coalesce(e.summary_30s, ''))) = 0

        union all
        select 4, 'Reading grade is missing or above the limit of ' || v_max::text || '.'
         where e.reading_grade is null or e.reading_grade > v_max

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
      ) p), '{}');
  end if;

  -- Templated explainers.
  if e.is_sample then
    v_out := v_out || 'This is a sample. Samples are for previewing and cannot be published.'::text;
  end if;

  if length(btrim(coalesce(e.summary_30s, ''))) = 0 then
    v_out := v_out || 'Missing the summary.'::text;
  end if;

  if e.reading_grade is null or e.reading_grade > v_max then
    v_out := v_out || ('Reading grade is missing or above the limit of ' || v_max::text || '. Save again after shortening sentences.');
  end if;

  if not exists (select 1 from explainer_sources s where s.explainer_id = p_id) then
    v_out := v_out || 'Add at least one source.'::text;
  end if;

  if e.template = 'ballot' then
    if e.decision_date is null then
      v_out := v_out || 'Missing the election date.'::text;
    end if;
    if not exists (select 1 from ballot_issues b where b.explainer_id = p_id) then
      v_out := v_out || 'Add at least one ballot issue.'::text;
    end if;
    for r in select * from ballot_issues b where b.explainer_id = p_id order by b.sort_order, b.created_at loop
      if length(btrim(r.what_yes_means)) = 0 then
        v_out := v_out || ('Say what a yes vote does: "' || left(r.title, 60) || '"');
      end if;
      if length(btrim(r.what_no_means)) = 0 then
        v_out := v_out || ('Say what a no vote does: "' || left(r.title, 60) || '"');
      end if;
      if r.cost_note ~ '[0-9]' and r.cost_source_id is null then
        v_out := v_out || ('The cost note has a number but no source: "' || left(r.title, 60) || '"');
      end if;
      if r.linked_levy_explainer_id is not null and not exists (
           select 1 from explainers x where x.id = r.linked_levy_explainer_id and x.template = 'levy') then
        v_out := v_out || ('The linked levy page is not a levy explainer: "' || left(r.title, 60) || '"');
      end if;
    end loop;
  end if;

  if e.template = 'levy' then
    select * into l from levy_details d where d.explainer_id = p_id;
    if not found then
      v_out := v_out || 'Fill in the levy figures.'::text;
    else
      if length(btrim(l.district_or_body)) = 0 then
        v_out := v_out || 'Missing the district or body asking for the levy.'::text;
      end if;
      if l.mills is null then
        v_out := v_out || 'Missing the millage.'::text;
      elsif l.mills_source_id is null then
        v_out := v_out || 'The millage has no source.'::text;
      end if;
      if length(btrim(coalesce(l.purpose, ''))) = 0 then
        v_out := v_out || 'Missing what the levy pays for.'::text;
      end if;
      if l.estimated_annual_revenue is not null and l.revenue_source_id is null then
        v_out := v_out || 'The estimated revenue has no source.'::text;
      end if;
      if l.cost_per_100k is not null and l.cost_source_id is null then
        v_out := v_out || 'The auditor''s cost per $100,000 has no source.'::text;
      end if;
    end if;
    if e.decision_date is null then
      v_out := v_out || 'Missing the election date.'::text;
    end if;
  end if;

  if e.template = 'contract' then
    if length(btrim(coalesce(e.current_status, ''))) = 0 then
      v_out := v_out || 'Missing the current status line.'::text;
    end if;
    if not exists (select 1 from contract_events c where c.explainer_id = p_id) then
      v_out := v_out || 'Add at least one update to the timeline.'::text;
    end if;
    for r in select * from contract_events c where c.explainer_id = p_id and c.source_id is null loop
      v_out := v_out || ('Update has no source: "' || left(r.headline, 60) || '"');
    end loop;
  end if;

  -- House rules for anything a reader will see: no em dashes, and nothing
  -- that reads as telling them how to vote.
  v_texts := array[e.title, e.summary_30s, e.one_sentence, e.current_status]
    || coalesce((select array_agg(concat_ws(' ', b.issue_number, b.title, b.jurisdiction,
                                            b.what_yes_means, b.what_no_means, b.cost_note))
                   from ballot_issues b where b.explainer_id = p_id), '{}')
    || coalesce((select array_agg(concat_ws(' ', d.district_or_body, d.purpose))
                   from levy_details d where d.explainer_id = p_id), '{}')
    || coalesce((select array_agg(concat_ws(' ', c.headline, c.description))
                   from contract_events c where c.explainer_id = p_id), '{}')
    || coalesce((select array_agg(concat_ws(' ', s.label, s.note))
                   from explainer_sources s where s.explainer_id = p_id), '{}');

  foreach v_text in array v_texts loop
    continue when v_text is null;
    if position(U&'\2014' in v_text) > 0 then
      v_out := v_out || ('Replace the em dash in: "' || left(v_text, 60) || '"');
    end if;
    if v_text ~* '\mvote (yes|no)\M' then
      v_out := v_out || ('Reads as advice on how to vote: "' || left(v_text, 60) || '"');
    end if;
  end loop;

  return v_out;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. The snapshot carries the structured content, so the public page is
--    built from exactly what was approved.
-- ---------------------------------------------------------------------------

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
      'template', e.template,
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
      'reading_grade', e.reading_grade,
      'current_status', e.current_status,
      'pdf_path', e.pdf_path,
      'hero_image_path', e.hero_image_path,
      'hero_image_alt', e.hero_image_alt,
      'is_sample', e.is_sample
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
       where c.explainer_id = e.id), '[]'::jsonb),
    'sources', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'id', s.id,
                 'label', s.label,
                 'url', s.url,
                 'document_date', s.document_date,
                 'note', s.note)
               order by s.sort_order, s.created_at)
        from explainer_sources s
       where s.explainer_id = e.id), '[]'::jsonb),
    'ballot_issues', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'id', b.id,
                 'issue_number', b.issue_number,
                 'title', b.title,
                 'jurisdiction', b.jurisdiction,
                 'what_yes_means', b.what_yes_means,
                 'what_no_means', b.what_no_means,
                 'cost_note', b.cost_note,
                 'cost_source_id', b.cost_source_id,
                 'linked_levy_slug', (select x.slug from explainers x where x.id = b.linked_levy_explainer_id))
               order by b.sort_order, b.created_at)
        from ballot_issues b
       where b.explainer_id = e.id), '[]'::jsonb),
    'levy', (
      select jsonb_build_object(
               'district_or_body', d.district_or_body,
               'levy_kind', d.levy_kind,
               'mills', d.mills,
               'years', d.years,
               'purpose', d.purpose,
               'estimated_annual_revenue', d.estimated_annual_revenue,
               'cost_per_100k', d.cost_per_100k,
               'mills_source_id', d.mills_source_id,
               'revenue_source_id', d.revenue_source_id,
               'cost_source_id', d.cost_source_id)
        from levy_details d
       where d.explainer_id = e.id),
    'contract_events', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'id', c.id,
                 'event_date', c.event_date,
                 'event_type', c.event_type,
                 'headline', c.headline,
                 'description', c.description,
                 'source_id', c.source_id)
               order by c.event_date desc, c.sort_order, c.created_at)
        from contract_events c
       where c.explainer_id = e.id), '[]'::jsonb)
  )
  from explainers e
  where e.id = p_id;
$$;

-- ---------------------------------------------------------------------------
-- 9. Samples never reach the public, even if one were published by hand
-- ---------------------------------------------------------------------------

-- New columns go at the end, which create or replace view requires.
create or replace view public.explainers_public
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
  v.search,
  v.snapshot -> 'explainer' ->> 'template'             as template
from public.explainers e
join public.explainer_versions v
  on v.explainer_id = e.id and v.version = e.version
where e.status = 'published' and not e.ai_draft and not e.is_sample;

grant select on public.explainers_public to anon, authenticated, service_role;

drop policy "public read published" on public.explainers;
create policy "public read published" on public.explainers
  for select to public using (status = 'published' and not ai_draft and not is_sample);

drop policy "public read published" on public.explainer_versions;
create policy "public read published" on public.explainer_versions
  for select to public using (
    exists (select 1 from public.explainers e
             where e.id = explainer_versions.explainer_id
               and e.status = 'published' and not e.ai_draft and not e.is_sample));

-- anon may read the routing columns of a published explainer, as in 0008.
grant select (template, is_sample) on public.explainers to anon;

-- ---------------------------------------------------------------------------
-- 10. Row level security and grants for the new tables: admins only
-- ---------------------------------------------------------------------------

alter table public.explainer_sources enable row level security;
alter table public.ballot_issues     enable row level security;
alter table public.levy_details      enable row level security;
alter table public.contract_events   enable row level security;

grant all on public.explainer_sources, public.ballot_issues, public.levy_details, public.contract_events
  to authenticated, service_role;
revoke all on public.explainer_sources, public.ballot_issues, public.levy_details, public.contract_events
  from anon;

create policy "admin all" on public.explainer_sources for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin all" on public.ballot_issues     for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin all" on public.levy_details      for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin all" on public.contract_events   for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 11. Storage: public buckets for the optional PDF and the hero image
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('explainer-pdfs', 'explainer-pdfs', true),
       ('explainer-images', 'explainer-images', true)
on conflict (id) do nothing;

-- Public buckets are readable by URL without a policy. Writes are admin only.
create policy "mkp explainer files admin all" on storage.objects
  for all to authenticated
  using      (bucket_id in ('explainer-pdfs', 'explainer-images') and public.is_admin())
  with check (bucket_id in ('explainer-pdfs', 'explainer-images') and public.is_admin());
