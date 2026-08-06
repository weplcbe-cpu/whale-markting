begin;

create table if not exists public.districts (
  id uuid primary key default gen_random_uuid(),
  district_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (btrim(district_name) <> '')
);

create unique index if not exists districts_name_key
  on public.districts (lower(btrim(district_name)));

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  district_id uuid not null references public.districts(id) on delete restrict,
  location_name text not null,
  location_type text not null check (location_type in ('Corporation', 'Municipality')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (btrim(location_name) <> '')
);

create unique index if not exists locations_district_name_key
  on public.locations (district_id, lower(btrim(location_name)));

create unique index if not exists locations_name_key
  on public.locations (lower(btrim(location_name)));

create index if not exists locations_district_active_idx
  on public.locations (district_id, active);

create or replace function public.touch_location_master_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists districts_touch_updated_at on public.districts;
create trigger districts_touch_updated_at
before update on public.districts
for each row execute function public.touch_location_master_updated_at();

drop trigger if exists locations_touch_updated_at on public.locations;
create trigger locations_touch_updated_at
before update on public.locations
for each row execute function public.touch_location_master_updated_at();

alter table public.districts enable row level security;
alter table public.locations enable row level security;

revoke all on table public.districts, public.locations from public, anon;
grant select on table public.districts, public.locations to authenticated;

drop policy if exists districts_select on public.districts;
create policy districts_select on public.districts
for select to authenticated
using (
  public.is_admin_or_director()
  or exists (
    select 1
    from public.locations location
    join public.employee_visit_places place
      on lower(btrim(place.place_name)) = lower(btrim(location.location_name))
      and place.is_active
    where location.district_id = districts.id
      and place.employee_id = public.current_employee_id()
  )
);

drop policy if exists locations_select on public.locations;
create policy locations_select on public.locations
for select to authenticated
using (
  public.is_admin_or_director()
  or exists (
      select 1
      from public.employee_visit_places place
      where place.employee_id = public.current_employee_id()
        and place.is_active
        and lower(btrim(place.place_name)) = lower(btrim(locations.location_name))
    )
);

create or replace function public.admin_manage_location_master(
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
  v_id uuid := nullif(btrim(p_record ->> 'id'), '')::uuid;
  v_district_id uuid := nullif(btrim(p_record ->> 'district_id'), '')::uuid;
  v_name text := nullif(btrim(p_record ->> 'name'), '');
  v_type text := nullif(btrim(p_record ->> 'location_type'), '');
  v_active boolean := coalesce((p_record ->> 'active')::boolean, true);
  v_existing public.locations%rowtype;
  v_result_id uuid;
begin
  if auth.uid() is null or not exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.role = 'Admin'
      and profile.status = 'Active'
  ) then
    raise exception using errcode = '42501', message = 'LOCATION_MASTER_FORBIDDEN';
  end if;

  if jsonb_typeof(p_record) <> 'object' or v_action not in (
    'create_district', 'update_district', 'set_district_active', 'delete_district',
    'create_location', 'update_location', 'set_location_active', 'delete_location'
  ) then
    raise exception using errcode = '22023', message = 'INVALID_LOCATION_MASTER_REQUEST';
  end if;

  if v_action in ('create_district', 'update_district', 'create_location', 'update_location')
    and v_name is null then
    raise exception using errcode = '22023', message = 'LOCATION_NAME_REQUIRED';
  end if;

  if v_action = 'create_district' then
    insert into public.districts (district_name, active)
    values (v_name, v_active)
    returning id into v_result_id;
  elsif v_action = 'update_district' then
    update public.districts
    set district_name = v_name, active = v_active
    where id = v_id
    returning id into v_result_id;
  elsif v_action = 'set_district_active' then
    update public.districts
    set active = v_active
    where id = v_id
    returning id into v_result_id;
  elsif v_action = 'delete_district' then
    if exists (select 1 from public.locations where district_id = v_id) then
      raise exception using errcode = 'P0001', message = 'DISTRICT_HAS_LOCATIONS';
    end if;
    delete from public.districts where id = v_id returning id into v_result_id;
  elsif v_action = 'create_location' then
    if v_district_id is null or not exists (
      select 1 from public.districts where id = v_district_id and active
    ) then
      raise exception using errcode = '22023', message = 'ACTIVE_DISTRICT_REQUIRED';
    end if;
    if v_type not in ('Corporation', 'Municipality') then
      raise exception using errcode = '22023', message = 'INVALID_LOCATION_TYPE';
    end if;
    insert into public.locations (district_id, location_name, location_type, active)
    values (v_district_id, v_name, v_type, v_active)
    returning id into v_result_id;
  elsif v_action = 'update_location' then
    select * into v_existing from public.locations where id = v_id for update;
    if not found then
      raise exception using errcode = 'P0001', message = 'LOCATION_NOT_FOUND';
    end if;
    if v_district_id is null or not exists (
      select 1 from public.districts where id = v_district_id
    ) then
      raise exception using errcode = '22023', message = 'DISTRICT_REQUIRED';
    end if;
    if v_type not in ('Corporation', 'Municipality') then
      raise exception using errcode = '22023', message = 'INVALID_LOCATION_TYPE';
    end if;
    if (v_existing.district_id <> v_district_id or v_existing.location_type <> v_type)
      and exists (
        select 1 from public.visit_plans
        where lower(btrim(coalesce(area, city, ''))) = lower(btrim(v_existing.location_name))
      ) then
      raise exception using errcode = 'P0001', message = 'LOCATION_HAS_VISIT_HISTORY';
    end if;
    if lower(btrim(v_existing.location_name)) <> lower(v_name)
      and exists (
        select 1
        from public.employee_visit_places old_place
        join public.employee_visit_places new_place
          on new_place.employee_id = old_place.employee_id
          and lower(btrim(new_place.place_name)) = lower(v_name)
        where lower(btrim(old_place.place_name)) = lower(btrim(v_existing.location_name))
      ) then
      raise exception using errcode = '23505', message = 'LOCATION_RENAME_ASSIGNMENT_CONFLICT';
    end if;
    update public.locations
    set district_id = v_district_id,
        location_name = v_name,
        location_type = v_type,
        active = v_active
    where id = v_id
    returning id into v_result_id;
    if lower(btrim(v_existing.location_name)) <> lower(v_name) then
      update public.employee_visit_places
      set place_name = v_name
      where lower(btrim(place_name)) = lower(btrim(v_existing.location_name));
    end if;
  elsif v_action = 'set_location_active' then
    update public.locations
    set active = v_active
    where id = v_id
    returning id into v_result_id;
  else
    select * into v_existing from public.locations where id = v_id for update;
    if not found then
      raise exception using errcode = 'P0001', message = 'LOCATION_NOT_FOUND';
    end if;
    if exists (
      select 1 from public.employee_visit_places
      where lower(btrim(place_name)) = lower(btrim(v_existing.location_name))
    ) or exists (
      select 1 from public.visit_plans
      where lower(btrim(coalesce(area, city, ''))) = lower(btrim(v_existing.location_name))
    ) or exists (
      select 1 from public.visit_reports
      where lower(btrim(coalesce(customer_name, ''))) = lower(btrim(v_existing.location_name))
    ) or exists (
      select 1 from public.follow_ups
      where lower(btrim(coalesce(customer_name, ''))) = lower(btrim(v_existing.location_name))
    ) then
      raise exception using errcode = 'P0001', message = 'LOCATION_HAS_DEPENDENCIES';
    end if;
    delete from public.locations where id = v_id returning id into v_result_id;
  end if;

  if v_result_id is null then
    raise exception using errcode = 'P0001', message = 'LOCATION_RECORD_NOT_FOUND';
  end if;
  return jsonb_build_object('id', v_result_id, 'action', v_action);
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'LOCATION_DUPLICATE';
end;
$$;

revoke all on function public.admin_manage_location_master(text, jsonb) from public, anon;
grant execute on function public.admin_manage_location_master(text, jsonb) to authenticated;

create or replace function public.admin_replace_employee_visit_places(
  p_employee_id text,
  p_visit_places text[] default array[]::text[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_places text[];
begin
  if auth.uid() is null or not exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.role = 'Admin'
      and profile.status = 'Active'
  ) then
    raise exception using errcode = '42501', message = 'VISIT_PLACE_ASSIGNMENT_FORBIDDEN';
  end if;

  select coalesce(array_agg(place_name order by lower(place_name)), array[]::text[])
  into v_places
  from (
    select distinct on (lower(btrim(value))) btrim(value) as place_name
    from unnest(coalesce(p_visit_places, array[]::text[])) value
    where btrim(value) <> ''
    order by lower(btrim(value)), btrim(value)
  ) normalized_places;

  delete from public.employee_visit_places
  where employee_id = btrim(p_employee_id);

  insert into public.employee_visit_places (employee_id, place_name, is_active)
  select btrim(p_employee_id), place_name, true
  from unnest(v_places) as normalized(place_name);
end;
$$;

revoke all on function public.admin_replace_employee_visit_places(text, text[]) from public, anon;
grant execute on function public.admin_replace_employee_visit_places(text, text[]) to authenticated;

revoke insert, update, delete on table public.employee_visit_places from authenticated;
drop policy if exists "employee_visit_places_insert" on public.employee_visit_places;
drop policy if exists "employee_visit_places_update" on public.employee_visit_places;
drop policy if exists "employee_visit_places_delete" on public.employee_visit_places;

notify pgrst, 'reload schema';

commit;
