-- Territory Master is maintained separately from employee assignment. Every
-- mutation is routed through the active-Admin RPC below; all other roles are read-only.

alter table public.districts
  add column if not exists zone_id uuid references public.territory_zones(id) on delete restrict;

create index if not exists districts_zone_active_idx
  on public.districts (zone_id, active);

update public.districts district
set zone_id = zone.id
from public.territory_zones zone
where district.zone_id is null
  and lower(btrim(zone.zone_name)) = lower('South Tamil Nadu Zone');

create or replace function public.admin_manage_territory_master(
  p_action text,
  p_record jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action text := lower(btrim(p_action));
  v_type text := lower(btrim(p_record ->> 'record_type'));
  v_id uuid := nullif(btrim(p_record ->> 'id'), '')::uuid;
  v_name text := nullif(btrim(p_record ->> 'name'), '');
  v_zone_id uuid := nullif(btrim(p_record ->> 'zone_id'), '')::uuid;
  v_district_id uuid := nullif(btrim(p_record ->> 'district_id'), '')::uuid;
  v_active boolean := coalesce((p_record ->> 'active')::boolean, true);
  v_local_body_type text := btrim(p_record ->> 'local_body_type');
  v_previous_name text;
  v_result_id uuid;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles profile
    where profile.id = auth.uid() and profile.role = 'Admin' and profile.status = 'Active'
  ) then
    raise exception using errcode = '42501', message = 'TERRITORY_MASTER_FORBIDDEN';
  end if;

  if jsonb_typeof(p_record) <> 'object' or v_action not in ('create', 'update', 'set_active', 'delete')
    or v_type not in ('zone', 'district', 'corporation', 'municipality', 'planning_group') then
    raise exception using errcode = '22023', message = 'INVALID_TERRITORY_MASTER_REQUEST';
  end if;

  if v_action in ('create', 'update') and v_name is null then
    raise exception using errcode = '22023', message = 'TERRITORY_NAME_REQUIRED';
  end if;

  if v_type in ('corporation', 'municipality') and v_local_body_type is distinct from initcap(v_type) then
    raise exception using errcode = '22023', message = 'INVALID_LOCAL_BODY_TYPE';
  end if;

  if v_type = 'zone' then
    if v_action = 'create' then
      insert into public.territory_zones (zone_name, active) values (v_name, v_active) returning id into v_result_id;
    elsif v_action = 'update' then
      update public.territory_zones set zone_name = v_name, active = v_active where id = v_id returning id into v_result_id;
    elsif v_action = 'set_active' then
      update public.territory_zones set active = v_active where id = v_id returning id into v_result_id;
    else
      if exists (select 1 from public.districts where zone_id = v_id)
        or exists (select 1 from public.territory_planning_groups where zone_id = v_id)
        or exists (select 1 from public.employee_territory_assignments where zone_id = v_id) then
        raise exception using errcode = 'P0001', message = 'TERRITORY_RECORD_IN_USE';
      end if;
      delete from public.territory_zones where id = v_id returning id into v_result_id;
    end if;
  elsif v_type = 'district' then
    if v_action in ('create', 'update') and (v_zone_id is null or not exists (select 1 from public.territory_zones where id = v_zone_id)) then
      raise exception using errcode = '22023', message = 'TERRITORY_ZONE_REQUIRED';
    end if;
    if v_action = 'create' then
      insert into public.districts (district_name, zone_id, active) values (v_name, v_zone_id, v_active) returning id into v_result_id;
    elsif v_action = 'update' then
      update public.districts set district_name = v_name, zone_id = v_zone_id, active = v_active where id = v_id returning id into v_result_id;
    elsif v_action = 'set_active' then
      update public.districts set active = v_active where id = v_id returning id into v_result_id;
    else
      if exists (select 1 from public.local_bodies where district_id = v_id)
        or exists (select 1 from public.territory_planning_group_districts where district_id = v_id) then
        raise exception using errcode = 'P0001', message = 'TERRITORY_RECORD_IN_USE';
      end if;
      delete from public.districts where id = v_id returning id into v_result_id;
    end if;
  elsif v_type in ('corporation', 'municipality') then
    if v_action in ('create', 'update') and (v_district_id is null or not exists (select 1 from public.districts where id = v_district_id)) then
      raise exception using errcode = '22023', message = 'TERRITORY_DISTRICT_REQUIRED';
    end if;
    if v_action = 'create' then
      insert into public.local_bodies (district_id, local_body_name, local_body_type, active)
      values (v_district_id, v_name, v_local_body_type, v_active) returning id into v_result_id;
    elsif v_action = 'update' then
      select local_body_name into v_previous_name from public.local_bodies where id = v_id for update;
      if not found then raise exception using errcode = 'P0001', message = 'TERRITORY_RECORD_NOT_FOUND'; end if;
      if exists (select 1 from public.employee_territory_assignments where local_body_id = v_id)
        and lower(btrim(v_previous_name)) <> lower(v_name) then
        raise exception using errcode = 'P0001', message = 'TERRITORY_ASSIGNED_RECORD_RENAME_FORBIDDEN';
      end if;
      update public.local_bodies set district_id = v_district_id, local_body_name = v_name, local_body_type = v_local_body_type, active = v_active, updated_at = now()
      where id = v_id returning id into v_result_id;
    elsif v_action = 'set_active' then
      update public.local_bodies set active = v_active, updated_at = now() where id = v_id returning id into v_result_id;
    else
      select local_body_name into v_previous_name from public.local_bodies where id = v_id for update;
      if exists (select 1 from public.employee_territory_assignments where local_body_id = v_id)
        or exists (select 1 from public.visit_plans where lower(btrim(coalesce(area, city, ''))) = lower(btrim(v_previous_name)))
        or exists (select 1 from public.visit_reports where lower(btrim(coalesce(customer_name, ''))) = lower(btrim(v_previous_name)))
        or exists (select 1 from public.follow_ups where lower(btrim(coalesce(customer_name, ''))) = lower(btrim(v_previous_name))) then
        raise exception using errcode = 'P0001', message = 'TERRITORY_RECORD_IN_USE';
      end if;
      delete from public.local_bodies where id = v_id returning id into v_result_id;
    end if;
  else
    if v_action in ('create', 'update') and (v_zone_id is null or not exists (select 1 from public.territory_zones where id = v_zone_id)) then
      raise exception using errcode = '22023', message = 'TERRITORY_ZONE_REQUIRED';
    end if;
    if v_action = 'create' then
      insert into public.territory_planning_groups (zone_id, group_name, active) values (v_zone_id, v_name, v_active) returning id into v_result_id;
    elsif v_action = 'update' then
      update public.territory_planning_groups set zone_id = v_zone_id, group_name = v_name, active = v_active where id = v_id returning id into v_result_id;
    elsif v_action = 'set_active' then
      update public.territory_planning_groups set active = v_active where id = v_id returning id into v_result_id;
    else
      if exists (select 1 from public.territory_planning_group_districts where planning_group_id = v_id) then
        raise exception using errcode = 'P0001', message = 'TERRITORY_RECORD_IN_USE';
      end if;
      delete from public.territory_planning_groups where id = v_id returning id into v_result_id;
    end if;
  end if;

  if v_result_id is null then raise exception using errcode = 'P0001', message = 'TERRITORY_RECORD_NOT_FOUND'; end if;
  return jsonb_build_object('id', v_result_id, 'record_type', v_type);
exception when unique_violation then
  raise exception using errcode = '23505', message = 'TERRITORY_DUPLICATE';
end;
$$;

revoke all on function public.admin_manage_territory_master(text, jsonb) from public, anon;
grant execute on function public.admin_manage_territory_master(text, jsonb) to authenticated;

-- Directors can read all territory reference data. Marketing users receive only
-- active structures that are linked to their own active assignments.
drop policy if exists territory_zones_select on public.territory_zones;
create policy territory_zones_select on public.territory_zones for select to authenticated using (
  public.is_admin_or_director() or (active and exists (
    select 1 from public.employee_territory_assignments assignment
    where assignment.zone_id = territory_zones.id and assignment.active
      and assignment.employee_id = public.current_employee_id()
  ))
);

drop policy if exists districts_select on public.districts;
create policy districts_select on public.districts for select to authenticated using (
  public.is_admin_or_director() or (active and exists (
    select 1 from public.employee_territory_assignments assignment
    join public.local_bodies local_body on local_body.id = assignment.local_body_id
    where local_body.district_id = districts.id and assignment.active
      and assignment.employee_id = public.current_employee_id()
  ))
);

drop policy if exists local_bodies_select on public.local_bodies;
create policy local_bodies_select on public.local_bodies for select to authenticated using (
  public.is_admin_or_director() or (active and exists (
    select 1 from public.employee_territory_assignments assignment
    where assignment.local_body_id = local_bodies.id and assignment.active
      and assignment.employee_id = public.current_employee_id()
  ))
);

drop policy if exists territory_planning_groups_select on public.territory_planning_groups;
create policy territory_planning_groups_select on public.territory_planning_groups for select to authenticated using (
  public.is_admin_or_director() or (active and exists (
    select 1 from public.territory_planning_group_districts group_district
    join public.local_bodies local_body on local_body.district_id = group_district.district_id
    join public.employee_territory_assignments assignment on assignment.local_body_id = local_body.id
    where group_district.planning_group_id = territory_planning_groups.id and assignment.active
      and assignment.employee_id = public.current_employee_id()
  ))
);

drop policy if exists territory_planning_group_districts_select on public.territory_planning_group_districts;
create policy territory_planning_group_districts_select on public.territory_planning_group_districts for select to authenticated using (
  public.is_admin_or_director() or exists (
    select 1 from public.local_bodies local_body
    join public.employee_territory_assignments assignment on assignment.local_body_id = local_body.id
    where local_body.district_id = territory_planning_group_districts.district_id and assignment.active
      and assignment.employee_id = public.current_employee_id()
  )
);

notify pgrst, 'reload schema';
