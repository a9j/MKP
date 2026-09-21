-- Recommended starting coverage rules for Phase One (TPS Board only).
-- This is editorial policy, not schema. Review it, change the numbers if you want,
-- have the MKP board adopt it, then run it once as an admin in the SQL editor.
-- Active rules are public. They show on the Our Method page.

insert into public.coverage_rules (body_id, name, description, min_amount, item_type, sort_order)
select b.id, r.name, r.description, r.min_amount, r.item_type, r.sort_order
from public.bodies b
cross join (values
  ('Money: $100,000 or more',
   'MKP explains every TPS Board item where the source document states a dollar amount of $100,000 or more.',
   100000::numeric, null::text, 10),
  ('Employee contracts',
   'MKP explains every item that approves, changes, or extends an agreement with an employee group.',
   null, 'employee_contract', 20),
  ('Pay and staffing',
   'MKP explains every item that changes a salary schedule, adds or cuts positions, or approves a reduction in force.',
   null, 'pay_staffing', 30),
  ('Levy actions',
   'MKP explains every resolution that places, renews, or changes a levy.',
   null, 'levy', 40)
) as r(name, description, min_amount, item_type, sort_order)
where b.slug = 'tps-board';
