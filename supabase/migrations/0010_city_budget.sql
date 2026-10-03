-- Phase 2, step 2: the city budget, and the resident it is divided by.
--
-- The school budget already has a table, broken into categories. The city's is
-- a different document with a different shape: a fund, then a department, then
-- a line within it, one set per fiscal year. Keeping them apart means neither
-- has to be bent to fit the other, and a reader is never shown a school figure
-- and a city figure added together.
--
-- Nothing is seeded. The adopted budget book is loaded from toledo.oh.gov by
-- an administrator, because a figure nobody has checked against the page it
-- came from is a figure this site does not publish.

create table public.city_budget (
  id          uuid primary key default gen_random_uuid(),
  fiscal_year integer not null,
  fund        text not null,
  department  text not null,
  category    text not null,
  amount      numeric(16,2) not null,
  source_url  text not null,
  -- The page of the budget book the figure is on. Optional, because a
  -- consolidated table sometimes has no single page to point at, and a link to
  -- the document is the requirement. A page number is the courtesy.
  source_page integer,
  unique (fiscal_year, fund, department, category)
);

comment on table public.city_budget is
  'The City of Toledo adopted budget, one row per fiscal year, fund, department and category. Loaded by hand from the budget book.';

create index on public.city_budget (fiscal_year, fund);

-- Per resident figures need a denominator that is itself a published number,
-- so the population carries its own source rather than being typed into a
-- setting.
create table public.city_population (
  year       integer primary key,
  population integer not null check (population > 0),
  source_url text not null
);

comment on table public.city_population is
  'City population by year, each with the document it came from. Used for per resident figures, which divide one sourced number by another.';

-- Same rule as 0002: not null still allows an empty string, and an empty
-- string is an unsourced figure.
alter table public.city_budget
  add constraint city_budget_source_url_not_blank
  check (length(btrim(source_url)) > 0);

alter table public.city_population
  add constraint city_population_source_url_not_blank
  check (length(btrim(source_url)) > 0);

-- A page number is a page number.
alter table public.city_budget
  add constraint city_budget_source_page_positive
  check (source_page is null or source_page > 0);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.city_budget     enable row level security;
alter table public.city_population enable row level security;

-- Both are published figures on a public page.
create policy "public read" on public.city_budget     for select using (true);
create policy "public read" on public.city_population for select using (true);

create policy "admin all" on public.city_budget for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "admin all" on public.city_population for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant select on public.city_budget, public.city_population to anon, authenticated;
grant insert, update, delete on public.city_budget, public.city_population to authenticated;
grant all privileges on public.city_budget, public.city_population to service_role;
