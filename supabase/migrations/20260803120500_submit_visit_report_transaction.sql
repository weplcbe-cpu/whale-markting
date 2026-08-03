-- Complete a Marketing visit atomically: report, plan status, Director
-- notification, and optional follow-up either all commit or all roll back.

create unique index if not exists visit_reports_one_per_plan_key
  on public.visit_reports (visit_plan_id)
  where visit_plan_id is not null;

create or replace function public.submit_visit_report(
  p_visit_plan_id uuid,
  p_report jsonb
)
returns public.visit_reports
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor public.profiles%rowtype;
  v_plan public.visit_plans%rowtype;
  v_report public.visit_reports%rowtype;
  v_director_employee_id text;
  v_discussion_notes text;
  v_follow_up_required boolean;
  v_follow_up_date date;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'REPORT_AUTH_REQUIRED';
  end if;

  select profile.*
  into v_actor
  from public.profiles profile
  where profile.id = auth.uid()
    and profile.status = 'Active';

  if not found then
    raise exception using errcode = '42501', message = 'REPORT_PROFILE_INACTIVE';
  end if;

  if v_actor.role not in ('Marketing', 'Marketing Team') then
    raise exception using errcode = '42501', message = 'REPORT_MARKETING_ONLY';
  end if;

  select plan.*
  into v_plan
  from public.visit_plans plan
  where plan.id = p_visit_plan_id
    and plan.employee_id = v_actor.employee_id
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'VISIT_PLAN_NOT_OWNED';
  end if;

  -- A retry after a committed response-loss returns the original report and
  -- cannot create duplicate reports, notifications, or follow-ups.
  select report.*
  into v_report
  from public.visit_reports report
  where report.visit_plan_id = v_plan.id;

  if found then
    return v_report;
  end if;

  if lower(coalesce(v_plan.status, '')) <> 'started' then
    raise exception using errcode = '55000', message = 'VISIT_PLAN_NOT_STARTED';
  end if;

  v_discussion_notes := nullif(btrim(p_report ->> 'discussion_notes'), '');
  if v_discussion_notes is null then
    raise exception using errcode = '22023', message = 'DISCUSSION_NOTES_REQUIRED';
  end if;

  begin
    v_follow_up_required := coalesce((p_report ->> 'is_follow_up_required')::boolean, false);
    v_follow_up_date := nullif(p_report ->> 'follow_up_date', '')::date;
  exception when invalid_text_representation or datetime_field_overflow then
    raise exception using errcode = '22023', message = 'INVALID_VISIT_REPORT_PAYLOAD';
  end;

  if v_follow_up_required and v_follow_up_date is null then
    raise exception using errcode = '22023', message = 'FOLLOW_UP_DATE_REQUIRED';
  end if;

  insert into public.visit_reports (
    visit_plan_id,
    employee_id,
    full_name,
    visit_date,
    customer_name,
    meeting_completed,
    actual_time,
    customer_response,
    discussion_notes,
    interested_products,
    requirement_details,
    next_action,
    is_follow_up_required,
    follow_up_date,
    is_quotation_required,
    is_tender_related,
    photos,
    documents,
    final_status,
    submitted_at,
    is_locked
  ) values (
    v_plan.id,
    v_actor.employee_id,
    v_actor.full_name,
    v_plan.visit_date,
    coalesce(v_plan.customer_name, p_report ->> 'customer_name'),
    coalesce((p_report ->> 'meeting_completed')::boolean, true),
    nullif(p_report ->> 'actual_time', ''),
    nullif(p_report ->> 'customer_response', ''),
    v_discussion_notes,
    case when jsonb_typeof(p_report -> 'interested_products') = 'array'
      then array(select jsonb_array_elements_text(p_report -> 'interested_products'))
      else '{}'::text[] end,
    nullif(p_report ->> 'requirement_details', ''),
    nullif(p_report ->> 'next_action', ''),
    v_follow_up_required,
    v_follow_up_date,
    coalesce((p_report ->> 'is_quotation_required')::boolean, false),
    false,
    case when jsonb_typeof(p_report -> 'photos') = 'array'
      then array(select jsonb_array_elements_text(p_report -> 'photos'))
      else '{}'::text[] end,
    case when jsonb_typeof(p_report -> 'documents') = 'array'
      then array(select jsonb_array_elements_text(p_report -> 'documents'))
      else '{}'::text[] end,
    coalesce(nullif(p_report ->> 'final_status', ''), 'Completed'),
    now(),
    false
  )
  returning * into v_report;

  update public.visit_plans
  set status = 'Completed', updated_at = now()
  where id = v_plan.id;

  select director.employee_id
  into v_director_employee_id
  from public.profiles director
  where director.role = 'Director'
    and director.status = 'Active'
    and director.employee_id is not null
  order by director.employee_id
  limit 1;

  if v_director_employee_id is null then
    raise exception using errcode = '55000', message = 'NO_ACTIVE_DIRECTOR';
  end if;

  insert into public.notifications (
    user_id,
    title,
    message,
    timestamp,
    is_read,
    type,
    reference_id
  ) values (
    v_director_employee_id,
    'Visit Report Submitted',
    v_actor.full_name || ' submitted a visit report for '
      || coalesce(v_report.customer_name, 'a completed visit') || '.',
    to_char(now(), 'DD/MM/YYYY, HH12:MI AM'),
    false,
    'visit_report',
    v_report.id::text
  );

  if v_follow_up_required then
    insert into public.follow_ups (
      employee_id,
      full_name,
      customer_id,
      customer_name,
      follow_up_date,
      type,
      purpose,
      priority,
      status,
      notes
    ) values (
      v_actor.employee_id,
      v_actor.full_name,
      v_plan.customer_id,
      coalesce(v_plan.customer_name, v_report.customer_name),
      v_follow_up_date,
      'Visit Follow-up',
      coalesce(nullif(p_report ->> 'next_action', ''), 'Follow up after completed visit'),
      coalesce(v_plan.priority, 'Medium'),
      'Pending',
      v_discussion_notes
    );
  end if;

  return v_report;
end;
$$;

revoke execute on function public.submit_visit_report(uuid, jsonb) from public, anon;
grant execute on function public.submit_visit_report(uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';
