-- Phase 2, step 1: the roster widens past the school board.
--
-- Vote Watch was built for one body. Toledo City Council is twelve members,
-- six elected at large and six by district, and its agendas come from a
-- different system than the board's. Two columns carry that: where a body
-- publishes its agendas, and which district a member holds.
--
-- Nothing here fetches anything. It records what the watcher in a later step
-- will need to know, and it lets a council member be entered by hand today.

-- ---------------------------------------------------------------------------
-- Where a body publishes its agendas
-- ---------------------------------------------------------------------------

create type agenda_system as enum ('boarddocs', 'granicus', 'manual');

-- 'manual' is the default because it is the honest answer for a body nobody
-- has looked at yet: the agendas arrive because a person went and got them.
alter table public.bodies
  add column agenda_system agenda_system not null default 'manual';

comment on column public.bodies.agenda_system is
  'Which agenda system this body publishes through, and so which watcher can read it. manual means a person enters the meeting by hand.';

update public.bodies set agenda_system = 'boarddocs' where slug = 'tps-board';
update public.bodies set agenda_system = 'granicus'  where slug = 'toledo-city-council';

-- ---------------------------------------------------------------------------
-- District
-- ---------------------------------------------------------------------------

-- Text, not an integer. Toledo council seats are numbered one to six, but a
-- district is an identifier rather than a quantity, nothing adds them up, and
-- the county and the school board name their seats differently. Null means the
-- member holds no district, which on council means they were elected at large.
alter table public.people add column district text;

comment on column public.people.district is
  'The district a body member represents, as the body writes it. Null for an at large seat and for anyone who is not an elected member.';

-- 0004 replaced the anonymous role's table wide grant on people with a column
-- list, so that an email address could be held without publishing it. A column
-- added afterwards is not in that list and is unreadable to the public site
-- until it is named here. Which district an elected member holds is public
-- record and is printed on the ballot, so it is granted.
grant select (district) on public.people to anon;

-- ---------------------------------------------------------------------------
-- The Latest feed names the body that voted
-- ---------------------------------------------------------------------------
--
-- The feed row already carries the body's name as its subtitle. The kind label
-- now reads "City Council vote" rather than "Vote Watch", and a short name is
-- looked up by slug rather than by matching on a name that can be edited, so
-- the slug travels with the row.

create or replace view public.latest_feed
with (security_invoker = true)
as
  select
    'report'::text                          as kind,
    r.title                                 as title,
    replace(initcap(replace(r.type::text, '_', ' ')), ' ', ' ') as subtitle,
    r.report_date                           as date,
    '/reports/' || r.slug                   as href,
    null::text                              as body_slug
  from public.reports r
  where r.status = 'published'

  union all

  select
    'records_request'::text,
    rr.request_text,
    a.name,
    rr.date_filed,
    '/records',
    null::text
  from public.records_requests rr
  join public.agencies a on a.id = rr.agency_id

  union all

  select
    'vote'::text,
    v.item_title,
    b.name,
    m.meeting_date,
    '/votes',
    b.slug
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
    '/listening',
    null::text
  from public.listening_sessions ls
  where ls.status = 'published';

-- ---------------------------------------------------------------------------
-- The voting record carries the district, so the public table can say which
-- seat a name belongs to without a second query.
-- ---------------------------------------------------------------------------

create or replace view public.member_vote_tallies
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
    count(*) filter (where vm.vote = 'absent')                  as absent_count,
    p.district
  from public.people p
  left join public.bodies b on b.id = p.body_id
  left join public.vote_members vm
    on vm.person_id = p.id
   and exists (
     select 1 from public.votes v
     where v.id = vm.vote_id and v.status = 'published' and not v.ai_draft
   )
  where p.role = 'body_member'
  group by p.id, p.name, p.title, b.name, b.slug, p.term_start, p.term_end,
           p.active, p.sort_order, p.district;
