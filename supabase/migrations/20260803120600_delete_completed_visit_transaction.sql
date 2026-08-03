-- Safely inspect and delete an owned completed visit and its relational data.

create or replace function public.completed_visit_delete_impact(p_visit_plan_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor public.profiles%rowtype;
  v_plan public.visit_plans%rowtype;
  v_report public.visit_reports%rowtype;
  v_notification_count integer := 0;
  v_follow_up_count integer := 0;
  v_comment_count integer := 0;
  v_file_count integer := 0;
  v_has_report boolean := false;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'VISIT_DELETE_AUTH_REQUIRED';
  end if;

  select profile.* into v_actor
  from public.profiles profile
  where profile.id = auth.uid() and profile.status = 'Active';

  if not found then
    raise exception using errcode = '42501', message = 'VISIT_DELETE_PROFILE_INACTIVE';
  end if;

  if v_actor.role not in ('Marketing', 'Marketing Team') then
    raise exception using errcode = '42501', message = 'VISIT_DELETE_NOT_AUTHORIZED';
  end if;

  select plan.* into v_plan
  from public.visit_plans plan
  where plan.id = p_visit_plan_id and plan.employee_id = v_actor.employee_id;

  if not found then
    raise exception using errcode = '42501', message = 'VISIT_DELETE_NOT_OWNED';
  end if;

  if lower(coalesce(v_plan.status, '')) <> 'completed' then
    raise exception using errcode = '55000', message = 'VISIT_DELETE_NOT_COMPLETED';
  end if;

  select report.* into v_report
  from public.visit_reports report
  where report.visit_plan_id = v_plan.id;

  if found then
    v_has_report := true;
    select count(*) into v_notification_count
    from public.notifications notification
    where notification.reference_id in (v_report.id::text, v_plan.id::text);

    select count(*) into v_comment_count
    from public.director_comments comment
    where comment.reference_id in (v_report.id::text, v_plan.id::text)
       or comment.target_id in (v_report.id::text, v_plan.id::text);

    select count(*) into v_follow_up_count
    from public.follow_ups follow_up
    where follow_up.employee_id = v_report.employee_id
      and follow_up.type = 'Visit Follow-up'
      and follow_up.customer_name is not distinct from v_report.customer_name
      and follow_up.follow_up_date is not distinct from v_report.follow_up_date
      and follow_up.notes is not distinct from v_report.discussion_notes
      and follow_up.purpose is not distinct from coalesce(nullif(v_report.next_action, ''), 'Follow up after completed visit');

    v_file_count := coalesce(cardinality(v_report.photos), 0) + coalesce(cardinality(v_report.documents), 0);
  end if;

  return jsonb_build_object(
    'success', true,
    'has_related_data', v_has_report or v_notification_count > 0 or v_follow_up_count > 0 or v_comment_count > 0 or v_file_count > 0,
    'report_count', case when v_report.id is null then 0 else 1 end,
    'notification_count', v_notification_count,
    'follow_up_count', v_follow_up_count,
    'comment_count', v_comment_count,
    'file_reference_count', v_file_count
  );
end;
$$;

create or replace function public.delete_completed_visit(p_visit_plan_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor public.profiles%rowtype;
  v_plan public.visit_plans%rowtype;
  v_report public.visit_reports%rowtype;
  v_report_id uuid;
  v_notification_ids uuid[] := '{}'::uuid[];
  v_follow_up_ids uuid[] := '{}'::uuid[];
  v_comment_ids uuid[] := '{}'::uuid[];
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'VISIT_DELETE_AUTH_REQUIRED';
  end if;

  select profile.* into v_actor
  from public.profiles profile
  where profile.id = auth.uid() and profile.status = 'Active';

  if not found then
    raise exception using errcode = '42501', message = 'VISIT_DELETE_PROFILE_INACTIVE';
  end if;

  if v_actor.role not in ('Marketing', 'Marketing Team') then
    raise exception using errcode = '42501', message = 'VISIT_DELETE_NOT_AUTHORIZED';
  end if;

  select plan.* into v_plan
  from public.visit_plans plan
  where plan.id = p_visit_plan_id
  for update;

  if not found or v_plan.employee_id <> v_actor.employee_id then
    raise exception using errcode = '42501', message = 'VISIT_DELETE_NOT_OWNED';
  end if;

  if lower(coalesce(v_plan.status, '')) <> 'completed' then
    raise exception using errcode = '55000', message = 'VISIT_DELETE_NOT_COMPLETED';
  end if;

  select report.* into v_report
  from public.visit_reports report
  where report.visit_plan_id = v_plan.id
  for update;

  if found then
    v_report_id := v_report.id;

    -- Storage objects cannot be transactionally removed through SQL. Refuse
    -- deletion rather than orphaning an object if a future upload flow stores URLs.
    if coalesce(cardinality(v_report.photos), 0) + coalesce(cardinality(v_report.documents), 0) > 0 then
      raise exception using errcode = '55000', message = 'VISIT_DELETE_HAS_STORED_FILES';
    end if;

    with deleted as (
      delete from public.notifications notification
      where notification.reference_id in (v_report.id::text, v_plan.id::text)
      returning notification.id
    ) select coalesce(array_agg(id), '{}'::uuid[]) into v_notification_ids from deleted;

    with deleted as (
      delete from public.director_comments comment
      where comment.reference_id in (v_report.id::text, v_plan.id::text)
         or comment.target_id in (v_report.id::text, v_plan.id::text)
      returning comment.id
    ) select coalesce(array_agg(id), '{}'::uuid[]) into v_comment_ids from deleted;

    with deleted as (
      delete from public.follow_ups follow_up
      where follow_up.employee_id = v_report.employee_id
        and follow_up.type = 'Visit Follow-up'
        and follow_up.customer_name is not distinct from v_report.customer_name
        and follow_up.follow_up_date is not distinct from v_report.follow_up_date
        and follow_up.notes is not distinct from v_report.discussion_notes
        and follow_up.purpose is not distinct from coalesce(nullif(v_report.next_action, ''), 'Follow up after completed visit')
      returning follow_up.id
    ) select coalesce(array_agg(id), '{}'::uuid[]) into v_follow_up_ids from deleted;

    delete from public.visit_reports report where report.id = v_report.id;
  end if;

  delete from public.visit_plans plan where plan.id = v_plan.id;

  return jsonb_build_object(
    'success', true,
    'visit_plan_id', v_plan.id,
    'report_id', v_report_id,
    'notification_ids', to_jsonb(v_notification_ids),
    'follow_up_ids', to_jsonb(v_follow_up_ids),
    'comment_ids', to_jsonb(v_comment_ids)
  );
end;
$$;

revoke execute on function public.completed_visit_delete_impact(uuid) from public, anon;
revoke execute on function public.delete_completed_visit(uuid) from public, anon;
grant execute on function public.completed_visit_delete_impact(uuid) to authenticated;
grant execute on function public.delete_completed_visit(uuid) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'visit_reports'
  ) then
    alter publication supabase_realtime add table public.visit_reports;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'follow_ups'
  ) then
    alter publication supabase_realtime add table public.follow_ups;
  end if;
end $$;

notify pgrst, 'reload schema';
