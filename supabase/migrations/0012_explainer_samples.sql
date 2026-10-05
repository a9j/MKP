-- 0012_explainer_samples
-- One sample of each explainer template, so the admin forms and the preview
-- have something to show. Every row is a draft with is_sample = true, so it
-- can never reach the public site: explainer_problems() refuses to publish a
-- sample, and explainers_public and the public read policies exclude them.
--
-- The text is placeholder on purpose. None of it describes a real place,
-- levy or contract, and the links point at example.com.
--
-- Safe to run twice. Delete the three rows from /admin once you no longer
-- need them; their issues, figures, events and sources go with them.

do $$
declare
  v_ballot   uuid;
  v_levy     uuid;
  v_contract uuid;
  v_src      uuid;
  v_src2     uuid;
begin
  if exists (select 1 from public.explainers where is_sample) then
    return;
  end if;

  -- Levy first, so the ballot sample can link to it.
  insert into public.explainers (slug, kind, template, title, summary_30s, decision_date, is_sample)
  values (
    'sample-levy-example-school-district', 'levy', 'levy',
    'Sample Levy, Example School District',
    'This is a sample levy page. Example School District is asking voters to renew a property tax that pays for building repairs. The numbers below are made up so you can see how the page works.',
    '2026-11-03', true)
  returning id into v_levy;

  insert into public.explainer_sources (explainer_id, label, url, document_date, note, sort_order)
  values (v_levy, 'Sample ballot language', 'https://example.com/sample-ballot-language.pdf', '2026-08-01',
          'Placeholder link for the sample.', 0)
  returning id into v_src;

  insert into public.explainer_sources (explainer_id, label, url, document_date, note, sort_order)
  values (v_levy, 'Sample county auditor certificate', 'https://example.com/sample-auditor-certificate.pdf', '2026-07-15',
          'Placeholder link for the sample.', 1)
  returning id into v_src2;

  insert into public.levy_details (
    explainer_id, district_or_body, levy_kind, mills, years, purpose,
    estimated_annual_revenue, cost_per_100k, mills_source_id, revenue_source_id, cost_source_id)
  values (
    v_levy, 'Example School District', 'renewal', 2.5, 5,
    'Repairs to roofs, boilers and windows in district buildings.',
    1000000, 87.5, v_src, v_src2, v_src2);

  -- Ballot.
  insert into public.explainers (slug, kind, template, title, summary_30s, decision_date, is_sample)
  values (
    'sample-ballot-example-county', 'ballot_issue', 'ballot',
    'Sample Ballot, Example County',
    'This is a sample ballot page. It shows two made up issues so you can see how each card looks. Nothing on this page is a real ballot issue.',
    '2026-11-03', true)
  returning id into v_ballot;

  insert into public.explainer_sources (explainer_id, label, url, document_date, note, sort_order)
  values (v_ballot, 'Sample board of elections list', 'https://example.com/sample-issue-list.pdf', '2026-08-20',
          'Placeholder link for the sample.', 0)
  returning id into v_src;

  insert into public.ballot_issues (
    explainer_id, issue_number, title, jurisdiction, what_yes_means, what_no_means,
    cost_note, cost_source_id, linked_levy_explainer_id, sort_order)
  values
    (v_ballot, 'Issue 1', 'Sample school levy renewal', 'Example School District',
     'A yes vote keeps the current building repair tax for five more years.',
     'A no vote lets the tax end when it expires.',
     'Sample figure: about $87 a year for each $100,000 of home value.', v_src, v_levy, 0),
    (v_ballot, 'Issue 2', 'Sample charter change', 'Example City',
     'A yes vote changes when the city council holds its first meeting of the year.',
     'A no vote keeps the meeting schedule as it is now.',
     'No cost.', null, null, 1);

  -- Contract tracker.
  insert into public.explainers (slug, kind, template, title, summary_30s, current_status, is_sample)
  values (
    'sample-contract-example-district-and-union', 'contract', 'contract',
    'Sample Contract Talks, Example District and Example Union',
    'This is a sample contract tracker. It follows made up talks between a district and a union so you can see how the timeline looks.',
    'Talks ongoing', true)
  returning id into v_contract;

  insert into public.explainer_sources (explainer_id, label, url, document_date, note, sort_order)
  values (v_contract, 'Sample board meeting minutes', 'https://example.com/sample-minutes.pdf', '2026-09-15',
          'Placeholder link for the sample.', 0)
  returning id into v_src;

  insert into public.contract_events (explainer_id, event_date, event_type, headline, description, source_id, sort_order)
  values
    (v_contract, '2026-08-04', 'talks_opened', 'Sample: talks open',
     'The district and the union met for the first time to set ground rules.', v_src, 0),
    (v_contract, '2026-09-01', 'offer', 'Sample: the district makes an offer',
     'The district proposed a two year contract. The details here are placeholders.', v_src, 0),
    (v_contract, '2026-09-22', 'counteroffer', 'Sample: the union responds',
     'The union answered with its own proposal. The details here are placeholders.', v_src, 0);
end;
$$;
