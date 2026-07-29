-- Preserve destination and meeting details for customer, prospect, and
-- customer-independent Marketing visits. Existing RLS and approval policies
-- remain unchanged.
alter table public.visit_plans
  add column if not exists destination_type text,
  add column if not exists organization_name text,
  add column if not exists is_important boolean not null default false,
  add column if not exists submission_key uuid;

alter table public.visit_plans
  drop constraint if exists visit_plans_destination_type_check;

alter table public.visit_plans
  add constraint visit_plans_destination_type_check
  check (
    destination_type is null or
    destination_type in ('Existing Customer', 'New Organization', 'No Customer / General Visit')
  );

create unique index if not exists visit_plans_submission_key_idx
  on public.visit_plans (submission_key)
  where submission_key is not null;

create index if not exists visit_plans_director_destination_queue_idx
  on public.visit_plans (status, visit_date, area);

-- Existing records were customer-led, so label them without changing their
-- customer link or approval state.
update public.visit_plans
set destination_type = case
  when customer_id is not null then 'Existing Customer'
  when nullif(trim(customer_name), '') is not null then 'New Organization'
  else 'No Customer / General Visit'
end,
organization_name = case
  when customer_id is null then customer_name
  else organization_name
end
where destination_type is null;

create or replace function public.submit_marketing_visit_plan(
  p_plan jsonb,
  p_submission_key uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
  v_plan public.visit_plans%rowtype;
  v_destination_type text := nullif(trim(p_plan->>'destinationType'), '');
  v_visit_date date;
  v_expected_time text := nullif(trim(p_plan->>'expectedTime'), '');
  v_area text := nullif(trim(p_plan->>'area'), '');
  v_purpose text := nullif(trim(p_plan->>'visitPurpose'), '');
  v_requirement text := nullif(trim(p_plan->>'requirement'), '');
  v_customer_id uuid;
  v_organization_name text := nullif(trim(p_plan->>'organizationName'), '');
  v_products text[] := array(select jsonb_array_elements_text(coalesce(p_plan->'products', '[]'::jsonb)));
  v_batch_id uuid := gen_random_uuid();
  v_submitted_at timestamptz := now();
  v_notification_count integer;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'You must be signed in to submit a visit plan.';
  end if;

  select * into v_profile
  from public.profiles
  where id = auth.uid()
    and role in ('Marketing', 'Marketing Team')
    and status = 'Active';

  if v_profile.id is null then
    raise exception using errcode = '42501', message = 'Only an active Marketing employee can submit a visit plan.';
  end if;

  if p_submission_key is null then
    raise exception using errcode = '22023', message = 'Submission reference is missing.';
  end if;

  select * into v_plan
  from public.visit_plans
  where submission_key = p_submission_key;

  if v_plan.id is not null then
    return jsonb_build_object('success', true, 'duplicate', true, 'plan', to_jsonb(v_plan));
  end if;

  begin
    v_visit_date := (p_plan->>'visitDate')::date;
  exception when others then
    raise exception using errcode = '22023', message = 'Visit date is required.';
  end;

  if v_destination_type not in ('Existing Customer', 'New Organization', 'No Customer / General Visit') then
    raise exception using errcode = '22023', message = 'Choose where you are going.';
  end if;
  if v_expected_time is null or v_area is null or v_purpose is null or v_requirement is null then
    raise exception using errcode = '22023', message = 'Date, time, area, purpose, and requirement are required.';
  end if;

  if nullif(p_plan->>'customerId', '') is not null then
    v_customer_id := (p_plan->>'customerId')::uuid;
  end if;
  if v_destination_type = 'Existing Customer' and v_customer_id is null then
    raise exception using errcode = '22023', message = 'Choose an existing customer.';
  end if;
  if v_destination_type = 'New Organization' and v_organization_name is null then
    raise exception using errcode = '22023', message = 'Organization name is required.';
  end if;
  if v_purpose ~* '(product|demo|quotation|sales)' and cardinality(v_products) = 0 and v_requirement is null then
    raise exception using errcode = '22023', message = 'Select a product or describe the custom requirement.';
  end if;

  insert into public.visit_plans (
    employee_id, full_name, visit_date, expected_time, destination_type,
    customer_id, customer_name, organization_name, organization_type,
    contact_person, mobile_number, area, city, district, state,
    visit_purpose, products, requirement, priority, notes, status,
    batch_id, plan_type, period_from, period_to, submitted_at,
    submission_key, reschedule_history
  ) values (
    v_profile.employee_id, coalesce(v_profile.full_name, v_profile.username),
    v_visit_date, v_expected_time, v_destination_type, v_customer_id,
    nullif(trim(p_plan->>'customerName'), ''), v_organization_name,
    nullif(trim(p_plan->>'organizationType'), ''),
    nullif(trim(p_plan->>'contactPerson'), ''),
    nullif(trim(p_plan->>'mobileNumber'), ''),
    v_area, nullif(trim(p_plan->>'city'), ''),
    nullif(trim(p_plan->>'district'), ''), nullif(trim(p_plan->>'state'), ''),
    v_purpose, v_products, v_requirement,
    coalesce(nullif(trim(p_plan->>'priority'), ''), 'Medium'),
    nullif(trim(p_plan->>'notes'), ''), 'Pending Approval',
    v_batch_id, 'Weekly', v_visit_date, v_visit_date, v_submitted_at,
    p_submission_key, '[]'::jsonb
  )
  returning * into v_plan;

  insert into public.notifications (
    user_id, title, message, timestamp, is_read, type, created_at, updated_at
  )
  select profile.employee_id,
         'Visit plan awaiting review',
         coalesce(v_profile.full_name, v_profile.username, v_profile.employee_id)
           || ' submitted a visit plan for ' || v_area || ' on '
           || to_char(v_visit_date, 'DD-MM-YYYY') || '.',
         to_char(v_submitted_at, 'DD/MM/YYYY, HH12:MI AM'),
         false, 'plan', v_submitted_at, v_submitted_at
  from public.profiles profile
  where profile.role = 'Director'
    and profile.status = 'Active'
    and profile.employee_id is not null;

  get diagnostics v_notification_count = row_count;

  return jsonb_build_object(
    'success', true,
    'duplicate', false,
    'notificationCount', v_notification_count,
    'plan', to_jsonb(v_plan)
  );
end;
$$;

revoke all on function public.submit_marketing_visit_plan(jsonb, uuid) from public, anon;
grant execute on function public.submit_marketing_visit_plan(jsonb, uuid) to authenticated;
