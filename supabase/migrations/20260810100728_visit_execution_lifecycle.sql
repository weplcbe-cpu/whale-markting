-- Visit execution lifecycle. Planning remains separate; the 24-hour clock is
-- created only by a successful start_visit call.

alter table public.visit_plans
  add column if not exists started_at timestamptz,
  add column if not exists close_deadline timestamptz,
  add column if not exists completed_at timestamptz;

create unique index if not exists visit_plans_one_active_visit_per_employee
  on public.visit_plans (employee_id)
  where lower(coalesce(status, '')) = 'in progress';

create unique index if not exists notifications_visit_lifecycle_once
  on public.notifications (type, title, reference_id, user_id)
  where type = 'visit_lifecycle';

create or replace function public.guard_visit_execution_lifecycle()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_role text;
begin
  -- SECURITY DEFINER lifecycle functions and backend service operations retain
  -- their database privileges. Admin keeps the existing administrative access.
  if current_user in ('postgres', 'supabase_admin', 'service_role') then return new; end if;
  select profile.role into v_role from public.profiles profile where profile.id = auth.uid();
  if v_role = 'Admin' then return new; end if;

  if new.started_at is distinct from old.started_at
     or new.close_deadline is distinct from old.close_deadline
     or new.completed_at is distinct from old.completed_at
     or lower(coalesce(new.status, '')) in ('in progress', 'completed')
        and lower(coalesce(old.status, '')) <> lower(coalesce(new.status, ''))
     or lower(coalesce(old.status, '')) = 'in progress'
        and lower(coalesce(new.status, '')) <> 'in progress' then
    raise exception using errcode = '42501', message = 'VISIT_LIFECYCLE_RPC_REQUIRED';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_visit_execution_lifecycle on public.visit_plans;
create trigger guard_visit_execution_lifecycle
before update on public.visit_plans
for each row execute function public.guard_visit_execution_lifecycle();

create or replace function public.start_visit(p_visit_plan_id uuid)
returns public.visit_plans
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor public.profiles%rowtype;
  v_plan public.visit_plans%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'VISIT_AUTH_REQUIRED';
  end if;

  select profile.* into v_actor
  from public.profiles profile
  where profile.id = auth.uid() and profile.status = 'Active';

  if not found or v_actor.role not in ('Marketing', 'Marketing Team') then
    raise exception using errcode = '42501', message = 'VISIT_MARKETING_ONLY';
  end if;

  select plan.* into v_plan
  from public.visit_plans plan
  where plan.id = p_visit_plan_id and plan.employee_id = v_actor.employee_id
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'VISIT_PLAN_NOT_OWNED';
  end if;

  -- Network retries are idempotent and cannot reset the closure clock.
  if lower(coalesce(v_plan.status, '')) = 'in progress' then
    return v_plan;
  end if;

  if v_plan.visit_date <> (v_now at time zone 'Asia/Kolkata')::date then
    raise exception using errcode = '55000', message = 'VISIT_NOT_SCHEDULED_TODAY';
  end if;

  if lower(coalesce(v_plan.status, '')) not in
    ('scheduled', 'submitted', 'planned', 'approved', 'rescheduled') then
    raise exception using errcode = '55000', message = 'VISIT_CANNOT_BE_STARTED';
  end if;

  if exists (
    select 1 from public.visit_plans active
    where active.employee_id = v_actor.employee_id
      and active.id <> v_plan.id
      and lower(coalesce(active.status, '')) = 'in progress'
  ) then
    raise exception using errcode = '23505', message = 'ACTIVE_VISIT_EXISTS';
  end if;

  update public.visit_plans
  set status = 'In Progress',
      started_at = v_now,
      close_deadline = v_now + interval '24 hours',
      completed_at = null,
      updated_at = v_now
  where id = v_plan.id
  returning * into v_plan;

  insert into public.notifications
    (user_id, title, message, timestamp, is_read, type, reference_id, created_at, updated_at)
  select director.employee_id,
         'Visit Started',
         coalesce(v_actor.full_name, v_actor.username, v_actor.employee_id)
           || ' started the visit for ' || coalesce(v_plan.customer_name, 'a customer') || '.',
         to_char(v_now at time zone 'Asia/Kolkata', 'DD/MM/YYYY, HH12:MI AM'),
         false, 'visit_lifecycle', v_plan.id::text, v_now, v_now
  from public.profiles director
  where director.role = 'Director' and director.status = 'Active'
    and director.employee_id is not null
  on conflict (type, title, reference_id, user_id)
    where type = 'visit_lifecycle' do nothing;

  return v_plan;
exception when unique_violation then
  raise exception using errcode = '23505', message = 'ACTIVE_VISIT_EXISTS';
end;
$$;

revoke execute on function public.start_visit(uuid) from public, anon;
grant execute on function public.start_visit(uuid) to authenticated;

create or replace function public.create_visit_closure_overdue_notifications()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.notifications
    (user_id, title, message, timestamp, is_read, type, reference_id, created_at, updated_at)
  select director.employee_id,
         'Visit Closure Overdue',
         coalesce(plan.employee_name, plan.full_name, plan.employee_id)
           || '''s visit for ' || coalesce(plan.customer_name, 'a customer')
           || ' is overdue for closure.',
         to_char(now() at time zone 'Asia/Kolkata', 'DD/MM/YYYY, HH12:MI AM'),
         false, 'visit_lifecycle', plan.id::text, now(), now()
  from public.visit_plans plan
  cross join public.profiles director
  where lower(coalesce(plan.status, '')) = 'in progress'
    and plan.close_deadline < now()
    and director.role = 'Director' and director.status = 'Active'
    and director.employee_id is not null
  on conflict (type, title, reference_id, user_id)
    where type = 'visit_lifecycle' do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.create_visit_closure_overdue_notifications() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and not exists (select 1 from cron.job where jobname = 'visit_closure_overdue_notifications') then
    perform cron.schedule(
      'visit_closure_overdue_notifications',
      '*/5 * * * *',
      $cron$select public.create_visit_closure_overdue_notifications();$cron$
    );
  end if;
end;
$$;

-- Extend the existing atomic report transaction with lifecycle timestamps and
-- required close fields while preserving the Visit Report relationship.
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
  v_discussion_notes text;
  v_customer_response text;
  v_visit_outcome text;
  v_follow_up_required boolean;
  v_follow_up_date date;
  v_now timestamptz := clock_timestamp();
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'REPORT_AUTH_REQUIRED'; end if;
  select profile.* into v_actor from public.profiles profile
  where profile.id = auth.uid() and profile.status = 'Active';
  if not found then raise exception using errcode = '42501', message = 'REPORT_PROFILE_INACTIVE'; end if;
  if v_actor.role not in ('Marketing', 'Marketing Team') then raise exception using errcode = '42501', message = 'REPORT_MARKETING_ONLY'; end if;

  select plan.* into v_plan from public.visit_plans plan
  where plan.id = p_visit_plan_id and plan.employee_id = v_actor.employee_id for update;
  if not found then raise exception using errcode = '42501', message = 'VISIT_PLAN_NOT_OWNED'; end if;

  select report.* into v_report from public.visit_reports report where report.visit_plan_id = v_plan.id;
  if found then return v_report; end if;
  if lower(coalesce(v_plan.status, '')) not in ('in progress', 'started') then
    raise exception using errcode = '55000', message = 'VISIT_PLAN_NOT_STARTED';
  end if;

  v_discussion_notes := nullif(btrim(p_report ->> 'discussion_notes'), '');
  v_customer_response := nullif(btrim(p_report ->> 'customer_response'), '');
  v_visit_outcome := nullif(btrim(p_report ->> 'final_status'), '');
  if v_visit_outcome is null then raise exception using errcode = '22023', message = 'VISIT_OUTCOME_REQUIRED'; end if;
  if v_customer_response is null then raise exception using errcode = '22023', message = 'CUSTOMER_RESPONSE_REQUIRED'; end if;
  if v_discussion_notes is null then raise exception using errcode = '22023', message = 'DISCUSSION_NOTES_REQUIRED'; end if;

  begin
    v_follow_up_required := coalesce((p_report ->> 'is_follow_up_required')::boolean, false);
    v_follow_up_date := nullif(p_report ->> 'follow_up_date', '')::date;
  exception when invalid_text_representation or datetime_field_overflow then
    raise exception using errcode = '22023', message = 'INVALID_VISIT_REPORT_PAYLOAD';
  end;
  if v_follow_up_required and v_follow_up_date is null then raise exception using errcode = '22023', message = 'FOLLOW_UP_DATE_REQUIRED'; end if;

  insert into public.visit_reports (
    visit_plan_id, employee_id, full_name, visit_date, customer_name,
    meeting_completed, actual_time, customer_response, discussion_notes,
    interested_products, requirement_details, next_action, is_follow_up_required,
    follow_up_date, is_quotation_required, is_tender_related, photos, documents,
    final_status, submitted_at, is_locked
  ) values (
    v_plan.id, v_actor.employee_id, v_actor.full_name, v_plan.visit_date,
    coalesce(v_plan.customer_name, p_report ->> 'customer_name'),
    coalesce((p_report ->> 'meeting_completed')::boolean, true),
    nullif(p_report ->> 'actual_time', ''), v_customer_response, v_discussion_notes,
    case when jsonb_typeof(p_report -> 'interested_products') = 'array' then array(select jsonb_array_elements_text(p_report -> 'interested_products')) else '{}'::text[] end,
    nullif(p_report ->> 'requirement_details', ''), nullif(p_report ->> 'next_action', ''),
    v_follow_up_required, v_follow_up_date,
    coalesce((p_report ->> 'is_quotation_required')::boolean, false), false,
    case when jsonb_typeof(p_report -> 'photos') = 'array' then array(select jsonb_array_elements_text(p_report -> 'photos')) else '{}'::text[] end,
    case when jsonb_typeof(p_report -> 'documents') = 'array' then array(select jsonb_array_elements_text(p_report -> 'documents')) else '{}'::text[] end,
    v_visit_outcome, v_now, false
  ) returning * into v_report;

  update public.visit_plans
  set status = 'Completed', completed_at = v_now, updated_at = v_now
  where id = v_plan.id;

  insert into public.notifications
    (user_id, title, message, timestamp, is_read, type, reference_id, created_at, updated_at)
  select director.employee_id, 'Visit Completed',
         coalesce(v_actor.full_name, v_actor.username, v_actor.employee_id)
           || ' completed the visit for ' || coalesce(v_report.customer_name, 'a customer') || '.',
         to_char(v_now at time zone 'Asia/Kolkata', 'DD/MM/YYYY, HH12:MI AM'),
         false, 'visit_lifecycle', v_plan.id::text, v_now, v_now
  from public.profiles director
  where director.role = 'Director' and director.status = 'Active'
    and director.employee_id is not null
  on conflict (type, title, reference_id, user_id)
    where type = 'visit_lifecycle' do nothing;

  if v_follow_up_required then
    insert into public.follow_ups
      (employee_id, full_name, customer_id, customer_name, follow_up_date, type, purpose, priority, status, notes)
    values
      (v_actor.employee_id, v_actor.full_name, v_plan.customer_id,
       coalesce(v_plan.customer_name, v_report.customer_name), v_follow_up_date,
       'Visit Follow-up', coalesce(nullif(p_report ->> 'next_action', ''), 'Follow up after completed visit'),
       coalesce(v_plan.priority, 'Medium'), 'Pending', v_discussion_notes);
  end if;
  return v_report;
end;
$$;

revoke execute on function public.submit_visit_report(uuid, jsonb) from public, anon;
grant execute on function public.submit_visit_report(uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';
