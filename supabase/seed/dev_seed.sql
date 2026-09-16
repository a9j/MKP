-- Development content only. Clearly fake numbers, example.com sources.
-- Never run against production.

insert into public.admins (email, name) values
  ('hello@monakproject.org', 'Executive Director');

update public.site_settings set value = '48-1234567' where key = 'org_ein';
update public.site_settings set value = 'PO Box 1234, Toledo, OH 43604' where key = 'mailing_address';

-- Board members, so a vote roll call has people to attach to.
insert into public.people (name, title, role, body_id, term_start, term_end, active, sort_order)
select v.name, 'Board Member', 'body_member', b.id, '2024-01-01', '2027-12-31', true, v.ord
from public.bodies b,
     (values ('Sample Member One', 1), ('Sample Member Two', 2), ('Sample Member Three', 3),
             ('Sample Member Four', 4), ('Sample Member Five', 5)) as v(name, ord)
where b.slug = 'tps-board';

-- Reports: one published, one draft that must never reach the public feed.
insert into public.reports (slug, title, type, report_date, summary, status, published_at) values
  ('2026-toledo-teacher-pay-report', 'The 2026 Toledo Teacher Pay Report', 'pay_report',
   '2026-09-10', 'Every step, eight districts, inflation, three costed scenarios.',
   'published', now()),
  ('draft-levy-explainer', 'Draft levy explainer', 'levy_explainer',
   '2026-09-14', 'Not ready for release.', 'draft', null);

insert into public.report_sources (report_id, label, url, sort_order)
select id, 'TPS certified salary schedule, 2026-27', 'https://example.com/source.pdf', 0
from public.reports where slug = '2026-toledo-teacher-pay-report';

-- Records requests, including one open past ten business days.
insert into public.records_requests (agency_id, request_text, date_filed, status, date_responded)
select id, 'TPS 2026-27 certified salary schedule', '2026-08-18', 'fulfilled', '2026-09-03'
from public.agencies where name = 'Toledo Public Schools';

insert into public.records_requests (agency_id, request_text, date_filed, status)
select id, 'City of Toledo general fund monthly report', '2026-07-30', 'filed'
from public.agencies where name = 'City of Toledo';

insert into public.records_requests (agency_id, request_text, date_filed, status, date_responded, denial_reason)
select id, 'Lucas County contract file, vendor list', '2026-08-05', 'denied', '2026-08-20',
       'The office cited an exemption for records under active negotiation.'
from public.agencies where name = 'Lucas County';

-- Votes with a full roll call.
with v as (
  insert into public.votes (body_id, meeting_date, item_title, summary, category, amount,
                            agenda_url, minutes_url, yes_count, no_count, abstain_count, absent_count)
  select b.id, '2026-09-12', 'Approve HVAC contract for six buildings',
         'The board approved a heating and cooling contract covering six buildings.',
         'facilities', 4200000, 'https://example.com/source.pdf', 'https://example.com/source.pdf',
         4, 1, 0, 0
  from public.bodies b where b.slug = 'tps-board'
  returning id
)
insert into public.vote_members (vote_id, person_id, vote)
select v.id, p.id, case when p.sort_order = 5 then 'no'::vote_choice else 'yes'::vote_choice end
from v, public.people p where p.role = 'body_member';

insert into public.votes (body_id, meeting_date, item_title, summary, category, yes_count, no_count)
select b.id, '2026-08-29', 'Add four intervention specialist positions',
       'The board added four intervention specialist positions for the school year.',
       'staffing', 5, 0
from public.bodies b where b.slug = 'tps-board';

-- Listening sessions: one published, one draft.
insert into public.listening_sessions (session_date, audience, attendee_count, summary, status, published_at) values
  ('2026-08-21', 'teachers', 31, 'Planning time and health premiums came up more than base pay.',
   'published', now()),
  ('2026-09-05', 'parents', 12, 'Draft, not yet reviewed.', 'draft', null);

insert into public.listening_points (session_id, kind, text, sort_order)
select id, 'heard', 'Planning time is the first thing people raise.', 0
from public.listening_sessions where session_date = '2026-08-21';

insert into public.corrections (correction_date, page_path, what_changed, why) values
  ('2026-09-08', '/reports/2026-toledo-teacher-pay-report',
   'A step 10 figure read $54,200 and now reads $54,240.',
   'We transcribed the wrong row from the schedule. A reader pointed it out.');
