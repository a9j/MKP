-- Templated explainers (0011, 0012): the checklist, publishing through
-- publish_explainer(), the frozen snapshot, samples, and who may read what.

\set ON_ERROR_STOP on

create or replace function pg_temp.want(label text, got bigint, expected bigint)
returns void language plpgsql as $$
begin
  if got is distinct from expected then
    raise exception 'FAIL % : got %, want %', label, got, expected;
  end if;
  raise notice 'OK % = %', label, got;
end; $$;

create or replace function pg_temp.eq(label text, got text, expected text)
returns void language plpgsql as $$
begin
  if got is distinct from expected then
    raise exception 'FAIL % : got %, want %', label, got, expected;
  end if;
  raise notice 'OK %', label;
end; $$;

-- True when some problem in the list starts with the given text.
create or replace function pg_temp.has_problem(label text, p_id uuid, prefix text, expected boolean)
returns void language plpgsql as $$
declare
  found boolean;
begin
  select exists (select 1 from unnest(explainer_problems(p_id)) p where p like prefix || '%') into found;
  if found is distinct from expected then
    raise exception 'FAIL % : problem "%" present = %, want %. Problems: %',
      label, prefix, found, expected, explainer_problems(p_id);
  end if;
  raise notice 'OK %', label;
end; $$;

create or replace function pg_temp.fails(label text, stmt text, want_sqlstate text)
returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAIL % : statement was accepted', label;
exception when others then
  if sqlstate = 'P0001' then raise; end if;
  if sqlstate <> want_sqlstate then
    raise exception 'FAIL % : wrong error % %', label, sqlstate, sqlerrm;
  end if;
  raise notice 'OK % rejected (%)', label, want_sqlstate;
end; $$;

insert into admins (email, name) values ('ed@monakproject.org', 'ED') on conflict do nothing;

\echo '== samples =='
select pg_temp.want('three samples seeded', (select count(*) from explainers where is_sample), 3);
select pg_temp.want('samples are drafts', (select count(*) from explainers where is_sample and status <> 'draft'), 0);
select pg_temp.want('one sample per template', (select count(distinct template) from explainers where is_sample), 3);
select pg_temp.has_problem('a sample cannot be published',
  (select id from explainers where slug = 'sample-levy-example-school-district'), 'This is a sample', true);

\echo '== a levy, start to finish =='
set role authenticated;
set request.jwt.claims = '{"email":"ed@monakproject.org"}';

insert into explainers (slug, kind, template, title, decision_date)
values ('test-levy', 'levy', 'levy', 'Test Levy', '2026-11-03');

select pg_temp.has_problem('needs a summary',  (select id from explainers where slug = 'test-levy'), 'Missing the summary', true);
select pg_temp.has_problem('needs a source',   (select id from explainers where slug = 'test-levy'), 'Add at least one source', true);
select pg_temp.has_problem('needs figures',    (select id from explainers where slug = 'test-levy'), 'Fill in the levy figures', true);

update explainers set summary_30s = 'A test levy for the database tests.', reading_grade = 6
 where slug = 'test-levy';
insert into explainer_sources (explainer_id, label, url)
select id, 'Test source', 'https://example.com/a.pdf' from explainers where slug = 'test-levy';
insert into levy_details (explainer_id, district_or_body, levy_kind, mills, purpose, estimated_annual_revenue)
select id, 'Test District', 'new', 3, 'Test purpose.', 500000 from explainers where slug = 'test-levy';

select pg_temp.has_problem('millage needs a source', (select id from explainers where slug = 'test-levy'), 'The millage has no source', true);
select pg_temp.has_problem('revenue needs a source', (select id from explainers where slug = 'test-levy'), 'The estimated revenue has no source', true);

update levy_details d
   set mills_source_id = s.id, revenue_source_id = s.id
  from explainer_sources s
 where s.explainer_id = d.explainer_id
   and d.explainer_id = (select id from explainers where slug = 'test-levy');

select pg_temp.want('a complete levy has no problems',
  (select cardinality(explainer_problems(id)) from explainers where slug = 'test-levy'), 0);

select pg_temp.want('publishes as version 1',
  (select publish_explainer(id) from explainers where slug = 'test-levy'), 1);
reset role; reset request.jwt.claims;

\echo '== the public reads the snapshot, nothing else =='
set role anon;
select pg_temp.want('anon sees the published levy', (select count(*) from explainers_public where slug = 'test-levy'), 1);
select pg_temp.eq('the view carries the template', (select template from explainers_public where slug = 'test-levy'), 'levy');
select pg_temp.eq('the snapshot carries the millage', (select snapshot -> 'levy' ->> 'mills' from explainers_public where slug = 'test-levy'), '3');
select pg_temp.want('the snapshot carries the sources',
  (select jsonb_array_length(snapshot -> 'sources') from explainers_public where slug = 'test-levy'), 1);
select pg_temp.want('anon sees no samples', (select count(*) from explainers_public where slug like 'sample-%'), 0);
select pg_temp.fails('anon cannot read sources',       'select 1 from explainer_sources', '42501');
select pg_temp.fails('anon cannot read ballot issues', 'select 1 from ballot_issues',     '42501');
select pg_temp.fails('anon cannot read levy figures',  'select 1 from levy_details',      '42501');
select pg_temp.fails('anon cannot read contract events', 'select 1 from contract_events', '42501');
reset role;

\echo '== an edit stays private until it is published again =='
set role authenticated;
set request.jwt.claims = '{"email":"ed@monakproject.org"}';
update levy_details set mills = 4 where explainer_id = (select id from explainers where slug = 'test-levy');
reset role; reset request.jwt.claims;

set role anon;
select pg_temp.eq('the public still sees 3 mills', (select snapshot -> 'levy' ->> 'mills' from explainers_public where slug = 'test-levy'), '3');
reset role;

set role authenticated;
set request.jwt.claims = '{"email":"ed@monakproject.org"}';
select pg_temp.fails('version 2 needs a change note',
  $q$select publish_explainer(id) from explainers where slug = 'test-levy'$q$, '23514');
select pg_temp.want('publishes as version 2 with a note',
  (select publish_explainer(id, 'Corrected the millage.') from explainers where slug = 'test-levy'), 2);
reset role; reset request.jwt.claims;

set role anon;
select pg_temp.eq('the public now sees 4 mills', (select snapshot -> 'levy' ->> 'mills' from explainers_public where slug = 'test-levy'), '4');
reset role;

\echo '== house rules =='
set role authenticated;
set request.jwt.claims = '{"email":"ed@monakproject.org"}';
update explainers set summary_30s = 'A levy ' || U&'\2014' || ' with a dash.' where slug = 'test-levy';
select pg_temp.has_problem('an em dash is caught', (select id from explainers where slug = 'test-levy'), 'Replace the em dash', true);
update explainers set summary_30s = 'You should vote yes on this.' where slug = 'test-levy';
select pg_temp.has_problem('advice is caught', (select id from explainers where slug = 'test-levy'), 'Reads as advice', true);
update explainers set summary_30s = 'A test levy for the database tests.' where slug = 'test-levy';
select pg_temp.has_problem('a yes vote described plainly is fine', (select id from explainers where slug = 'test-levy'), 'Reads as advice', false);

\echo '== a figure must cite a source from its own explainer =='
insert into explainers (slug, kind, template, title, decision_date)
values ('test-ballot', 'ballot_issue', 'ballot', 'Test Ballot', '2026-11-03');
select pg_temp.fails('a source from another explainer is refused',
  $q$insert into ballot_issues (explainer_id, title, cost_source_id)
     select (select id from explainers where slug = 'test-ballot'), 'x', s.id
       from explainer_sources s
      where s.explainer_id = (select id from explainers where slug = 'test-levy')$q$, '23503');

insert into ballot_issues (explainer_id, issue_number, title, what_yes_means, what_no_means, cost_note, linked_levy_explainer_id)
select id, 'Issue 1', 'Test issue', 'Yes keeps it.', '', 'About $90 a year.',
       (select id from explainers where slug = 'test-levy')
  from explainers where slug = 'test-ballot';
select pg_temp.has_problem('a no vote must be described', (select id from explainers where slug = 'test-ballot'), 'Say what a no vote does', true);
select pg_temp.has_problem('a number in a cost note needs a source', (select id from explainers where slug = 'test-ballot'), 'The cost note has a number', true);
select pg_temp.has_problem('a levy link to a levy is fine', (select id from explainers where slug = 'test-ballot'), 'The linked levy page', false);

\echo '== the template matches the kind =='
select pg_temp.fails('a levy template must be a levy kind',
  $q$insert into explainers (slug, kind, template, title) values ('mismatch', 'contract', 'levy', 'x')$q$, '23514');

\echo '== admins cannot publish a sample either =='
select pg_temp.fails('publishing a sample is refused',
  $q$select publish_explainer(id) from explainers where slug = 'sample-contract-example-district-and-union'$q$, '23514');
reset role; reset request.jwt.claims;

\echo '== automation drafts, a person publishes =='
set role service_role;
insert into contract_events (explainer_id, event_date, event_type, headline, ai_generated)
select id, '2026-10-01', 'session', 'Drafted by automation', true
  from explainers where slug = 'sample-contract-example-district-and-union';
\echo 'OK the service role may add a draft contract event'
insert into explainers (slug, kind, template, title, ai_draft)
values ('automation-draft', 'contract', 'contract', 'Drafted by automation', true);
\echo 'OK the service role may create a draft explainer'
select pg_temp.fails('the service role cannot publish',
  $q$select publish_explainer(id) from explainers where slug = 'automation-draft'$q$, '42501');
select pg_temp.fails('the service role cannot set published directly',
  $q$update explainers set status = 'published' where slug = 'automation-draft'$q$, '42501');
reset role;

\echo 'ALL EXPLAINER ASSERTIONS PASSED'
