create or replace function public.request_tour_plan_changes(
  p_batch_id uuid,
  p_comment text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_director_id text;
  v_director_name text;
  v_employee_id text;
  v_employee_name text;
  v_plan_type text;
  v_period_from date;
  v_period_to date;
  v_reviewed_at timestamptz := now();
  v_updated_count integer;
  v_period_label text;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'You must be signed in to review a tour plan.';
  end if;

  select profile.employee_id, profile.full_name
  into v_director_id, v_director_name
  from public.profiles profile
  where profile.id = auth.uid()
    and profile.role in ('Admin', 'Director')
    and profile.status = 'Active';

  if v_director_id is null then
    raise exception using errcode = '42501', message = 'Only an active Director or Admin can request tour plan changes.';
  end if;

  if p_batch_id is null then
    raise exception using errcode = '22023', message = 'Unable to identify this tour plan. Please reopen the plan and try again.';
  end if;

  if nullif(trim(p_comment), '') is null then
    raise exception using errcode = '22023', message = 'Please enter a reason before requesting changes.';
  end if;

  select plan.employee_id, coalesce(plan.full_name, profile.full_name, profile.username, plan.employee_id),
         coalesce(plan.plan_type, 'Weekly'), plan.period_from, plan.period_to
  into v_employee_id, v_employee_name, v_plan_type, v_period_from, v_period_to
  from public.visit_plans plan
  left join public.profiles profile on profile.employee_id = plan.employee_id
  where plan.batch_id = p_batch_id
  limit 1;

  if v_employee_id is null then
    raise exception using errcode = 'P0002', message = 'Unable to identify this tour plan. Please reopen the plan and try again.';
  end if;

  update public.visit_plans plan
  set status = 'Changes Requested',
      reviewed_by = v_director_id,
      reviewed_at = v_reviewed_at,
      review_comment = trim(p_comment),
      review_history = coalesce(plan.review_history, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
        'status', 'Changes Requested',
        'comment', trim(p_comment),
        'reviewedBy', v_director_id,
        'reviewedAt', v_reviewed_at
      )),
      updated_at = v_reviewed_at
  where plan.batch_id = p_batch_id
    and lower(trim(plan.status)) in ('pending approval', 'submitted', 'submitted for director approval');

  get diagnostics v_updated_count = row_count;
  if v_updated_count = 0 then
    raise exception using errcode = 'P0001', message = 'This tour plan is no longer awaiting review. Refresh and try again.';
  end if;

  insert into public.director_comments (
    author, author_role, target_employee_id, target_employee_name,
    target_module, reference_id, message, created_at, updated_at,
    is_read, replies
  ) values (
    v_director_name, 'Director', v_employee_id, v_employee_name,
    'Tour Plan', p_batch_id::text, trim(p_comment), v_reviewed_at,
    v_reviewed_at, false, '[]'::jsonb
  );

  v_period_label := case
    when v_period_from is not null then to_char(v_period_from, 'FMMonth YYYY')
    else lower(v_plan_type)
  end;

  insert into public.notifications (
    user_id, title, message, timestamp, is_read, type, created_at, updated_at
  ) values (
    v_employee_id,
    'Tour plan changes requested',
    'Director requested changes to your ' || v_period_label || ' tour plan.',
    to_char(v_reviewed_at, 'DD/MM/YYYY, HH12:MI AM'),
    false,
    'plan',
    v_reviewed_at,
    v_reviewed_at
  );

  insert into public.activity_logs (user_label, module, action, timestamp, created_at)
  values (
    v_director_name || ' (' || v_director_id || ')',
    'Tour Plan Review',
    'Director requested changes to ' || v_employee_name || '''s ' || v_period_label || ' tour plan.',
    to_char(v_reviewed_at, 'DD/MM/YYYY, HH12:MI AM'),
    v_reviewed_at
  );

  return jsonb_build_object(
    'success', true,
    'batchId', p_batch_id,
    'employeeId', v_employee_id,
    'status', 'Changes Requested',
    'updatedEntries', v_updated_count
  );
end;
$$;

revoke all on function public.request_tour_plan_changes(uuid, text) from public, anon;
grant execute on function public.request_tour_plan_changes(uuid, text) to authenticated;
