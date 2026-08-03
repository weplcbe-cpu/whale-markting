-- Update an employee profile and its assigned visit places atomically.
-- The function performs its own active-admin check before its definer rights
-- are used, and is callable only by authenticated users.
create or replace function public.admin_update_user_with_visit_places(
  p_user_id uuid,
  p_profile jsonb,
  p_places text[] default array[]::text[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_employee_id text;
  v_new_employee_id text;
  v_role text;
  v_mobile text;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'UPDATE_USER_FORBIDDEN';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'Admin' and status = 'Active'
  ) then
    raise exception using errcode = '42501', message = 'UPDATE_USER_FORBIDDEN';
  end if;

  select employee_id into v_old_employee_id
  from public.profiles where id = p_user_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'USER_NOT_FOUND';
  end if;

  v_new_employee_id := nullif(btrim(p_profile ->> 'employee_id'), '');
  v_role := case lower(btrim(p_profile ->> 'role'))
    when 'admin' then 'Admin'
    when 'director' then 'Director'
    when 'marketing' then 'Marketing'
    when 'marketing team' then 'Marketing'
    else null
  end;
  v_mobile := btrim(p_profile ->> 'mobile');
  if v_mobile is null then v_mobile := btrim(p_profile ->> 'mobile_number'); end if;

  if v_mobile is null or v_mobile !~ '^\+?[0-9][0-9 -]{6,19}$' then
    raise exception using errcode = 'P0001', message = 'INVALID_MOBILE';
  end if;
  if v_role = 'Marketing' and coalesce(array_length(p_places, 1), 0) = 0 then
    raise exception using errcode = 'P0001', message = 'VISIT_PLACES_REQUIRED';
  end if;

  -- Delete first so employee_id can change without violating the child FK.
  delete from public.employee_visit_places where employee_id = v_old_employee_id;

  update public.profiles set
    employee_id = v_new_employee_id,
    full_name = btrim(p_profile ->> 'employee_name'),
    mobile_number = v_mobile,
    email = lower(btrim(p_profile ->> 'email')),
    role = v_role,
    username = btrim(p_profile ->> 'username'),
    department = nullif(btrim(p_profile ->> 'department'), ''),
    designation = nullif(btrim(p_profile ->> 'designation'), ''),
    updated_at = now()
  where id = p_user_id;

  begin
    insert into public.employee_visit_places (employee_id, place_name, is_active)
    select v_new_employee_id, place_name, true
    from (
      select distinct btrim(value) as place_name
      from unnest(coalesce(p_places, array[]::text[])) value
      where btrim(value) <> ''
    ) normalized_places;
  exception when others then
    raise exception using
      errcode = 'P0001',
      message = 'VISIT_PLACES_UPDATE_FAILED',
      detail = sqlstate || ': ' || sqlerrm;
  end;
end;
$$;

revoke all on function public.admin_update_user_with_visit_places(uuid, jsonb, text[]) from public, anon;
grant execute on function public.admin_update_user_with_visit_places(uuid, jsonb, text[]) to authenticated;
