-- Canonicalize the marketing role without losing existing profile data.
update public.profiles
set role = 'Marketing'
where role = 'Marketing Team';

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('Admin', 'Director', 'Marketing'));

create unique index if not exists profiles_email_lower_unique
  on public.profiles (lower(email))
  where email is not null;

-- Admin-created users are fully provisioned by admin-create-user. Normal
-- signups remain supported here, with safe fallbacks for optional metadata.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_role text;
begin
  if new.raw_user_meta_data ->> 'profile_creation_source' = 'edge_function' then
    return new;
  end if;

  normalized_role := case lower(coalesce(new.raw_user_meta_data ->> 'role', 'Marketing'))
    when 'admin' then 'Admin'
    when 'director' then 'Director'
    when 'marketing team' then 'Marketing'
    when 'marketing' then 'Marketing'
    else 'Marketing'
  end;

  insert into public.profiles (
    id,
    full_name,
    employee_id,
    username,
    email,
    mobile_number,
    role,
    status,
    designation
  )
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(coalesce(new.email, new.id::text), '@', 1)),
    coalesce(nullif(new.raw_user_meta_data ->> 'employee_id', ''), 'EMP-' || substr(new.id::text, 1, 8)),
    coalesce(nullif(new.raw_user_meta_data ->> 'username', ''), new.email, new.id::text),
    new.email,
    nullif(new.raw_user_meta_data ->> 'mobile_number', ''),
    normalized_role,
    'Active',
    nullif(new.raw_user_meta_data ->> 'designation', '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
