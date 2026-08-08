-- Migration to add SECURITY DEFINER delete_daily_report function and RLS policy
drop policy if exists "daily_reports_delete" on public.daily_reports;

create policy "daily_reports_delete"
on public.daily_reports
for delete
to authenticated
using (
  public.is_admin()
  or (
    public.current_role_name() in ('Marketing', 'Marketing Team')
    and employee_id = public.current_employee_id()
    and coalesce(is_locked, false) = false
    and lower(coalesce(status, 'submitted')) != 'locked'
  )
);

create or replace function public.delete_daily_report(p_report_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_uid uuid;
  v_caller_role text;
  v_caller_emp_id text;
  v_report_record public.daily_reports%rowtype;
  v_deleted_count integer;
begin
  v_caller_uid := auth.uid();
  if v_caller_uid is null then
    return jsonb_build_object('success', false, 'error', 'UNAUTHENTICATED');
  end if;

  select role, employee_id
  into v_caller_role, v_caller_emp_id
  from public.profiles
  where id = v_caller_uid;

  select *
  into v_report_record
  from public.daily_reports
  where id::text = p_report_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'NOT_FOUND');
  end if;

  -- Authorization checks
  if lower(coalesce(v_caller_role, '')) in ('admin', 'administrator') then
    -- Admin allowed
  elsif lower(coalesce(v_caller_role, '')) in ('marketing', 'marketing team') then
    if v_report_record.employee_id != v_caller_emp_id then
      return jsonb_build_object('success', false, 'error', 'FORBIDDEN_NOT_OWNER');
    end if;
    if coalesce(v_report_record.is_locked, false) = true or lower(coalesce(v_report_record.status, 'submitted')) = 'locked' then
      return jsonb_build_object('success', false, 'error', 'REPORT_LOCKED');
    end if;
  else
    -- Director and other roles strictly blocked
    return jsonb_build_object('success', false, 'error', 'FORBIDDEN_ROLE');
  end if;

  -- Delete target report
  delete from public.daily_reports
  where id::text = p_report_id;
  get diagnostics v_deleted_count = row_count;

  if v_deleted_count = 1 then
    delete from public.notifications
    where reference_id = p_report_id;

    return jsonb_build_object('success', true, 'deleted_id', p_report_id);
  else
    return jsonb_build_object('success', false, 'error', 'DELETE_FAILED');
  end if;
end;
$$;

grant execute on function public.delete_daily_report(text) to authenticated;
