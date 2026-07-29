-- Marketing may permanently delete only owned plans in the explicitly
-- eligible workflow states. Admin behavior is preserved; Directors remain
-- unable to delete visit plans.
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
    and lower(status) in (
      'draft',
      'submitted',
      'rescheduled',
      'cancelled',
      'approved',
      'rejected',
      'changes requested',
      'pending approval',
      'submitted for director approval'
    )
  )
);
