create or replace function public.review_tour_plan_batch(
  p_batch_id uuid,
  p_action text,
  p_comment text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_action text := initcap(lower(trim(p_action)));
  v_comment text := nullif(trim(coalesce(p_comment, '')), '');
  v_director_id text;
  v_director_name text;
  v_employee_id text;
  v_employee_name text;
  v_plan_type text;
  v_period_from date;
  v_reviewed_at timestamptz := now();
  v_updated_count integer;
  v_message text;
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
    raise exception using errcode = '42501', message = 'Only an active Director or Admin can review tour plans.';
  end if;

  if p_batch_id is null then
    raise exception using errcode = '22023', message = 'Unable to identify this tour plan. Please reopen the plan and try again.';
  end if;

  if v_action not in ('Approved', 'Rejected') then
    raise exception using errcode = '22023', message = 'Unsupported tour plan review action.';
  end if;

  if v_action = 'Rejected' and v_comment is null then
    raise exception using errcode = '22023', message = 'Please enter a reason for rejecting this plan.';
  end if;

  select plan.employee_id,
         coalesce(plan.full_name, profile.full_name, profile.username, plan.employee_id),
         coalesce(plan.plan_type, 'Weekly'),
         plan.period_from
  into v_employee_id, v_employee_name, v_plan_type, v_period_from
  from public.visit_plans plan
  left join public.profiles profile on profile.employee_id = plan.employee_id
  where plan.batch_id = p_batch_id
  limit 1;

  if v_employee_id is null then
    raise exception using errcode = 'P0002', message = 'Unable to identify this tour plan. Please reopen the plan and try again.';
  end if;

  update public.visit_plans plan
  set status = v_action,
      reviewed_by = v_director_id,
      reviewed_at = v_reviewed_at,
      review_comment = v_comment,
      review_history = coalesce(plan.review_history, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
        'status', v_action,
        'comment', coalesce(v_comment, ''),
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

  if v_comment is not null then
    insert into public.director_comments (
      author, author_role, target_employee_id, target_employee_name,
      target_module, reference_id, message, created_at, updated_at,
      is_read, replies
    ) values (
      v_director_name, 'Director', v_employee_id, v_employee_name,
      'Tour Plan', p_batch_id::text, v_comment, v_reviewed_at,
      v_reviewed_at, false, '[]'::jsonb
    );
  end if;

  v_message := case
    when v_action = 'Approved' then 'Your tour plan has been approved by the Director.'
    else 'Your tour plan was rejected by the Director.'
  end;
  if v_comment is not null then
    v_message := v_message || ' Comment: ' || v_comment;
  end if;

  insert into public.notifications (
    user_id, title, message, timestamp, is_read, type, created_at, updated_at
  ) values (
    v_employee_id,
    case when v_action = 'Approved' then 'Tour plan approved' else 'Tour plan rejected' end,
    v_message,
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
    v_director_name || ' marked ' || v_employee_name || '''s ' || coalesce(to_char(v_period_from, 'FMMonth YYYY'), lower(v_plan_type)) || ' tour plan as ' || v_action || '.',
    to_char(v_reviewed_at, 'DD/MM/YYYY, HH12:MI AM'),
    v_reviewed_at
  );

  return jsonb_build_object(
    'success', true,
    'batchId', p_batch_id,
    'employeeId', v_employee_id,
    'status', v_action,
    'updatedEntries', v_updated_count,
    'commentSaved', v_comment is not null
  );
end;
$$;

revoke all on function public.review_tour_plan_batch(uuid, text, text) from public, anon;
grant execute on function public.review_tour_plan_batch(uuid, text, text) to authenticated;
