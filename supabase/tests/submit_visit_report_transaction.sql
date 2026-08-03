-- Production-safe regression checks. Every mutation in this file is enclosed
-- by this transaction and rolled back at the end.
begin;

do $$
declare
  v_actor public.profiles%rowtype;
  v_plan public.visit_plans%rowtype;
  v_report public.visit_reports%rowtype;
  v_retry public.visit_reports%rowtype;
begin
  select profile.* into v_actor
  from public.profiles profile
  where profile.status = 'Active'
    and profile.role in ('Marketing', 'Marketing Team')
    and exists (select 1 from public.visit_plans plan where plan.employee_id = profile.employee_id and lower(plan.status) = 'started')
  order by profile.employee_id
  limit 1;
  select plan.* into v_plan from public.visit_plans plan
  where plan.employee_id = v_actor.employee_id and lower(plan.status) = 'started'
  order by plan.updated_at desc limit 1;

  if v_plan.id is null then raise exception 'TEST_REQUIRES_STARTED_MARKETING_PLAN'; end if;
  perform set_config('request.jwt.claim.sub', v_actor.id::text, true);

  -- Success without follow-up plus response-loss/double-submit idempotency.
  begin
    v_report := public.submit_visit_report(v_plan.id, jsonb_build_object(
      'discussion_notes', 'Transaction test without follow-up',
      'customer_response', 'Interested',
      'is_follow_up_required', false,
      'final_status', 'Completed'
    ));
    if v_report.id is null or v_report.full_name <> v_actor.full_name then raise exception 'REPORT_INSERT_ASSERTION_FAILED'; end if;
    if (select status from public.visit_plans where id = v_plan.id) <> 'Completed' then raise exception 'PLAN_STATUS_ASSERTION_FAILED'; end if;
    if not exists (select 1 from public.notifications where type = 'visit_report' and reference_id = v_report.id::text) then raise exception 'NOTIFICATION_LINK_ASSERTION_FAILED'; end if;
    if exists (select 1 from public.follow_ups where employee_id = v_actor.employee_id and notes = 'Transaction test without follow-up') then raise exception 'UNEXPECTED_FOLLOW_UP'; end if;
    v_retry := public.submit_visit_report(v_plan.id, '{"discussion_notes":"retry after response loss"}'::jsonb);
    if v_retry.id <> v_report.id then raise exception 'RETRY_IDEMPOTENCY_FAILED'; end if;
    if (select count(*) from public.notifications where type = 'visit_report' and reference_id = v_report.id::text) <> 1 then raise exception 'DUPLICATE_NOTIFICATION'; end if;
    raise exception using errcode = 'P0001', message = 'ROLLBACK_SUCCESS_WITHOUT_FOLLOW_UP';
  exception when raise_exception then
    if sqlerrm <> 'ROLLBACK_SUCCESS_WITHOUT_FOLLOW_UP' then raise; end if;
  end;

  -- Success with exactly one follow-up.
  begin
    v_report := public.submit_visit_report(v_plan.id, jsonb_build_object(
      'discussion_notes', 'Transaction test with follow-up',
      'customer_response', 'Need Follow-up',
      'next_action', 'Call customer',
      'is_follow_up_required', true,
      'follow_up_date', (current_date + 1)::text,
      'final_status', 'Completed'
    ));
    if (select count(*) from public.follow_ups where employee_id = v_actor.employee_id and notes = 'Transaction test with follow-up') <> 1 then raise exception 'FOLLOW_UP_ASSERTION_FAILED'; end if;
    raise exception using errcode = 'P0001', message = 'ROLLBACK_SUCCESS_WITH_FOLLOW_UP';
  exception when raise_exception then
    if sqlerrm <> 'ROLLBACK_SUCCESS_WITH_FOLLOW_UP' then raise; end if;
  end;

  -- Required-field validation.
  begin
    perform public.submit_visit_report(v_plan.id, '{}'::jsonb);
    raise exception 'MISSING_NOTES_WAS_ACCEPTED';
  exception when invalid_parameter_value then
    if sqlerrm <> 'DISCUSSION_NOTES_REQUIRED' then raise; end if;
  end;
end;
$$;

-- Admin and Director cannot submit on behalf of Marketing.
do $$
declare
  v_privileged public.profiles%rowtype;
  v_plan_id uuid;
begin
  select * into v_privileged from public.profiles where role in ('Admin', 'Director') and status = 'Active' order by role limit 1;
  select id into v_plan_id from public.visit_plans order by updated_at desc limit 1;
  perform set_config('request.jwt.claim.sub', v_privileged.id::text, true);
  begin
    perform public.submit_visit_report(v_plan_id, '{"discussion_notes":"must fail"}'::jsonb);
    raise exception 'PRIVILEGED_ROLE_WAS_ACCEPTED';
  exception when insufficient_privilege then
    if sqlerrm <> 'REPORT_MARKETING_ONLY' then raise; end if;
  end;
end;
$$;

-- One Marketing employee cannot complete another employee's plan.
do $$
declare
  v_actor public.profiles%rowtype;
  v_foreign_plan uuid;
begin
  select profile.* into v_actor
  from public.profiles profile
  where profile.role in ('Marketing', 'Marketing Team') and profile.status = 'Active'
    and exists (select 1 from public.visit_plans plan where plan.employee_id <> profile.employee_id)
  order by profile.employee_id limit 1;
  select id into v_foreign_plan from public.visit_plans where employee_id <> v_actor.employee_id order by updated_at desc limit 1;
  perform set_config('request.jwt.claim.sub', v_actor.id::text, true);
  begin
    perform public.submit_visit_report(v_foreign_plan, '{"discussion_notes":"must fail"}'::jsonb);
    raise exception 'FOREIGN_PLAN_WAS_ACCEPTED';
  exception when insufficient_privilege then
    if sqlerrm <> 'VISIT_PLAN_NOT_OWNED' then raise; end if;
  end;
end;
$$;

create function public.zz_test_fail_visit_report_notification()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.type = 'visit_report' then raise exception 'FORCED_NOTIFICATION_INSERT_FAILURE'; end if;
  return new;
end;
$$;
create trigger zz_test_fail_visit_report_notification
before insert on public.notifications
for each row execute function public.zz_test_fail_visit_report_notification();

-- Notification failure rolls back report and plan update.
do $$
declare
  v_actor public.profiles%rowtype;
  v_plan public.visit_plans%rowtype;
  v_reports_before bigint;
  v_status_before text;
begin
  select profile.* into v_actor from public.profiles profile
  where profile.status = 'Active' and profile.role in ('Marketing', 'Marketing Team')
    and exists (select 1 from public.visit_plans plan where plan.employee_id = profile.employee_id and lower(plan.status) = 'started')
  order by profile.employee_id limit 1;
  select plan.* into v_plan from public.visit_plans plan where plan.employee_id = v_actor.employee_id and lower(plan.status) = 'started' order by plan.updated_at desc limit 1;
  select count(*) into v_reports_before from public.visit_reports;
  v_status_before := v_plan.status;
  perform set_config('request.jwt.claim.sub', v_actor.id::text, true);
  begin
    perform public.submit_visit_report(v_plan.id, '{"discussion_notes":"forced notification failure","is_follow_up_required":false}'::jsonb);
    raise exception 'NOTIFICATION_FAILURE_WAS_NOT_RAISED';
  exception when others then
    if sqlerrm <> 'FORCED_NOTIFICATION_INSERT_FAILURE' then raise; end if;
  end;
  if (select count(*) from public.visit_reports) <> v_reports_before then raise exception 'REPORT_NOT_ROLLED_BACK_AFTER_NOTIFICATION_FAILURE'; end if;
  if (select status from public.visit_plans where id = v_plan.id) <> v_status_before then raise exception 'PLAN_NOT_ROLLED_BACK_AFTER_NOTIFICATION_FAILURE'; end if;
end;
$$;

drop trigger zz_test_fail_visit_report_notification on public.notifications;
drop function public.zz_test_fail_visit_report_notification();

create function public.zz_test_fail_visit_report_follow_up()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.notes = 'forced follow-up failure' then raise exception 'FORCED_FOLLOW_UP_INSERT_FAILURE'; end if;
  return new;
end;
$$;
create trigger zz_test_fail_visit_report_follow_up
before insert on public.follow_ups
for each row execute function public.zz_test_fail_visit_report_follow_up();

-- Follow-up failure rolls back report, plan update, and notification.
do $$
declare
  v_actor public.profiles%rowtype;
  v_plan public.visit_plans%rowtype;
  v_reports_before bigint;
  v_notifications_before bigint;
  v_status_before text;
begin
  select profile.* into v_actor from public.profiles profile
  where profile.status = 'Active' and profile.role in ('Marketing', 'Marketing Team')
    and exists (select 1 from public.visit_plans plan where plan.employee_id = profile.employee_id and lower(plan.status) = 'started')
  order by profile.employee_id limit 1;
  select plan.* into v_plan from public.visit_plans plan where plan.employee_id = v_actor.employee_id and lower(plan.status) = 'started' order by plan.updated_at desc limit 1;
  select count(*) into v_reports_before from public.visit_reports;
  select count(*) into v_notifications_before from public.notifications;
  v_status_before := v_plan.status;
  perform set_config('request.jwt.claim.sub', v_actor.id::text, true);
  begin
    perform public.submit_visit_report(v_plan.id, jsonb_build_object('discussion_notes','forced follow-up failure','is_follow_up_required',true,'follow_up_date',(current_date + 1)::text));
    raise exception 'FOLLOW_UP_FAILURE_WAS_NOT_RAISED';
  exception when others then
    if sqlerrm <> 'FORCED_FOLLOW_UP_INSERT_FAILURE' then raise; end if;
  end;
  if (select count(*) from public.visit_reports) <> v_reports_before then raise exception 'REPORT_NOT_ROLLED_BACK_AFTER_FOLLOW_UP_FAILURE'; end if;
  if (select count(*) from public.notifications) <> v_notifications_before then raise exception 'NOTIFICATION_NOT_ROLLED_BACK_AFTER_FOLLOW_UP_FAILURE'; end if;
  if (select status from public.visit_plans where id = v_plan.id) <> v_status_before then raise exception 'PLAN_NOT_ROLLED_BACK_AFTER_FOLLOW_UP_FAILURE'; end if;
end;
$$;

rollback;
