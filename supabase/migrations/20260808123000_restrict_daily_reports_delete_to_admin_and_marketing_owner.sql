-- Forward migration: restrict daily_reports_delete to Admin or Marketing owner.
-- Directors are strictly blocked from deleting daily reports at the database level.
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
