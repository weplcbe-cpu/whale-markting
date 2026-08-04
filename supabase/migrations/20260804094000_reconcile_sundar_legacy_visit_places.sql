-- Remove legacy EMP004 places that are not backed by an active normalized territory
-- assignment. This keeps submit_marketing_visit_plan authorization aligned with
-- the approved South Tamil Nadu territory.
delete from public.employee_visit_places place
where place.employee_id = 'EMP004'
  and not exists (
    select 1
    from public.employee_territory_assignments assignment
    join public.local_bodies local_body on local_body.id = assignment.local_body_id
    where assignment.employee_id = place.employee_id
      and assignment.active
      and local_body.active
      and lower(btrim(local_body.local_body_name)) = lower(btrim(place.place_name))
  );

notify pgrst, 'reload schema';
