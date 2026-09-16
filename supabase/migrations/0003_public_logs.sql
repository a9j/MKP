-- Views behind the Records Desk and Vote Watch pages.
--
-- The computed columns live here rather than in the app so the response time
-- and the per member tallies are worked out once, in the same place, by the
-- same rules, whoever is asking.

-- Records Desk. response_business_days is null while a request is still open,
-- which the page renders as "no response yet" rather than as a zero.
create view public.records_request_log
with (security_invoker = true)
as
  select
    r.id,
    r.date_filed,
    a.name                                   as agency_name,
    r.request_text,
    r.status,
    r.date_responded,
    r.denial_reason,
    public.business_days_between(r.date_filed, r.date_responded) as response_business_days,
    -- Days an unanswered request has been open, counted to today. Used by the
    -- admin dashboard to flag anything past ten business days.
    case
      when r.date_responded is null
        then public.business_days_between(r.date_filed, current_date)
      else null
    end                                      as open_business_days,
    (
      select count(*)
      from public.documents d
      where d.owner_type = 'records_request' and d.owner_id = r.id
    )                                        as document_count
  from public.records_requests r
  join public.agencies a on a.id = r.agency_id;

-- Voting record by member. Counts only the votes that member was recorded on.
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
  left join public.vote_members vm on vm.person_id = p.id
  where p.role = 'body_member'
  group by p.id, p.name, p.title, b.name, b.slug, p.term_start, p.term_end, p.active, p.sort_order;

grant select on public.records_request_log to anon, authenticated;
grant select on public.member_vote_tallies to anon, authenticated;
