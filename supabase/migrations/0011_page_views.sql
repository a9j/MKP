-- Visitor tracking: who arrived, from where, and how long they stayed.
--
-- One row per page a reader opens. Nothing here identifies a person:
--   * no cookies are set and nothing is kept in the browser beyond the tab,
--   * the IP address is never stored,
--   * visitor_hash is a one way hash of a secret, the date, the IP and the
--     browser string, so it rotates at midnight UTC. It can count unique
--     readers within a day and cannot follow anyone from one day to the next.
--
-- Rows are written only by the site's own /api/track route with the service
-- role. The anonymous key cannot read or write this table at all, and only an
-- administrator can read it.

create table public.page_views (
  id               uuid primary key,
  -- One browser tab's session on the site. Lives in sessionStorage, so it ends
  -- when the tab closes. Groups the pages of one visit together.
  visit_id         uuid not null,
  visitor_hash     text not null,
  path             text not null check (length(path) between 1 and 512),
  -- Host only, never the full referring URL, which can carry a search query.
  referrer_host    text,
  utm_source       text,
  utm_medium       text,
  utm_campaign     text,
  device           text not null default 'desktop'
                   check (device in ('mobile', 'tablet', 'desktop')),
  country          text,
  region           text,
  city             text,
  started_at       timestamptz not null default now(),
  last_seen_at     timestamptz not null default now(),
  -- Seconds the page was actually on screen. A tab left in the background is
  -- not counted. Capped at six hours so one forgotten tab cannot skew averages.
  engaged_seconds  integer not null default 0
                   check (engaged_seconds between 0 and 21600)
);

comment on table public.page_views is
  'One row per page view on the public site, with time on screen. No IP, no cookies; visitor_hash rotates daily. Written by /api/track, readable by admins only.';

create index page_views_started_at_idx on public.page_views (started_at desc);
create index page_views_visit_id_idx   on public.page_views (visit_id);

alter table public.page_views enable row level security;

create policy "admin read" on public.page_views
  for select to authenticated using (public.is_admin());

grant select on public.page_views to authenticated;
grant all privileges on public.page_views to service_role;
