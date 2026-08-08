-- Migration to create public.delete_daily_report(uuid) SECURITY DEFINER function and daily_reports_delete policy
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

create or replace function public.delete_daily_report(
  p_report_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted_id uuid;
  v_role text;
  v_employee_id text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  v_role := public.current_role_name();
  v_employee_id := public.current_employee_id();

  delete from public.daily_reports
  where id = p_report_id
    and coalesce(is_locked, false) = false
    and lower(coalesce(status, 'submitted')) <> 'locked'
    and (
      public.is_admin()
      or (
        v_role in ('Marketing', 'Marketing Team')
        and employee_id = v_employee_id
      )
    )
  returning id into v_deleted_id;

  if v_deleted_id is null then
    raise exception 'Daily report cannot be deleted or is not authorized';
  end if;

  -- Clean up associated notifications atomically
  delete from public.notifications
  where reference_id = p_report_id::text;

  return v_deleted_id;
end;
$$;

revoke execute on function public.delete_daily_report(uuid) from public, anon;
grant execute on function public.delete_daily_report(uuid) to authenticated;
