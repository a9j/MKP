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
--
-- Guarded so it can run twice. Production had this applied by hand before it
-- was recorded as a migration, and on a fresh database the latest_feed view
-- depends on reports.type, which blocks the column change. The view is saved,
-- dropped, and recreated from its own definition with its grant restored.

do $$
declare
  v_feed text;
begin
  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public' and table_name = 'reports'
       and column_name = 'type' and udt_name = 'report_type'
  ) then
    v_feed := pg_get_viewdef('public.latest_feed'::regclass, true);
    drop view public.latest_feed;

    alter table public.reports alter column type drop default;
    alter table public.reports alter column type type text using type::text;
    drop type public.report_type;

    execute 'create view public.latest_feed with (security_invoker = true) as ' || v_feed;
    grant select on public.latest_feed to anon, authenticated;
  end if;

  if not exists (
    select 1 from pg_constraint
     where conname = 'reports_type_check' and conrelid = 'public.reports'::regclass
  ) then
    alter table public.reports
      add constraint reports_type_check
      check (type in (
        'pay_report',
        'levy_explainer',
        'contract_tracker',
        'ballot_explainer'
      ));
  end if;
end;
$$;
