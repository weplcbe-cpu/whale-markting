-- Marketing users may only permanently delete their own editable tour-plan
-- entries. Directors retain read/review access and therefore cannot delete.
-- Administrators retain their existing administrative deletion capability.
drop policy if exists "visit_plans_delete" on public.visit_plans;
create policy "visit_plans_delete"
on public.visit_plans
for delete
to authenticated
using (
  public.is_admin()
  or (
    employee_id = public.current_employee_id()
    and status in ('Draft', 'Changes Requested')
  )
);
