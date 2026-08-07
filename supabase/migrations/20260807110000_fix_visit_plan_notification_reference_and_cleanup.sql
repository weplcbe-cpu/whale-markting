-- Ensure visit-plan submission notifications keep reference_id linkage and add
-- 24-hour automatic cleanup for notifications.

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
    updated_at,
    reference_id
  )
  select
    director.employee_id,
    'New Visit Plan Submitted',
    coalesce(v_profile.full_name, v_profile.username, v_profile.employee_id)
      || ' submitted a visit plan for ' || v_authorized_place || ' on '
      || to_char(v_visit_date, 'DD Mon YYYY') || '.',
    to_char(v_submitted_at, 'DD/MM/YYYY, HH12:MI AM'),
    false,
    'plan',
    v_submitted_at,
    v_submitted_at,
    v_plan.id::text
  from public.profiles director
  where director.role = 'Director'
    and director.status = 'Active'
    and director.employee_id is not null
  order by director.created_at, director.employee_id
  limit 1;

  get diagnostics v_notification_count = row_count;

  return jsonb_build_object(
    'success', true,
    'duplicate', false,
    'notificationCount', v_notification_count,
    'plan', to_jsonb(v_plan)
  );
end;
$$;

create index if not exists idx_notifications_created_at
  on public.notifications(created_at);

create or replace function public.cleanup_expired_notifications()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted_count integer;
begin
  delete from public.notifications
  where created_at < now() - interval '24 hours';

  get diagnostics v_deleted_count = row_count;
  return v_deleted_count;
end;
$$;

revoke all on function public.cleanup_expired_notifications() from public, anon, authenticated;

-- Schedule hourly cleanup when pg_cron is available. If pg_cron is not enabled
-- in this environment, creation is skipped and the callable cleanup function
-- remains available for external schedulers.
do $$
declare
  v_has_pg_cron boolean;
begin
  select exists (
    select 1
    from pg_extension
    where extname = 'pg_cron'
  ) into v_has_pg_cron;

  if v_has_pg_cron then
    if not exists (
      select 1
      from cron.job
      where jobname = 'cleanup_expired_notifications_hourly'
    ) then
      perform cron.schedule(
        'cleanup_expired_notifications_hourly',
        '5 * * * *',
        $cron$select public.cleanup_expired_notifications();$cron$
      );
    end if;
  end if;
end;
$$;

notify pgrst, 'reload schema';
