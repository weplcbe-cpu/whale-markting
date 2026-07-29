-- Permit permanent deletion of editable and legacy visit-plan rows while
-- preserving strict ownership. Directors remain read-only.
drop policy if exists "visit_plans_delete" on public.visit_plans;

create policy "visit_plans_delete"
on public.visit_plans
for delete
to authenticated
using (
  public.is_admin()
  or (
    public.current_role_name() in ('Marketing', 'Marketing Team')
    and employee_id = public.current_employee_id()
    and status in (
      'Draft',
      'Approved',
      'Rejected',
      'Changes Requested',
      'Pending Approval',
      'Submitted for Director Approval'
    )
  )
);
