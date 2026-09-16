-- The Explorer must never render a figure that does not link to a document.
-- 0001 made source_url NOT NULL, which still allows an empty string, so the
-- constraint is tightened here and the app refuses to build on a blank one.

alter table public.salary_schedule
  add constraint salary_schedule_source_url_not_blank
  check (length(btrim(source_url)) > 0);

alter table public.vacancies
  add constraint vacancies_source_url_not_blank
  check (length(btrim(source_url)) > 0);

alter table public.budget_categories
  add constraint budget_categories_source_url_not_blank
  check (length(btrim(source_url)) > 0);

alter table public.cpi
  add constraint cpi_source_url_not_blank
  check (length(btrim(source_url)) > 0);

-- Which district the Explorer reads as "you". Everything else in the salary
-- schedule is a comparison. Kept as a setting so a CSV that spells the
-- district differently can be pointed at without a code change.
insert into public.site_settings (key, value, is_public)
values ('explorer_home_district', 'Toledo Public Schools', true)
on conflict (key) do nothing;

-- Vacancies arrive as a monthly snapshot and 0001 gave them no natural key, so
-- a re-upload of the same month would duplicate every row.
--
-- building and posted_date are both optional, and by default a unique index
-- treats every null as distinct, which would let duplicates through. Postgres
-- 15 added NULLS NOT DISTINCT, which is what is wanted here. An expression
-- index over coalesce() would also dedupe, but ON CONFLICT can only target a
-- plain column list, so the upsert on re-upload would fail.
create unique index vacancies_snapshot_key
  on public.vacancies (as_of_date, position, building, posted_date)
  nulls not distinct;
