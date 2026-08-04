-- Prepare normalized territory allocation. Sundar's approved 10/7/41/48 seed
-- is applied by the subsequent 20260804093000 migration.

create table if not exists public.territory_zones (
  id uuid primary key default gen_random_uuid(),
  zone_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists territory_zones_name_key
  on public.territory_zones (lower(btrim(zone_name)));

create table if not exists public.districts (
  id uuid primary key default gen_random_uuid(),
  district_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists districts_name_key
  on public.districts (lower(btrim(district_name)));

create table if not exists public.local_bodies (
  id uuid primary key default gen_random_uuid(),
  district_id uuid not null references public.districts(id) on delete restrict,
  local_body_name text not null,
  local_body_type text not null check (local_body_type in ('Corporation', 'Municipality')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (btrim(local_body_name) <> '')
);

create unique index if not exists local_bodies_district_name_key
  on public.local_bodies (district_id, lower(btrim(local_body_name)));

create index if not exists local_bodies_district_active_idx
  on public.local_bodies (district_id, active);

create table if not exists public.territory_planning_groups (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references public.territory_zones(id) on delete cascade,
  group_name text not null,
  display_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (zone_id, group_name)
);

create table if not exists public.territory_planning_group_districts (
  planning_group_id uuid not null references public.territory_planning_groups(id) on delete cascade,
  district_id uuid not null references public.districts(id) on delete cascade,
  primary key (planning_group_id, district_id)
);

create table if not exists public.employee_territory_assignments (
  id uuid primary key default gen_random_uuid(),
  employee_id text not null references public.profiles(employee_id) on delete cascade,
  zone_id uuid not null references public.territory_zones(id) on delete restrict,
  local_body_id uuid not null references public.local_bodies(id) on delete restrict,
  priority text not null check (priority in ('A', 'B', 'C')),
  visit_cycle text not null check (visit_cycle in ('Monthly', 'Bi-Monthly', 'Quarterly')),
  active boolean not null default true,
  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, local_body_id)
);

create index if not exists employee_territory_assignments_employee_active_idx
  on public.employee_territory_assignments (employee_id, active);

create index if not exists employee_territory_assignments_zone_active_idx
  on public.employee_territory_assignments (zone_id, active);

-- Keep the legacy dropdown and existing submit_marketing_visit_plan authorization
-- compatible while normalized assignments remain the source for new territory UI.
create or replace function public.sync_employee_visit_place_from_territory_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_employee_id text := coalesce(new.employee_id, old.employee_id);
  v_place_name text;
begin
  select lb.local_body_name
  into v_place_name
  from public.local_bodies lb
  where lb.id = coalesce(new.local_body_id, old.local_body_id);

  if v_place_name is null then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' or (tg_op = 'UPDATE' and old.active and not new.active) then
    if not exists (
      select 1
      from public.employee_territory_assignments eta
      join public.local_bodies lb on lb.id = eta.local_body_id
      where eta.employee_id = v_employee_id
        and eta.active
        and lower(btrim(lb.local_body_name)) = lower(btrim(v_place_name))
    ) then
      delete from public.employee_visit_places evp
      where evp.employee_id = v_employee_id
        and lower(btrim(evp.place_name)) = lower(btrim(v_place_name));
    end if;
  else
    insert into public.employee_visit_places (employee_id, place_name, is_active)
    values (v_employee_id, btrim(v_place_name), true)
    on conflict (employee_id, lower(place_name))
    do update set is_active = excluded.is_active;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists employee_territory_assignments_sync_legacy_places
  on public.employee_territory_assignments;
create trigger employee_territory_assignments_sync_legacy_places
after insert or update or delete on public.employee_territory_assignments
for each row execute function public.sync_employee_visit_place_from_territory_assignment();

create or replace function public.admin_replace_employee_territory_assignments(
  p_employee_id text,
  p_assignments jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.role = 'Admin'
      and profile.status = 'Active'
  ) then
    raise exception using errcode = '42501', message = 'TERRITORY_ASSIGNMENT_FORBIDDEN';
  end if;

  if jsonb_typeof(p_assignments) <> 'array' then
    raise exception using errcode = '22023', message = 'INVALID_TERRITORY_ASSIGNMENTS';
  end if;

  delete from public.employee_territory_assignments
  where employee_id = btrim(p_employee_id);

  insert into public.employee_territory_assignments (
    employee_id, zone_id, local_body_id, priority, visit_cycle, active
  )
  select
    btrim(p_employee_id),
    (item ->> 'zone_id')::uuid,
    (item ->> 'local_body_id')::uuid,
    item ->> 'priority',
    item ->> 'visit_cycle',
    coalesce((item ->> 'active')::boolean, true)
  from jsonb_array_elements(p_assignments) item;
end;
$$;

revoke all on function public.admin_replace_employee_territory_assignments(text, jsonb) from public, anon;
grant execute on function public.admin_replace_employee_territory_assignments(text, jsonb) to authenticated;

alter table public.territory_zones enable row level security;
alter table public.districts enable row level security;
alter table public.local_bodies enable row level security;
alter table public.territory_planning_groups enable row level security;
alter table public.territory_planning_group_districts enable row level security;
alter table public.employee_territory_assignments enable row level security;

revoke all on table public.territory_zones, public.districts, public.local_bodies,
  public.territory_planning_groups, public.territory_planning_group_districts,
  public.employee_territory_assignments from anon;
grant select on table public.territory_zones, public.districts, public.local_bodies,
  public.territory_planning_groups, public.territory_planning_group_districts,
  public.employee_territory_assignments to authenticated;

drop policy if exists territory_zones_select on public.territory_zones;
create policy territory_zones_select on public.territory_zones
for select to authenticated using (true);

drop policy if exists districts_select on public.districts;
create policy districts_select on public.districts
for select to authenticated using (true);

drop policy if exists local_bodies_select on public.local_bodies;
create policy local_bodies_select on public.local_bodies
for select to authenticated using (true);

drop policy if exists territory_planning_groups_select on public.territory_planning_groups;
create policy territory_planning_groups_select on public.territory_planning_groups
for select to authenticated using (true);

drop policy if exists territory_planning_group_districts_select on public.territory_planning_group_districts;
create policy territory_planning_group_districts_select on public.territory_planning_group_districts
for select to authenticated using (true);

drop policy if exists employee_territory_assignments_select on public.employee_territory_assignments;
create policy employee_territory_assignments_select on public.employee_territory_assignments
for select to authenticated using (
  public.is_admin_or_director()
  or employee_id = public.current_employee_id()
);

-- Validate the approved Sundar seed after 20260804093000 has been applied.
--
-- select
--   count(distinct district_id) as districts,
--   count(*) filter (where local_body_type = 'Corporation') as corporations,
--   count(*) filter (where local_body_type = 'Municipality') as municipalities,
--   count(*) as active_local_bodies
-- from public.employee_territory_assignments eta
-- join public.local_bodies lb on lb.id = eta.local_body_id
-- join public.districts d on d.id = lb.district_id
-- where eta.employee_id = 'EMP004' and eta.active and lb.active;
-- Expected: 10 districts, 7 corporations, 41 municipalities, 48 local bodies.

alter publication supabase_realtime add table public.employee_territory_assignments;

notify pgrst, 'reload schema';
