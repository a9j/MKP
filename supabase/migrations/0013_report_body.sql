-- 0013_report_body
-- The full text of a report, in markdown, so explainers read on the page
-- instead of only inside a PDF. The summary stays short (the lede and the
-- card text); the body is the whole explainer. The PDF becomes an optional
-- download alongside it.

alter table public.reports add column if not exists body text;

comment on column public.reports.body is
  'Full report text in markdown, rendered on /reports/[slug]. Optional; the PDF is a download alongside it.';
