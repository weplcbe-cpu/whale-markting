-- Enforce server-side assigned place authorization in submit_marketing_visit_plan RPC
create or replace function public.submit_marketing_visit_plan(
  p_plan jsonb,
  p_submission_key uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_profile public.profiles%rowtype;
  v_plan public.visit_plans%rowtype;
  v_destination_type text := nullif(trim(p_plan->>'destinationType'), '');
  v_visit_date date;
  v_expected_time text := nullif(trim(p_plan->>'expectedTime'), '');
  v_area text := nullif(trim(p_plan->>'area'), '');
  v_authorized_place text := null;
  v_purpose text := nullif(trim(p_plan->>'visitPurpose'), '');
  v_requirement text := nullif(trim(p_plan->>'requirement'), '');
  v_customer_id uuid;
  v_organization_name text := nullif(trim(p_plan->>'organizationName'), '');
  v_products text[] := '{}'::text[];
  v_batch_id uuid := gen_random_uuid();
  v_submitted_at timestamptz := now();
  v_notification_count integer := 0;
begin
  if auth.uid() is null then
    raise exception using
      errcode = '42501',
      message = 'You must be signed in to submit a visit plan.';
  end if;

  select *
  into v_profile
  from public.profiles
  where id = auth.uid()
    and role in ('Marketing', 'Marketing Team')
    and status = 'Active';

  if v_profile.id is null then
    raise exception using
      errcode = '42501',
      message = 'Only an active Marketing employee can submit a visit plan.';
  end if;

  if p_submission_key is null then
    raise exception using
      errcode = '22023',
      message = 'Submission reference is missing.';
  end if;

  -- Serialize requests sharing an idempotency key so concurrent retries cannot
  -- create a second plan or a second set of Director notifications.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_submission_key::text, 0)
  );

  select *
  into v_plan
  from public.visit_plans
  where submission_key = p_submission_key;

  if v_plan.id is not null then
    return jsonb_build_object(
      'success', true,
      'duplicate', true,
      'notificationCount', 0,
      'plan', to_jsonb(v_plan)
    );
  end if;

  if nullif(trim(p_plan->>'visitDate'), '') is null then
    raise exception using
      errcode = '22023',
      message = 'Visit date is required.';
  end if;

  begin
    v_visit_date := (p_plan->>'visitDate')::date;
  exception when others then
    raise exception using
      errcode = '22023',
      message = 'Enter a valid visit date.';
  end;

  if v_expected_time is null then
    raise exception using errcode = '22023', message = 'Expected time is required.';
  end if;
  if v_destination_type is null then
    raise exception using errcode = '22023', message = 'Destination type is required.';
  end if;

  -- The simplified UI calls this option "General Visit"; persist the existing
  -- database-compatible value used by historical plans and its check constraint.
  if v_destination_type = 'General Visit' then
    v_destination_type := 'No Customer / General Visit';
  end if;

  if v_destination_type not in (
    'Existing Customer',
    'New Organization',
    'No Customer / General Visit'
  ) then
    raise exception using
      errcode = '22023',
      message = 'Choose a valid destination type.';
  end if;

  if v_area is null or length(trim(v_area)) = 0 then
    raise exception using errcode = '22023', message = 'Area is required.';
  end if;

  -- Server-side authorization check: verify place is assigned to employee and active
  select evp.place_name
  into v_authorized_place
  from public.employee_visit_places evp
  where evp.employee_id = v_profile.employee_id
    and lower(trim(evp.place_name)) = lower(trim(v_area))
    and evp.is_active = true
  limit 1;

  if v_authorized_place is null then
    raise exception using
      errcode = '42501',
      message = 'The selected visit place is not assigned to your account.';
  end if;

  if v_purpose is null then
    raise exception using errcode = '22023', message = 'Visit purpose is required.';
  end if;

  if nullif(p_plan->>'customerId', '') is not null then
    begin
      v_customer_id := (p_plan->>'customerId')::uuid;
    exception when invalid_text_representation then
      raise exception using
        errcode = '22023',
        message = 'The customer reference is invalid.';
    end;
  end if;

  if jsonb_typeof(p_plan->'products') = 'array' then
    select coalesce(array_agg(product), '{}'::text[])
    into v_products
    from (
      select nullif(trim(value), '') as product
      from jsonb_array_elements_text(p_plan->'products')
    ) products
    where product is not null;
  end if;

  if v_purpose ~* '(product|demo|quotation|sales)'
     and cardinality(v_products) = 0
     and v_requirement is null then
    raise exception using
      errcode = '22023',
      message = 'Select at least one product or enter a requirement for this visit purpose.';
  end if;

  insert into public.visit_plans (
    employee_id,
    employee_name,
    full_name,
    visit_date,
    expected_time,
    destination_type,
    customer_id,
    customer_name,
    organization_name,
    organization_type,
    contact_person,
    mobile_number,
    area,
    city,
    district,
    state,
    visit_purpose,
    products,
    requirement,
    priority,
    notes,
    status,
    batch_id,
    plan_type,
    period_from,
    period_to,
    submitted_at,
    submission_key,
    reschedule_history
  )
  values (
    v_profile.employee_id,
    coalesce(v_profile.full_name, v_profile.username, v_profile.employee_id),
    coalesce(v_profile.full_name, v_profile.username, v_profile.employee_id),
    v_visit_date,
    v_expected_time,
    v_destination_type,
    v_customer_id,
    nullif(trim(p_plan->>'customerName'), ''),
    v_organization_name,
    nullif(trim(p_plan->>'organizationType'), ''),
    nullif(trim(p_plan->>'contactPerson'), ''),
    nullif(trim(p_plan->>'mobileNumber'), ''),
    v_authorized_place,
    coalesce(nullif(trim(p_plan->>'city'), ''), v_authorized_place),
    nullif(trim(p_plan->>'district'), ''),
    nullif(trim(p_plan->>'state'), ''),
    v_purpose,
    v_products,
    v_requirement,
    coalesce(nullif(trim(p_plan->>'priority'), ''), 'Medium'),
    nullif(trim(p_plan->>'notes'), ''),
    'Submitted',
    v_batch_id,
    'Weekly',
    v_visit_date,
    v_visit_date,
    v_submitted_at,
    p_submission_key,
    '[]'::jsonb
  )
  returning * into v_plan;

  insert into public.notifications (
    user_id,
    title,
    message,
    timestamp,
    is_read,
    type,
    created_at,
    updated_at
  )
  select
    director.employee_id,
    'New Visit Plan Submitted',
    coalesce(v_profile.full_name, v_profile.username, v_profile.employee_id)
      || ' submitted a visit plan for ' || v_authorized_place || ' on '
      || to_char(v_visit_date, 'DD-MM-YYYY') || '.',
    to_char(v_submitted_at, 'DD/MM/YYYY, HH12:MI AM'),
    false,
    'plan',
    v_submitted_at,
    v_submitted_at
  from public.profiles director
  where director.role = 'Director'
    and director.status = 'Active'
    and director.employee_id is not null;

  get diagnostics v_notification_count = row_count;

  return jsonb_build_object(
    'success', true,
    'duplicate', false,
    'notificationCount', v_notification_count,
    'plan', to_jsonb(v_plan)
  );
end;
$$;

revoke all on function public.submit_marketing_visit_plan(jsonb, uuid)
from public, anon;

grant execute on function public.submit_marketing_visit_plan(jsonb, uuid)
to authenticated;

notify pgrst, 'reload schema';
