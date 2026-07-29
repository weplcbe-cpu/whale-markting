-- Finalize the view-only Marketing Visit Plan -> Director workflow.
-- This does not change RLS. It preserves the existing idempotency key and
-- replaces only the submission transaction's validation/status/notification.
alter table public.visit_plans
  add column if not exists employee_name text;

update public.visit_plans
set employee_name = full_name
where employee_name is null
  and full_name is not null;

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
  v_destination_type text := coalesce(nullif(trim(p_plan->>'destinationType'), ''), 'No Customer / General Visit');
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
  v_director_id text;
  v_notification_count integer := 0;
  v_notification_error text;
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
    return jsonb_build_object(
      'success', true,
      'duplicate', true,
      'notificationCount', 0,
      'plan', to_jsonb(v_plan)
    );
  end if;

  begin
    v_visit_date := (p_plan->>'visitDate')::date;
  exception when others then
    raise exception using errcode = '22023', message = 'Visit date is required.';
  end;

  if v_expected_time is null or v_area is null or v_purpose is null then
    raise exception using errcode = '22023', message = 'Visit date, time, area, and purpose are required.';
  end if;
  if v_destination_type not in ('Existing Customer', 'New Organization', 'No Customer / General Visit') then
    raise exception using errcode = '22023', message = 'Choose a valid destination type.';
  end if;
  if nullif(p_plan->>'customerId', '') is not null then
    v_customer_id := (p_plan->>'customerId')::uuid;
  end if;
  if v_purpose ~* '(product|demo|quotation|sales)' and cardinality(v_products) = 0 then
    raise exception using errcode = '22023', message = 'Select at least one product for this visit purpose.';
  end if;

  insert into public.visit_plans (
    employee_id, employee_name, full_name, visit_date, expected_time,
    destination_type, customer_id, customer_name, organization_name,
    organization_type, contact_person, mobile_number, area, city, district,
    state, visit_purpose, products, requirement, priority, notes, status,
    batch_id, plan_type, period_from, period_to, submitted_at,
    submission_key, reschedule_history
  ) values (
    v_profile.employee_id,
    coalesce(v_profile.full_name, v_profile.username, v_profile.employee_id),
    coalesce(v_profile.full_name, v_profile.username, v_profile.employee_id),
    v_visit_date, v_expected_time, v_destination_type, v_customer_id,
    nullif(trim(p_plan->>'customerName'), ''), v_organization_name,
    nullif(trim(p_plan->>'organizationType'), ''),
    nullif(trim(p_plan->>'contactPerson'), ''),
    nullif(trim(p_plan->>'mobileNumber'), ''),
    v_area, nullif(trim(p_plan->>'city'), ''),
    nullif(trim(p_plan->>'district'), ''), nullif(trim(p_plan->>'state'), ''),
    v_purpose, v_products, v_requirement,
    coalesce(nullif(trim(p_plan->>'priority'), ''), 'Medium'),
    nullif(trim(p_plan->>'notes'), ''), 'Submitted',
    v_batch_id, 'Weekly', v_visit_date, v_visit_date, v_submitted_at,
    p_submission_key, '[]'::jsonb
  )
  returning * into v_plan;

  -- Notification is intentionally best-effort. A notification failure must not
  -- roll back or duplicate the already-saved visit plan.
  begin
    select profile.employee_id into v_director_id
    from public.profiles profile
    where profile.role = 'Director'
      and profile.status = 'Active'
      and profile.employee_id is not null
    order by profile.created_at, profile.employee_id
    limit 1;

    if v_director_id is not null then
      insert into public.notifications (
        user_id, title, message, timestamp, is_read, type, created_at, updated_at
      ) values (
        v_director_id,
        'Visit plan submitted',
        coalesce(v_profile.full_name, v_profile.username, v_profile.employee_id)
          || ' submitted a visit plan for ' || v_area || ' on '
          || to_char(v_visit_date, 'DD-MM-YYYY') || '.',
        to_char(v_submitted_at, 'DD/MM/YYYY, HH12:MI AM'),
        false, 'plan', v_submitted_at, v_submitted_at
      );
      v_notification_count := 1;
    end if;
  exception when others then
    v_notification_error := sqlerrm;
    begin
      insert into public.activity_logs (user_label, module, action, timestamp, created_at)
      values (
        coalesce(v_profile.full_name, v_profile.username, v_profile.employee_id)
          || ' (' || v_profile.employee_id || ')',
        'Visit Plan',
        'Visit plan saved, but the Director notification failed: ' || v_notification_error,
        to_char(v_submitted_at, 'DD/MM/YYYY, HH12:MI AM'),
        v_submitted_at
      );
    exception when others then
      null;
    end;
  end;

  return jsonb_build_object(
    'success', true,
    'duplicate', false,
    'notificationCount', v_notification_count,
    'notificationError', v_notification_error,
    'plan', to_jsonb(v_plan)
  );
end;
$$;

revoke all on function public.submit_marketing_visit_plan(jsonb, uuid) from public, anon;
grant execute on function public.submit_marketing_visit_plan(jsonb, uuid) to authenticated;
