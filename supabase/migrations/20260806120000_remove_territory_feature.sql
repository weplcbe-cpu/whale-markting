-- Retire Territory Management after projecting active assignments into the
-- existing flat employee_visit_places authorization model. Historical plans,
-- reports, follow-ups, comments, and notifications are intentionally untouched.

begin;

insert into public.employee_visit_places (employee_id, place_name, is_active)
select distinct on (assignment.employee_id, lower(btrim(local_body.local_body_name)))
  assignment.employee_id,
  btrim(local_body.local_body_name),
  true
from public.employee_territory_assignments assignment
join public.local_bodies local_body on local_body.id = assignment.local_body_id
where assignment.active
  and local_body.active
  and btrim(local_body.local_body_name) <> ''
order by assignment.employee_id, lower(btrim(local_body.local_body_name)), btrim(local_body.local_body_name)
on conflict (employee_id, lower(place_name))
do update set is_active = true;

do $$
begin
  if exists (
    select 1
    from public.employee_territory_assignments assignment
    join public.local_bodies local_body on local_body.id = assignment.local_body_id
    left join public.employee_visit_places place
      on place.employee_id = assignment.employee_id
      and lower(btrim(place.place_name)) = lower(btrim(local_body.local_body_name))
    where assignment.active
      and local_body.active
      and (place.employee_id is null or not place.is_active)
  ) then
    raise exception 'TERRITORY_PLACE_PROJECTION_FAILED';
  end if;
end;
$$;

-- Remove Realtime publication membership before the source table is dropped.
do $$
begin
  if exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'employee_territory_assignments'
  ) then
    alter publication supabase_realtime drop table public.employee_territory_assignments;
  end if;
end;
$$;

drop trigger if exists employee_territory_assignments_sync_legacy_places
  on public.employee_territory_assignments;

revoke all on function public.sync_employee_visit_place_from_territory_assignment() from public, anon, authenticated;
revoke all on function public.admin_replace_employee_territory_assignments(text, jsonb) from public, anon, authenticated;
revoke all on function public.admin_manage_territory_master(text, jsonb) from public, anon, authenticated;

drop function if exists public.sync_employee_visit_place_from_territory_assignment();
drop function if exists public.admin_replace_employee_territory_assignments(text, jsonb);
drop function if exists public.admin_manage_territory_master(text, jsonb);

drop policy if exists employee_territory_assignments_select on public.employee_territory_assignments;
drop policy if exists territory_planning_group_districts_select on public.territory_planning_group_districts;
drop policy if exists territory_planning_groups_select on public.territory_planning_groups;
drop policy if exists local_bodies_select on public.local_bodies;
drop policy if exists districts_select on public.districts;
drop policy if exists territory_zones_select on public.territory_zones;

revoke all on table public.employee_territory_assignments from anon, authenticated;
revoke all on table public.territory_planning_group_districts from anon, authenticated;
revoke all on table public.territory_planning_groups from anon, authenticated;
revoke all on table public.local_bodies from anon, authenticated;
revoke all on table public.districts from anon, authenticated;
revoke all on table public.territory_zones from anon, authenticated;

drop table if exists public.employee_territory_assignments;
drop table if exists public.territory_planning_group_districts;
drop table if exists public.territory_planning_groups;
drop table if exists public.local_bodies;
drop table if exists public.districts;
drop table if exists public.territory_zones;

notify pgrst, 'reload schema';

commit;
