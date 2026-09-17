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

-- Meetings, then the votes taken at them with a full roll call.
insert into public.meetings (body_id, meeting_date, kind, agenda_url, minutes_url, discovered_by)
select b.id, '2026-09-12', 'regular',
       'https://example.com/source.pdf', 'https://example.com/source.pdf', 'admin'
from public.bodies b where b.slug = 'tps-board';

insert into public.meetings (body_id, meeting_date, kind, agenda_url, discovered_by)
select b.id, '2026-08-29', 'regular', 'https://example.com/source.pdf', 'admin'
from public.bodies b where b.slug = 'tps-board';

with v as (
  insert into public.votes (meeting_id, item_title, summary, category, amount,
                            agenda_item_url, status, published_at)
  select m.id, 'Approve HVAC contract for six buildings',
         'The board approved a heating and cooling contract covering six buildings.',
         'facilities', 4200000, 'https://example.com/source.pdf', 'published', now()
  from public.meetings m where m.meeting_date = '2026-09-12'
  returning id
)
insert into public.vote_members (vote_id, person_id, vote)
select v.id, p.id, case when p.sort_order = 5 then 'no'::vote_choice else 'yes'::vote_choice end
from v, public.people p where p.role = 'body_member';

with v as (
  insert into public.votes (meeting_id, item_title, summary, category, status, published_at)
  select m.id, 'Add four intervention specialist positions',
         'The board added four intervention specialist positions for the school year.',
         'staffing', 'published', now()
  from public.meetings m where m.meeting_date = '2026-08-29'
  returning id
)
insert into public.vote_members (vote_id, person_id, vote)
select v.id, p.id, 'yes'::vote_choice
from v, public.people p where p.role = 'body_member';

-- One machine drafted vote, so the admin review list and the badge have
-- something to render. It is a draft, so no public page may show it.
insert into public.votes (meeting_id, item_title, summary, category, amount,
                          agenda_item_url, status, ai_draft, ai_model, ai_confidence)
select m.id, 'Renew transportation services agreement',
       'The board renewed a transportation services agreement for one year.',
       'contracts', 880000, 'https://example.com/source.pdf', 'draft', true,
       'claude-sonnet-4-6', 0.52
from public.meetings m where m.meeting_date = '2026-09-12';

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

-- ---------------------------------------------------------------------------
-- Explorer data. Fake figures, example.com sources.
-- ---------------------------------------------------------------------------

-- Current year, four lanes, six steps, for the home district and four
-- comparison districts that share the lane names.
insert into public.salary_schedule (school_year, district, lane, step, salary, source_url)
select '2026-2027', d.district, l.lane, s.step,
       round((l.base + (s.step - 1) * l.per_step) * d.factor)::numeric,
       'https://example.com/source.pdf'
from (values
        ('Toledo Public Schools', 1.000),
        ('Sylvania',              1.124),
        ('Perrysburg',            1.091),
        ('Washington Local',      1.038),
        ('Maumee',                1.067)
     ) as d(district, factor),
     (values ('BA', 42800, 1240), ('BA+15', 44300, 1325),
             ('MA', 47100, 1420), ('MA+30', 49400, 1500)
     ) as l(lane, base, per_step),
     (values (1), (3), (7), (10), (15), (20)) as s(step);

-- Springfield publishes its schedule with different lane names, which is the
-- case the Explorer has to refuse to compare rather than guess at.
insert into public.salary_schedule (school_year, district, lane, step, salary, source_url)
select '2026-2027', 'Springfield', l.lane, s.step,
       round((l.base + (s.step - 1) * l.per_step))::numeric,
       'https://example.com/source.pdf'
from (values ('Bachelors', 43100, 1260), ('Masters', 47600, 1440)) as l(lane, base, per_step),
     (values (1), (3), (7), (10), (15), (20)) as s(step);

-- The home district in 2010, for the inflation line.
insert into public.salary_schedule (school_year, district, lane, step, salary, source_url)
select '2010-2011', 'Toledo Public Schools', l.lane, s.step,
       round((l.base + (s.step - 1) * l.per_step))::numeric,
       'https://example.com/source.pdf'
from (values ('BA', 33900, 980), ('BA+15', 35100, 1045),
             ('MA', 37300, 1120), ('MA+30', 39100, 1185)) as l(lane, base, per_step),
     (values (1), (3), (7), (10), (15), (20)) as s(step);

update public.cpi set index_value = 218.056 where year = 2010;
insert into public.cpi (year, index_value, source_url) values
  (2026, 331.402, 'https://example.com/source.pdf')
on conflict (year) do nothing;

insert into public.budget_categories (fiscal_year, category, amount, source_url) values
  ('2026', 'Instruction',         182000000, 'https://example.com/source.pdf'),
  ('2026', 'Building Operations',  41000000, 'https://example.com/source.pdf'),
  ('2026', 'Student Support',      23750000, 'https://example.com/source.pdf'),
  ('2026', 'Transportation',       19500000, 'https://example.com/source.pdf'),
  ('2026', 'Administration',       16250000, 'https://example.com/source.pdf'),
  ('2026', 'Debt Service',         12000000, 'https://example.com/source.pdf');

insert into public.vacancies (as_of_date, position, building, posted_date, filled_date, source_url) values
  ('2026-09-01', 'Intervention Specialist', 'Sample Elementary',   '2026-07-14', null,         'https://example.com/source.pdf'),
  ('2026-09-01', 'School Psychologist',     'District Wide',       '2026-05-20', null,         'https://example.com/source.pdf'),
  ('2026-09-01', 'Science Teacher',         'Sample Middle School','2026-07-01', null,         'https://example.com/source.pdf'),
  ('2026-09-01', 'Math Teacher',            'Sample High School',  '2026-06-30', '2026-08-18', 'https://example.com/source.pdf'),
  ('2026-09-01', 'Bus Driver',              'Transportation',      '2026-08-04', '2026-08-25', 'https://example.com/source.pdf');

-- Advisory council, who review a report before it is released and are who the
-- "Send to council" button writes to.
insert into public.people (name, title, role, active, sort_order, bio) values
  ('Sample Council Member', 'Retired teacher', 'advisory', true, 1, 'Taught in Toledo for 28 years.'),
  ('Second Council Member', 'Parent and accountant', 'advisory', true, 2, 'Reads budgets for a living.');

-- Staff, for the About page in phase 6.
insert into public.people (name, title, role, active, sort_order) values
  ('Anthony Anderson', 'Executive Director', 'staff', true, 1);

-- Sources for the draft report, so the preview has something to show.
insert into public.report_sources (report_id, label, url, sort_order)
select id, 'Levy filing with the county board of elections', 'https://example.com/source.pdf', 0
from public.reports where slug = 'draft-levy-explainer';

update public.people set email = 'council-one@example.com' where name = 'Sample Council Member';
update public.people set email = 'council-two@example.com' where name = 'Second Council Member';
