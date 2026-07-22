-- Director is a read/review role for visit plans and customers. Admin retains
-- full control; Marketing employees retain ownership-scoped workflow access.
drop policy if exists "visit_plans_delete" on public.visit_plans;
create policy "visit_plans_delete"
on public.visit_plans
for delete
to authenticated
using (
  public.is_admin()
  or employee_id = public.current_employee_id()
);

drop policy if exists "customers_insert" on public.customers;
create policy "customers_insert"
on public.customers
for insert
to authenticated
with check (
  public.is_admin()
  or created_by = public.current_employee_id()
);

drop policy if exists "customers_update" on public.customers;
create policy "customers_update"
on public.customers
for update
to authenticated
using (
  public.is_admin()
  or created_by = public.current_employee_id()
)
with check (
  public.is_admin()
  or created_by = public.current_employee_id()
);
