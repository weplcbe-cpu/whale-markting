-- Marketing users may read only active/inactive assignments tied to the
-- employee_id on their authenticated profile. Admin and Director retain the
-- all-employee assignment view required by their management screens.
grant select on table public.employee_visit_places to authenticated;

drop policy if exists "employee_visit_places_select" on public.employee_visit_places;
create policy "employee_visit_places_select"
on public.employee_visit_places
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles profile
    where profile.id = (select auth.uid())
      and (
        profile.role in ('Admin', 'Director')
        or employee_visit_places.employee_id = profile.employee_id
      )
  )
);

notify pgrst, 'reload schema';
