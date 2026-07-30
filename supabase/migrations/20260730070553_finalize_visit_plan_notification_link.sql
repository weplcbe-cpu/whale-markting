-- Keep the existing submission RPC while tightening the
-- notification contract: one Director notification, exact time, and an
-- addressable visit-plan reference.
do $migration$
declare
  definition text;
  original_definition text;
begin
  select pg_get_functiondef(
    'public.submit_marketing_visit_plan(jsonb,uuid)'::regprocedure
  )
  into definition;

  original_definition := definition;

  definition := replace(
    definition,
    '|| to_char(v_visit_date, ''DD-MM-YYYY'') || ''.'',',
    '|| to_char(v_visit_date, ''DD-MM-YYYY'') || '' at '' || v_expected_time || ''.'','
  );

  definition := replace(
    definition,
    'type,
    created_at,
    updated_at
  )',
    'type,
    created_at,
    updated_at,
    reference_id
  )'
  );

  definition := replace(
    definition,
    '''plan'',
    v_submitted_at,
    v_submitted_at
  from public.profiles director',
    '''plan'',
    v_submitted_at,
    v_submitted_at,
    v_plan.id::text
  from public.profiles director'
  );

  definition := replace(
    definition,
    'and director.employee_id is not null;',
    'and director.employee_id is not null
  order by director.created_at, director.employee_id
  limit 1;'
  );

  if definition = original_definition
     or position('reference_id' in definition) = 0
     or position('v_plan.id::text' in definition) = 0
     or position('limit 1' in definition) = 0 then
    raise exception 'Unable to update submit_marketing_visit_plan notification contract.';
  end if;

  execute definition;
end
$migration$;

create unique index if not exists notifications_visit_plan_reference_key
  on public.notifications(type, reference_id)
  where reference_id is not null and type = 'plan';

notify pgrst, 'reload schema';
