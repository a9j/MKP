-- Phase 2, step 3: what an explainer has to answer.
--
-- A ballot explainer is not a free form report. Every one answers the same
-- three questions in the same order, so a reader who has read one knows where
-- to look in the next, and so a question cannot be quietly left out because it
-- was the awkward one. The three are required of an explainer by the form; a
-- fourth, what it costs a homeowner, is optional because the county auditor's
-- certification is not always out when the explainer is written.
--
-- The columns are nullable at the database level because every other report
-- type leaves them empty. The requirement belongs to the form, which knows
-- which type is being saved.
--
-- Guarded so it can run twice: these were applied to the live project by hand
-- before the file was renumbered to sit after the templated explainer
-- migrations, the same situation 0009 documents.

alter table public.reports
  add column if not exists ballot_date    date,
  add column if not exists issue_number   text,
  add column if not exists asks_for       text,
  add column if not exists funds          text,
  add column if not exists if_fails       text,
  add column if not exists homeowner_cost text;

comment on column public.reports.ballot_date is
  'The date of the election this explainer is for. A date in the future is what puts it under the "On the ballot" heading on /reports.';
comment on column public.reports.issue_number is
  'As the ballot prints it, for example "Issue 12". Text, because an issue is an identifier and some are lettered.';
comment on column public.reports.asks_for is
  'Markdown. What the issue asks for. Required of an explainer.';
comment on column public.reports.funds is
  'Markdown. What it would fund. Required of an explainer.';
comment on column public.reports.if_fails is
  'Markdown. What happens if it fails. Required of an explainer.';
comment on column public.reports.homeowner_cost is
  'Markdown. What it costs a homeowner. Optional, and must cite the county auditor''s certification when it is filled in.';

-- A ballot date without an issue number, or the other way round, is a half
-- entered explainer rather than a deliberate state. Either both or neither.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'reports_ballot_identity_complete'
       and conrelid = 'public.reports'::regclass
  ) then
    alter table public.reports
      add constraint reports_ballot_identity_complete
      check (
        (ballot_date is null and issue_number is null)
        or (ballot_date is not null and length(btrim(issue_number)) > 0)
      );
  end if;
end;
$$;
