-- 0009_ballot_explainer
-- Add the 'ballot_explainer' report type for ballot issues that are not
-- school levies: library levies, income taxes, charter amendments,
-- statewide issues, and anything else that appears on a Toledo ballot.
--
-- Why convert instead of ALTER TYPE ... ADD VALUE:
-- Postgres forbids ALTER TYPE ... ADD VALUE inside a transaction block,
-- which is how `supabase db push` applies migrations. Converting the
-- column to text with a CHECK constraint keeps this migration
-- transaction-safe and makes future type additions one-line changes.

alter table public.reports alter column type drop default;

alter table public.reports alter column type type text using type::text;

drop type public.report_type;

alter table public.reports
  add constraint reports_type_check
  check (type in (
    'pay_report',
    'levy_explainer',
    'contract_tracker',
    'ballot_explainer'
  ));
