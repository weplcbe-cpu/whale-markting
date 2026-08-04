-- Approved Sundar territory seed: 10 districts, 7 corporations, 41 municipalities,
-- and 48 active local bodies. Uses only municipality names supplied by the user.

do $$
declare
  v_zone_id uuid;
  v_employee_exists boolean;
begin
  select exists (
    select 1 from public.profiles where employee_id = 'EMP004'
  ) into v_employee_exists;

  if not v_employee_exists then
    raise exception using errcode = 'P0001', message = 'EMP004_PROFILE_NOT_FOUND';
  end if;

  insert into public.territory_zones (zone_name, active)
  select 'South Tamil Nadu Zone', true
  where not exists (
    select 1 from public.territory_zones where lower(btrim(zone_name)) = lower('South Tamil Nadu Zone')
  );

  update public.territory_zones
  set active = true
  where lower(btrim(zone_name)) = lower('South Tamil Nadu Zone');

  select id into v_zone_id
  from public.territory_zones
  where lower(btrim(zone_name)) = lower('South Tamil Nadu Zone')
  limit 1;

  with seed_districts(district_name) as (
    values
      ('Dindigul'), ('Kanniyakumari'), ('Madurai'), ('Ramanathapuram'), ('Sivagangai'),
      ('Tenkasi'), ('Theni'), ('Tirunelveli'), ('Thoothukudi'), ('Virudhunagar')
  )
  insert into public.districts (district_name, active)
  select btrim(district_name), true
  from seed_districts seed
  where not exists (
    select 1 from public.districts district
    where lower(btrim(district.district_name)) = lower(btrim(seed.district_name))
  );

  update public.districts district
  set active = true
  where lower(btrim(district.district_name)) in (
    'dindigul', 'kanniyakumari', 'madurai', 'ramanathapuram', 'sivagangai',
    'tenkasi', 'theni', 'tirunelveli', 'thoothukudi', 'virudhunagar'
  );

  with seed_local_bodies(district_name, local_body_name, local_body_type, priority, visit_cycle) as (
    values
      ('Dindigul', 'Dindigul City Municipal Corporation', 'Corporation', 'A', 'Monthly'),
      ('Dindigul', 'Palani', 'Municipality', 'B', 'Bi-Monthly'),
      ('Dindigul', 'Oddenchatram', 'Municipality', 'B', 'Bi-Monthly'),
      ('Dindigul', 'Kodaikanal', 'Municipality', 'B', 'Bi-Monthly'),
      ('Kanniyakumari', 'Nagercoil Municipal Corporation', 'Corporation', 'A', 'Monthly'),
      ('Kanniyakumari', 'Colachel', 'Municipality', 'B', 'Bi-Monthly'),
      ('Kanniyakumari', 'Kuzhithurai', 'Municipality', 'B', 'Bi-Monthly'),
      ('Kanniyakumari', 'Padmanabhapuram', 'Municipality', 'B', 'Bi-Monthly'),
      ('Kanniyakumari', 'Kollemcode', 'Municipality', 'B', 'Bi-Monthly'),
      ('Kanniyakumari', 'Kanniyakumari', 'Municipality', 'B', 'Bi-Monthly'),
      ('Madurai', 'Madurai Municipal Corporation', 'Corporation', 'A', 'Monthly'),
      ('Madurai', 'Melur', 'Municipality', 'B', 'Bi-Monthly'),
      ('Madurai', 'Thirumangalam', 'Municipality', 'B', 'Bi-Monthly'),
      ('Madurai', 'Usilampatti', 'Municipality', 'B', 'Bi-Monthly'),
      ('Ramanathapuram', 'Ramanathapuram', 'Municipality', 'B', 'Bi-Monthly'),
      ('Ramanathapuram', 'Rameswaram', 'Municipality', 'B', 'Bi-Monthly'),
      ('Ramanathapuram', 'Kilakarai', 'Municipality', 'B', 'Bi-Monthly'),
      ('Ramanathapuram', 'Paramakudi', 'Municipality', 'B', 'Bi-Monthly'),
      ('Sivagangai', 'Karaikkudi Municipal Corporation', 'Corporation', 'A', 'Monthly'),
      ('Sivagangai', 'Sivagangai', 'Municipality', 'B', 'Bi-Monthly'),
      ('Sivagangai', 'Devakottai', 'Municipality', 'B', 'Bi-Monthly'),
      ('Sivagangai', 'Manamadurai', 'Municipality', 'B', 'Bi-Monthly'),
      ('Tenkasi', 'Tenkasi', 'Municipality', 'B', 'Bi-Monthly'),
      ('Tenkasi', 'Sengottai', 'Municipality', 'B', 'Bi-Monthly'),
      ('Tenkasi', 'Kadayanallur', 'Municipality', 'B', 'Bi-Monthly'),
      ('Tenkasi', 'Puliyankudi', 'Municipality', 'B', 'Bi-Monthly'),
      ('Tenkasi', 'Surandai', 'Municipality', 'B', 'Bi-Monthly'),
      ('Tenkasi', 'Sankarankovil', 'Municipality', 'B', 'Bi-Monthly'),
      ('Theni', 'Bodinayakanur', 'Municipality', 'B', 'Bi-Monthly'),
      ('Theni', 'Chinnamanur', 'Municipality', 'B', 'Bi-Monthly'),
      ('Theni', 'Gudalur', 'Municipality', 'B', 'Bi-Monthly'),
      ('Theni', 'Cumbum', 'Municipality', 'B', 'Bi-Monthly'),
      ('Theni', 'Periyakulam', 'Municipality', 'B', 'Bi-Monthly'),
      ('Theni', 'Theni Allinagaram', 'Municipality', 'B', 'Bi-Monthly'),
      ('Tirunelveli', 'Tirunelveli Municipal Corporation', 'Corporation', 'A', 'Monthly'),
      ('Tirunelveli', 'Ambasamudram', 'Municipality', 'B', 'Bi-Monthly'),
      ('Tirunelveli', 'Vickramasingapuram', 'Municipality', 'B', 'Bi-Monthly'),
      ('Tirunelveli', 'Kalakad', 'Municipality', 'B', 'Bi-Monthly'),
      ('Thoothukudi', 'Thoothukudi Municipal Corporation', 'Corporation', 'A', 'Monthly'),
      ('Thoothukudi', 'Kovilpatti', 'Municipality', 'B', 'Bi-Monthly'),
      ('Thoothukudi', 'Kayalpattinam', 'Municipality', 'B', 'Bi-Monthly'),
      ('Virudhunagar', 'Sivakasi City Municipal Corporation', 'Corporation', 'A', 'Monthly'),
      ('Virudhunagar', 'Virudhunagar', 'Municipality', 'B', 'Bi-Monthly'),
      ('Virudhunagar', 'Thiruthangal', 'Municipality', 'B', 'Bi-Monthly'),
      ('Virudhunagar', 'Srivilliputhur', 'Municipality', 'B', 'Bi-Monthly'),
      ('Virudhunagar', 'Sattur', 'Municipality', 'B', 'Bi-Monthly'),
      ('Virudhunagar', 'Rajapalayam', 'Municipality', 'B', 'Bi-Monthly'),
      ('Virudhunagar', 'Aruppukkottai', 'Municipality', 'B', 'Bi-Monthly')
  )
  insert into public.local_bodies (district_id, local_body_name, local_body_type, active)
  select district.id, btrim(seed.local_body_name), seed.local_body_type, true
  from seed_local_bodies seed
  join public.districts district
    on lower(btrim(district.district_name)) = lower(btrim(seed.district_name))
  where not exists (
    select 1
    from public.local_bodies local_body
    where local_body.district_id = district.id
      and lower(btrim(local_body.local_body_name)) = lower(btrim(seed.local_body_name))
  );

  with seed_groups(group_name, display_order, district_name) as (
    values
      ('Central Zone Group', 1, 'Dindigul'), ('Central Zone Group', 1, 'Madurai'), ('Central Zone Group', 1, 'Theni'),
      ('South-East Zone Group', 2, 'Sivagangai'), ('South-East Zone Group', 2, 'Ramanathapuram'), ('South-East Zone Group', 2, 'Virudhunagar'),
      ('South-West Zone Group', 3, 'Tenkasi'), ('South-West Zone Group', 3, 'Tirunelveli'), ('South-West Zone Group', 3, 'Thoothukudi'),
      ('Far South Zone Group', 4, 'Kanniyakumari')
  ), group_names as (
    select distinct group_name, display_order from seed_groups
  )
  insert into public.territory_planning_groups (zone_id, group_name, display_order, active)
  select v_zone_id, group_name, display_order, true
  from group_names seed
  where not exists (
    select 1 from public.territory_planning_groups group_row
    where group_row.zone_id = v_zone_id and group_row.group_name = seed.group_name
  );

  with seed_groups(group_name, district_name) as (
    values
      ('Central Zone Group', 'Dindigul'), ('Central Zone Group', 'Madurai'), ('Central Zone Group', 'Theni'),
      ('South-East Zone Group', 'Sivagangai'), ('South-East Zone Group', 'Ramanathapuram'), ('South-East Zone Group', 'Virudhunagar'),
      ('South-West Zone Group', 'Tenkasi'), ('South-West Zone Group', 'Tirunelveli'), ('South-West Zone Group', 'Thoothukudi'),
      ('Far South Zone Group', 'Kanniyakumari')
  )
  insert into public.territory_planning_group_districts (planning_group_id, district_id)
  select group_row.id, district.id
  from seed_groups seed
  join public.territory_planning_groups group_row
    on group_row.zone_id = v_zone_id and group_row.group_name = seed.group_name
  join public.districts district
    on lower(btrim(district.district_name)) = lower(btrim(seed.district_name))
  on conflict do nothing;

  with seed_assignments(district_name, local_body_name, priority, visit_cycle) as (
    values
      ('Dindigul', 'Dindigul City Municipal Corporation', 'A', 'Monthly'), ('Dindigul', 'Palani', 'B', 'Bi-Monthly'), ('Dindigul', 'Oddenchatram', 'B', 'Bi-Monthly'), ('Dindigul', 'Kodaikanal', 'B', 'Bi-Monthly'),
      ('Kanniyakumari', 'Nagercoil Municipal Corporation', 'A', 'Monthly'), ('Kanniyakumari', 'Colachel', 'B', 'Bi-Monthly'), ('Kanniyakumari', 'Kuzhithurai', 'B', 'Bi-Monthly'), ('Kanniyakumari', 'Padmanabhapuram', 'B', 'Bi-Monthly'), ('Kanniyakumari', 'Kollemcode', 'B', 'Bi-Monthly'), ('Kanniyakumari', 'Kanniyakumari', 'B', 'Bi-Monthly'),
      ('Madurai', 'Madurai Municipal Corporation', 'A', 'Monthly'), ('Madurai', 'Melur', 'B', 'Bi-Monthly'), ('Madurai', 'Thirumangalam', 'B', 'Bi-Monthly'), ('Madurai', 'Usilampatti', 'B', 'Bi-Monthly'),
      ('Ramanathapuram', 'Ramanathapuram', 'B', 'Bi-Monthly'), ('Ramanathapuram', 'Rameswaram', 'B', 'Bi-Monthly'), ('Ramanathapuram', 'Kilakarai', 'B', 'Bi-Monthly'), ('Ramanathapuram', 'Paramakudi', 'B', 'Bi-Monthly'),
      ('Sivagangai', 'Karaikkudi Municipal Corporation', 'A', 'Monthly'), ('Sivagangai', 'Sivagangai', 'B', 'Bi-Monthly'), ('Sivagangai', 'Devakottai', 'B', 'Bi-Monthly'), ('Sivagangai', 'Manamadurai', 'B', 'Bi-Monthly'),
      ('Tenkasi', 'Tenkasi', 'B', 'Bi-Monthly'), ('Tenkasi', 'Sengottai', 'B', 'Bi-Monthly'), ('Tenkasi', 'Kadayanallur', 'B', 'Bi-Monthly'), ('Tenkasi', 'Puliyankudi', 'B', 'Bi-Monthly'), ('Tenkasi', 'Surandai', 'B', 'Bi-Monthly'), ('Tenkasi', 'Sankarankovil', 'B', 'Bi-Monthly'),
      ('Theni', 'Bodinayakanur', 'B', 'Bi-Monthly'), ('Theni', 'Chinnamanur', 'B', 'Bi-Monthly'), ('Theni', 'Gudalur', 'B', 'Bi-Monthly'), ('Theni', 'Cumbum', 'B', 'Bi-Monthly'), ('Theni', 'Periyakulam', 'B', 'Bi-Monthly'), ('Theni', 'Theni Allinagaram', 'B', 'Bi-Monthly'),
      ('Tirunelveli', 'Tirunelveli Municipal Corporation', 'A', 'Monthly'), ('Tirunelveli', 'Ambasamudram', 'B', 'Bi-Monthly'), ('Tirunelveli', 'Vickramasingapuram', 'B', 'Bi-Monthly'), ('Tirunelveli', 'Kalakad', 'B', 'Bi-Monthly'),
      ('Thoothukudi', 'Thoothukudi Municipal Corporation', 'A', 'Monthly'), ('Thoothukudi', 'Kovilpatti', 'B', 'Bi-Monthly'), ('Thoothukudi', 'Kayalpattinam', 'B', 'Bi-Monthly'),
      ('Virudhunagar', 'Sivakasi City Municipal Corporation', 'A', 'Monthly'), ('Virudhunagar', 'Virudhunagar', 'B', 'Bi-Monthly'), ('Virudhunagar', 'Thiruthangal', 'B', 'Bi-Monthly'), ('Virudhunagar', 'Srivilliputhur', 'B', 'Bi-Monthly'), ('Virudhunagar', 'Sattur', 'B', 'Bi-Monthly'), ('Virudhunagar', 'Rajapalayam', 'B', 'Bi-Monthly'), ('Virudhunagar', 'Aruppukkottai', 'B', 'Bi-Monthly')
  )
  insert into public.employee_territory_assignments (employee_id, zone_id, local_body_id, priority, visit_cycle, active)
  select 'EMP004', v_zone_id, local_body.id, seed.priority, seed.visit_cycle, true
  from seed_assignments seed
  join public.districts district
    on lower(btrim(district.district_name)) = lower(btrim(seed.district_name))
  join public.local_bodies local_body
    on local_body.district_id = district.id
    and lower(btrim(local_body.local_body_name)) = lower(btrim(seed.local_body_name))
  on conflict (employee_id, local_body_id)
  do update set zone_id = excluded.zone_id, priority = excluded.priority, visit_cycle = excluded.visit_cycle,
    active = true, updated_at = now();
end;
$$;

-- Production verification (expected: 10 districts, 7 corporations, 41 municipalities, 48 active local bodies).
select
  count(distinct district.id) as districts,
  count(*) filter (where local_body.local_body_type = 'Corporation') as corporations,
  count(*) filter (where local_body.local_body_type = 'Municipality') as municipalities,
  count(*) as active_local_bodies
from public.employee_territory_assignments assignment
join public.territory_zones zone on zone.id = assignment.zone_id
join public.local_bodies local_body on local_body.id = assignment.local_body_id
join public.districts district on district.id = local_body.district_id
where assignment.employee_id = 'EMP004'
  and assignment.active
  and local_body.active
  and lower(btrim(zone.zone_name)) = lower('South Tamil Nadu Zone');

notify pgrst, 'reload schema';
