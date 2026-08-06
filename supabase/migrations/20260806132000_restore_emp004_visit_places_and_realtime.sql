begin;

insert into public.employee_visit_places (employee_id, place_name, is_active)
select 'EMP004', location.location_name, true
from public.locations location
where location.active
on conflict (employee_id, lower(place_name))
do update set is_active = true;

do $$
begin
  if (select count(*) from public.employee_visit_places where employee_id = 'EMP004' and is_active) <> 48 then
    raise exception 'EMP004_VISIT_PLACE_RESTORE_FAILED';
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'employee_visit_places'
  ) then
    alter publication supabase_realtime add table public.employee_visit_places;
  end if;
end;
$$;

revoke select on table public.employee_visit_places from anon;

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
      and profile.status = 'Active'
      and (
        profile.role in ('Admin', 'Director')
        or (
          profile.role = 'Marketing'
          and employee_visit_places.employee_id = profile.employee_id
          and employee_visit_places.is_active
        )
      )
  )
);

notify pgrst, 'reload schema';

commit;