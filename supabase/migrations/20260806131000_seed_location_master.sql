begin;

with seed_districts(district_name) as (
  values
    ('Dindigul'), ('Kanniyakumari'), ('Madurai'), ('Ramanathapuram'), ('Sivagangai'),
    ('Tenkasi'), ('Theni'), ('Tirunelveli'), ('Thoothukudi'), ('Virudhunagar')
)
insert into public.districts (district_name, active)
select seed.district_name, true
from seed_districts seed
where not exists (
  select 1 from public.districts district
  where lower(btrim(district.district_name)) = lower(btrim(seed.district_name))
);

update public.districts
set active = true
where lower(btrim(district_name)) in (
  'dindigul', 'kanniyakumari', 'madurai', 'ramanathapuram', 'sivagangai',
  'tenkasi', 'theni', 'tirunelveli', 'thoothukudi', 'virudhunagar'
);

with seed_locations(district_name, location_name, location_type) as (
  values
    ('Dindigul', 'Dindigul City Municipal Corporation', 'Corporation'),
    ('Dindigul', 'Palani', 'Municipality'), ('Dindigul', 'Oddenchatram', 'Municipality'), ('Dindigul', 'Kodaikanal', 'Municipality'),
    ('Kanniyakumari', 'Nagercoil Municipal Corporation', 'Corporation'),
    ('Kanniyakumari', 'Colachel', 'Municipality'), ('Kanniyakumari', 'Kuzhithurai', 'Municipality'), ('Kanniyakumari', 'Padmanabhapuram', 'Municipality'), ('Kanniyakumari', 'Kollemcode', 'Municipality'), ('Kanniyakumari', 'Kanniyakumari', 'Municipality'),
    ('Madurai', 'Madurai Municipal Corporation', 'Corporation'),
    ('Madurai', 'Melur', 'Municipality'), ('Madurai', 'Thirumangalam', 'Municipality'), ('Madurai', 'Usilampatti', 'Municipality'),
    ('Ramanathapuram', 'Ramanathapuram', 'Municipality'), ('Ramanathapuram', 'Rameswaram', 'Municipality'), ('Ramanathapuram', 'Kilakarai', 'Municipality'), ('Ramanathapuram', 'Paramakudi', 'Municipality'),
    ('Sivagangai', 'Karaikkudi Municipal Corporation', 'Corporation'),
    ('Sivagangai', 'Sivagangai', 'Municipality'), ('Sivagangai', 'Devakottai', 'Municipality'), ('Sivagangai', 'Manamadurai', 'Municipality'),
    ('Tenkasi', 'Tenkasi', 'Municipality'), ('Tenkasi', 'Sengottai', 'Municipality'), ('Tenkasi', 'Kadayanallur', 'Municipality'), ('Tenkasi', 'Puliyankudi', 'Municipality'), ('Tenkasi', 'Surandai', 'Municipality'), ('Tenkasi', 'Sankarankovil', 'Municipality'),
    ('Theni', 'Bodinayakanur', 'Municipality'), ('Theni', 'Chinnamanur', 'Municipality'), ('Theni', 'Gudalur', 'Municipality'), ('Theni', 'Cumbum', 'Municipality'), ('Theni', 'Periyakulam', 'Municipality'), ('Theni', 'Theni Allinagaram', 'Municipality'),
    ('Tirunelveli', 'Tirunelveli Municipal Corporation', 'Corporation'),
    ('Tirunelveli', 'Ambasamudram', 'Municipality'), ('Tirunelveli', 'Vickramasingapuram', 'Municipality'), ('Tirunelveli', 'Kalakad', 'Municipality'),
    ('Thoothukudi', 'Thoothukudi Municipal Corporation', 'Corporation'),
    ('Thoothukudi', 'Kovilpatti', 'Municipality'), ('Thoothukudi', 'Kayalpattinam', 'Municipality'),
    ('Virudhunagar', 'Sivakasi City Municipal Corporation', 'Corporation'),
    ('Virudhunagar', 'Virudhunagar', 'Municipality'), ('Virudhunagar', 'Thiruthangal', 'Municipality'), ('Virudhunagar', 'Srivilliputhur', 'Municipality'), ('Virudhunagar', 'Sattur', 'Municipality'), ('Virudhunagar', 'Rajapalayam', 'Municipality'), ('Virudhunagar', 'Aruppukkottai', 'Municipality')
)
insert into public.locations (district_id, location_name, location_type, active)
select district.id, seed.location_name, seed.location_type, true
from seed_locations seed
join public.districts district on lower(btrim(district.district_name)) = lower(btrim(seed.district_name))
where not exists (
  select 1 from public.locations location
  where lower(btrim(location.location_name)) = lower(btrim(seed.location_name))
);

update public.locations
set active = true
where lower(btrim(location_name)) in (
  select lower(btrim(location_name)) from (
    values
      ('Dindigul City Municipal Corporation'), ('Palani'), ('Oddenchatram'), ('Kodaikanal'), ('Nagercoil Municipal Corporation'), ('Colachel'), ('Kuzhithurai'), ('Padmanabhapuram'), ('Kollemcode'), ('Kanniyakumari'), ('Madurai Municipal Corporation'), ('Melur'), ('Thirumangalam'), ('Usilampatti'), ('Ramanathapuram'), ('Rameswaram'), ('Kilakarai'), ('Paramakudi'), ('Karaikkudi Municipal Corporation'), ('Sivagangai'), ('Devakottai'), ('Manamadurai'), ('Tenkasi'), ('Sengottai'), ('Kadayanallur'), ('Puliyankudi'), ('Surandai'), ('Sankarankovil'), ('Bodinayakanur'), ('Chinnamanur'), ('Gudalur'), ('Cumbum'), ('Periyakulam'), ('Theni Allinagaram'), ('Tirunelveli Municipal Corporation'), ('Ambasamudram'), ('Vickramasingapuram'), ('Kalakad'), ('Thoothukudi Municipal Corporation'), ('Kovilpatti'), ('Kayalpattinam'), ('Sivakasi City Municipal Corporation'), ('Virudhunagar'), ('Thiruthangal'), ('Srivilliputhur'), ('Sattur'), ('Rajapalayam'), ('Aruppukkottai')
  ) as approved(location_name)
);

insert into public.employee_visit_places (employee_id, place_name, is_active)
select 'EMP004', location.location_name, true
from public.locations location
where location.active
on conflict (employee_id, lower(place_name))
do update set is_active = true;

do $$
declare
  v_districts integer;
  v_corporations integer;
  v_municipalities integer;
  v_locations integer;
  v_duplicates integer;
begin
  select count(*) into v_districts from public.districts where active;
  select count(*) filter (where location_type = 'Corporation'), count(*) filter (where location_type = 'Municipality'), count(*)
  into v_corporations, v_municipalities, v_locations
  from public.locations where active;
  select count(*) into v_duplicates
  from (
    select lower(btrim(location_name))
    from public.locations
    group by lower(btrim(location_name))
    having count(*) > 1
  ) duplicates;
  if v_districts <> 10 or v_corporations <> 7 or v_municipalities <> 41 or v_locations <> 48 or v_duplicates <> 0 then
    raise exception 'LOCATION_MASTER_SEED_VALIDATION_FAILED';
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;