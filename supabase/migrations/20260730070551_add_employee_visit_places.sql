-- Admin-managed visit-place assignments for Marketing users.
create table if not exists public.employee_visit_places (
  id uuid primary key default gen_random_uuid(),
  employee_id text not null references public.profiles(employee_id) on delete cascade,
  place_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists employee_visit_places_employee_place_key
  on public.employee_visit_places (employee_id, lower(place_name));

create index if not exists employee_visit_places_employee_active_idx
  on public.employee_visit_places (employee_id, is_active);

alter table public.employee_visit_places enable row level security;

grant select, insert, update, delete
on table public.employee_visit_places
to authenticated;

drop policy if exists "employee_visit_places_select" on public.employee_visit_places;
create policy "employee_visit_places_select"
on public.employee_visit_places
for select
to authenticated
using (
  public.is_admin_or_director()
  or employee_id = public.current_employee_id()
);

drop policy if exists "employee_visit_places_insert" on public.employee_visit_places;
create policy "employee_visit_places_insert"
on public.employee_visit_places
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "employee_visit_places_update" on public.employee_visit_places;
create policy "employee_visit_places_update"
on public.employee_visit_places
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "employee_visit_places_delete" on public.employee_visit_places;
create policy "employee_visit_places_delete"
on public.employee_visit_places
for delete
to authenticated
using (public.is_admin());

notify pgrst, 'reload schema';
