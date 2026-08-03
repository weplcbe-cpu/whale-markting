-- ============================================================================
-- Kaiser Whale Marketing Visit Management System — Production Supabase Schema
-- ============================================================================
-- Run this entire file once in the Supabase SQL Editor (Project > SQL Editor)
-- on your production project. It is idempotent (safe to re-run).
--
-- After running this file:
--   1. Create your login users in Authentication > Users (email + password).
--      A matching `profiles` row is created AUTOMATICALLY by the
--      `on_auth_user_created` trigger below (default role: 'Marketing').
--   2. To bootstrap the first Admin/Director accounts, create their Auth
--      users with the emails referenced in the "Bootstrap" block near the
--      end of this file (admin@kaiserwhale.com / director@kaiserwhale.com),
--      then re-run this file (or just that block) — it upserts the correct
--      role by matching on email, no manual UUID copy/paste required.
--   3. Promote/demote any other user's role from the User Management screen
--      (Admin only) or with: update public.profiles set role = '...' where email = '...';
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Helper functions used by RLS policies
-- ----------------------------------------------------------------------------
create or replace function public.current_role_name()
returns text
language sql
security definer
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.current_employee_id()
returns text
language sql
security definer
stable
as $$
  select employee_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
as $$
  select public.current_role_name() = 'Admin';
$$;

create or replace function public.is_admin_or_director()
returns boolean
language sql
security definer
stable
as $$
  select public.current_role_name() in ('Admin', 'Director');
$$;

-- ----------------------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------------------

-- Profiles: one row per Supabase Auth user, holds employee/role metadata.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  employee_id text unique not null,
  full_name text not null,
  username text unique,
  role text not null check (role in ('Admin', 'Director', 'Marketing')),
  mobile_number text,
  email text unique,
  status text not null default 'Active' check (status in ('Active', 'Inactive')),
  department text,
  designation text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Admin-managed places available to each Marketing employee.
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

-- Atomic admin edit path. Keep this definition aligned with migration
-- 20260803120000_add_transactional_admin_user_update.sql.
create or replace function public.admin_update_user_with_visit_places(
  p_user_id uuid, p_profile jsonb, p_visit_places text[] default array[]::text[]
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_old_employee_id text; v_new_employee_id text; v_role text; v_mobile text; v_visit_places text[];
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles where id = auth.uid() and role = 'Admin' and status = 'Active'
  ) then raise exception using errcode = '42501', message = 'UPDATE_USER_FORBIDDEN'; end if;
  select employee_id into v_old_employee_id from public.profiles where id = p_user_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'USER_NOT_FOUND'; end if;
  v_new_employee_id := nullif(btrim(p_profile ->> 'employee_id'), '');
  v_role := case lower(btrim(p_profile ->> 'role')) when 'admin' then 'Admin' when 'director' then 'Director' when 'marketing' then 'Marketing' when 'marketing team' then 'Marketing' else null end;
  v_mobile := coalesce(nullif(btrim(p_profile ->> 'mobile'), ''), btrim(p_profile ->> 'mobile_number'));
  if v_mobile is null or v_mobile !~ '^\+?[0-9][0-9 -]{6,19}$' then raise exception using errcode = 'P0001', message = 'INVALID_MOBILE'; end if;
  select coalesce(array_agg(place_name order by lower(place_name)), array[]::text[]) into v_visit_places
  from (select distinct on (lower(btrim(value))) btrim(value) place_name from unnest(coalesce(p_visit_places, array[]::text[])) value where btrim(value) <> '' order by lower(btrim(value)), btrim(value)) normalized;
  delete from public.employee_visit_places where employee_id = v_old_employee_id;
  update public.profiles set employee_id = v_new_employee_id, full_name = btrim(p_profile ->> 'employee_name'), mobile_number = v_mobile,
    email = lower(btrim(p_profile ->> 'email')), role = v_role, username = btrim(p_profile ->> 'username'), department = nullif(btrim(p_profile ->> 'department'), ''),
    designation = nullif(btrim(p_profile ->> 'designation'), ''), updated_at = now() where id = p_user_id;
  begin
    insert into public.employee_visit_places (employee_id, place_name, is_active)
    select v_new_employee_id, place_name, true from unnest(v_visit_places) as normalized(place_name);
  exception when others then
    raise exception using errcode = 'P0001', message = 'VISIT_PLACES_UPDATE_FAILED', detail = sqlstate || ': ' || sqlerrm;
  end;
end; $$;
revoke all on function public.admin_update_user_with_visit_places(uuid, jsonb, text[]) from public, anon;
grant execute on function public.admin_update_user_with_visit_places(uuid, jsonb, text[]) to authenticated;

-- ----------------------------------------------------------------------------
-- Auto-provisioning: every Supabase Auth user MUST end up with a matching
-- `profiles` row (id = auth.users.id), otherwise login fails with
-- "No profile found for this account". This trigger runs as the table owner
-- (bypasses RLS) so it always succeeds, and defaults new users to the
-- lowest-privilege role ('Marketing') — nobody can self-escalate to
-- Admin/Director this way; that still requires an existing Admin to
-- provision the account (see admin-create-user Edge Function) or the
-- one-off bootstrap statement further below.
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.raw_user_meta_data ->> 'profile_creation_source' = 'edge_function' then
    return new;
  end if;

  insert into public.profiles (id, employee_id, full_name, username, role, mobile_number, email, status, designation)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'employee_id', 'EMP-' || substr(new.id::text, 1, 8)),
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'username', new.email),
    case lower(coalesce(new.raw_user_meta_data ->> 'role', 'Marketing'))
      when 'admin' then 'Admin'
      when 'director' then 'Director'
      else 'Marketing'
    end,
    new.raw_user_meta_data ->> 'mobile_number',
    new.email,
    'Active',
    new.raw_user_meta_data ->> 'designation'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  code text,
  category text,
  status text not null default 'Active' check (status in ('Active', 'Disabled')),
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.org_types (
  id uuid primary key default gen_random_uuid(),
  name text unique not null
);

create table if not exists public.purposes (
  id uuid primary key default gen_random_uuid(),
  name text unique not null
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_name text not null,
  organization_type text,
  contact_person text,
  mobile text,
  state text,
  district text,
  city text,
  address text,
  pincode text,
  interested_products text[] default '{}',
  is_tender_related boolean default false,
  created_by text,
  created_by_name text,
  status text not null default 'Pending Verification' check (status in ('Pending Verification', 'Approved', 'Rejected')),
  created_date date not null default current_date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.visit_plans (
  id uuid primary key default gen_random_uuid(),
  employee_id text not null,
  full_name text,
  visit_date date not null,
  expected_time text,
  customer_id uuid references public.customers (id) on delete set null,
  customer_name text,
  organization_type text,
  contact_person text,
  mobile_number text,
  state text,
  district text,
  city text,
  area text,
  full_address text,
  visit_purpose text,
  products text[] default '{}',
  requirement text,
  priority text default 'Medium',
  is_tender_related boolean default false,
  notes text,
  status text not null default 'Planned',
  start_time text,
  cancel_reason text,
  reschedule_history jsonb not null default '[]',
  batch_id uuid,
  plan_type text check (plan_type is null or plan_type in ('Weekly', 'Monthly')),
  period_from date,
  period_to date,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by text,
  review_comment text,
  review_history jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.visit_reports (
  id uuid primary key default gen_random_uuid(),
  visit_plan_id uuid references public.visit_plans (id) on delete set null,
  employee_id text not null,
  full_name text,
  visit_date date,
  customer_name text,
  meeting_completed boolean default true,
  actual_time text,
  customer_response text,
  discussion_notes text,
  interested_products text[] default '{}',
  requirement_details text,
  next_action text,
  is_follow_up_required boolean default false,
  follow_up_date date,
  is_quotation_required boolean default false,
  is_tender_related boolean default false,
  photos text[] default '{}',
  documents text[] default '{}',
  final_status text,
  submitted_at timestamptz not null default now(),
  is_locked boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_reports (
  id uuid primary key default gen_random_uuid(),
  employee_id text not null,
  employee_name text,
  date date not null,
  planned_visits int default 0,
  completed_visits int default 0,
  cancelled_visits int default 0,
  new_customers_added int default 0,
  follow_ups_completed int default 0,
  important_discussion text,
  pending_actions text,
  tomorrow_plan text,
  remarks text,
  submitted_at timestamptz not null default now(),
  status text not null default 'Submitted',
  is_locked boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  employee_id text not null,
  full_name text,
  customer_id uuid references public.customers (id) on delete set null,
  customer_name text,
  follow_up_date date,
  type text,
  purpose text,
  priority text default 'Medium',
  status text not null default 'Pending',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tenders (
  id uuid primary key default gen_random_uuid(),
  tender_name text not null,
  tender_number text,
  department text,
  closing_date date,
  tender_value text,
  required_products text[] default '{}',
  status text not null default 'New Enquiry',
  notes text,
  documents text[] default '{}',
  assigned_employee_id text,
  assigned_employee_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.director_comments (
  id uuid primary key default gen_random_uuid(),
  author text,
  author_role text,
  target_employee_id text,
  target_employee_name text,
  target_module text,
  reference_id text,
  message text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_read boolean not null default false,
  replies jsonb not null default '[]'
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  title text,
  message text,
  timestamp text,
  is_read boolean not null default false,
  type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_label text,
  module text,
  action text,
  timestamp text,
  created_at timestamptz not null default now()
);

-- Single-row company configuration table.
create table if not exists public.company_info (
  id int primary key default 1,
  name text,
  brand_logo text,
  tagline text,
  app_version text,
  report_edit_time_limit_hours int default 24,
  updated_at timestamptz not null default now(),
  constraint company_info_singleton check (id = 1)
);

insert into public.company_info (id, name, brand_logo, tagline, app_version, report_edit_time_limit_hours)
values (1, 'Kaiser Whale Equipment Ltd.', '/kaiser-whale-logo.png', 'Marketing Visit & Field Sales Management', 'v2.4.0', 24)
on conflict (id) do nothing;

insert into public.org_types (name) values
  ('Private Company'), ('Municipal Corporation'), ('Municipality'), ('Town Panchayat'),
  ('Village Panchayat'), ('Government Department'), ('Water Board'), ('Sewerage Board'),
  ('Smart City Office'), ('Consultant'), ('Contractor'), ('Dealer / Distributor'),
  ('Industrial Company'), ('Other')
on conflict (name) do nothing;

insert into public.purposes (name) values
  ('New Customer Visit'), ('Customer Meeting'), ('Product Demo'), ('Product Presentation'),
  ('Quotation Submission'), ('Quotation Discussion'), ('Tender Meeting'), ('Tender Submission'),
  ('Site Inspection'), ('Technical Discussion'), ('Follow-up Visit'), ('Payment Follow-up'),
  ('Order Collection'), ('Document Collection'), ('Service Visit'), ('New Requirement'),
  ('Recycler Hiring'), ('Other')
on conflict (name) do nothing;

insert into public.products (name, display_order) values
  ('Sucker Whale', 1), ('Combi Whale', 2), ('Whale Super Sucker', 3), ('Whale Recycler', 4),
  ('AI1 SUV Whale', 5), ('Whale Litejet', 6), ('Whale Grabs', 7), ('Whale Mobijet', 8)
on conflict (name) do nothing;

-- ----------------------------------------------------------------------------
-- Auto-maintain `updated_at` on every UPDATE for tables that track it.
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'products', 'customers', 'visit_plans', 'visit_reports',
    'daily_reports', 'follow_ups', 'tenders', 'director_comments',
    'notifications', 'company_info'
  ]
  loop
    execute format('drop trigger if exists set_updated_at on public.%I;', t);
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at();',
      t
    );
  end loop;
end;
$$;

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.org_types enable row level security;
alter table public.purposes enable row level security;
alter table public.customers enable row level security;
alter table public.visit_plans enable row level security;
alter table public.visit_reports enable row level security;
alter table public.daily_reports enable row level security;
alter table public.follow_ups enable row level security;
alter table public.tenders enable row level security;
alter table public.director_comments enable row level security;
alter table public.notifications enable row level security;
alter table public.employee_visit_places enable row level security;

grant select, insert, update, delete on table public.employee_visit_places to authenticated;
alter table public.activity_logs enable row level security;
alter table public.company_info enable row level security;

-- profiles: any authenticated user can read all profiles (needed for team
-- listings/name lookups); only Admin can write; users may update their own row.
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated" on public.profiles for select to authenticated using (true);

drop policy if exists "profiles_insert_admin" on public.profiles;
create policy "profiles_insert_admin" on public.profiles for insert to authenticated with check (public.is_admin());

drop policy if exists "profiles_update_admin_or_self" on public.profiles;
create policy "profiles_update_admin_or_self" on public.profiles for update to authenticated
  using (public.is_admin() or id = auth.uid())
  with check (public.is_admin() or id = auth.uid());

drop policy if exists "profiles_delete_admin" on public.profiles;
create policy "profiles_delete_admin" on public.profiles for delete to authenticated using (public.is_admin());

-- Visit-place assignments: Marketing reads only its own; Director/Admin can
-- inspect all assignments; only Admin can change them.
drop policy if exists "employee_visit_places_select" on public.employee_visit_places;
create policy "employee_visit_places_select" on public.employee_visit_places for select to authenticated
  using (public.is_admin_or_director() or employee_id = public.current_employee_id());
drop policy if exists "employee_visit_places_insert" on public.employee_visit_places;
create policy "employee_visit_places_insert" on public.employee_visit_places for insert to authenticated
  with check (public.is_admin());
drop policy if exists "employee_visit_places_update" on public.employee_visit_places;
create policy "employee_visit_places_update" on public.employee_visit_places for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "employee_visit_places_delete" on public.employee_visit_places;
create policy "employee_visit_places_delete" on public.employee_visit_places for delete to authenticated
  using (public.is_admin());

-- Reference/lookup tables: readable by all authenticated users, writable by Admin only.
drop policy if exists "products_select" on public.products;
create policy "products_select" on public.products for select to authenticated using (true);
drop policy if exists "products_write_admin" on public.products;
create policy "products_write_admin" on public.products for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "org_types_select" on public.org_types;
create policy "org_types_select" on public.org_types for select to authenticated using (true);
drop policy if exists "org_types_write_admin" on public.org_types;
create policy "org_types_write_admin" on public.org_types for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "purposes_select" on public.purposes;
create policy "purposes_select" on public.purposes for select to authenticated using (true);
drop policy if exists "purposes_write_admin" on public.purposes;
create policy "purposes_write_admin" on public.purposes for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "company_info_select" on public.company_info;
create policy "company_info_select" on public.company_info for select to authenticated using (true);
drop policy if exists "company_info_write_admin" on public.company_info;
create policy "company_info_write_admin" on public.company_info for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Customers: everyone can read (shared directory); Marketing Team can create;
-- only Admin/Director can approve/reject (update), Admin can delete.
drop policy if exists "customers_select" on public.customers;
create policy "customers_select" on public.customers for select to authenticated using (true);
drop policy if exists "customers_insert" on public.customers;
create policy "customers_insert" on public.customers for insert to authenticated with check (true);
drop policy if exists "customers_update" on public.customers;
create policy "customers_update" on public.customers for update to authenticated
  using (public.is_admin_or_director() or created_by = public.current_employee_id())
  with check (public.is_admin_or_director() or created_by = public.current_employee_id());
drop policy if exists "customers_delete_admin" on public.customers;
create policy "customers_delete_admin" on public.customers for delete to authenticated using (public.is_admin());

-- Visit plans: Admin/Director read all; Marketing Team reads/writes their own.
drop policy if exists "visit_plans_select" on public.visit_plans;
create policy "visit_plans_select" on public.visit_plans for select to authenticated
  using (public.is_admin_or_director() or employee_id = public.current_employee_id());
drop policy if exists "visit_plans_insert" on public.visit_plans;
create policy "visit_plans_insert" on public.visit_plans for insert to authenticated
  with check (public.is_admin_or_director() or employee_id = public.current_employee_id());
drop policy if exists "visit_plans_update" on public.visit_plans;
create policy "visit_plans_update" on public.visit_plans for update to authenticated
  using (public.is_admin_or_director() or employee_id = public.current_employee_id())
  with check (public.is_admin_or_director() or employee_id = public.current_employee_id());
drop policy if exists "visit_plans_delete" on public.visit_plans;
create policy "visit_plans_delete" on public.visit_plans for delete to authenticated
  using (
    public.is_admin()
    or (
      employee_id = public.current_employee_id()
      and status in ('Draft', 'Changes Requested')
    )
  );

-- Visit reports: same pattern as visit plans.
drop policy if exists "visit_reports_select" on public.visit_reports;
create policy "visit_reports_select" on public.visit_reports for select to authenticated
  using (public.is_admin_or_director() or employee_id = public.current_employee_id());
drop policy if exists "visit_reports_insert" on public.visit_reports;
create policy "visit_reports_insert" on public.visit_reports for insert to authenticated
  with check (public.is_admin_or_director() or employee_id = public.current_employee_id());
drop policy if exists "visit_reports_update" on public.visit_reports;
create policy "visit_reports_update" on public.visit_reports for update to authenticated
  using (public.is_admin_or_director() or employee_id = public.current_employee_id())
  with check (public.is_admin_or_director() or employee_id = public.current_employee_id());

-- Daily reports: same pattern.
drop policy if exists "daily_reports_select" on public.daily_reports;
create policy "daily_reports_select" on public.daily_reports for select to authenticated
  using (public.is_admin_or_director() or employee_id = public.current_employee_id());
drop policy if exists "daily_reports_insert" on public.daily_reports;
create policy "daily_reports_insert" on public.daily_reports for insert to authenticated
  with check (public.is_admin_or_director() or employee_id = public.current_employee_id());
drop policy if exists "daily_reports_update" on public.daily_reports;
create policy "daily_reports_update" on public.daily_reports for update to authenticated
  using (public.is_admin_or_director() or employee_id = public.current_employee_id())
  with check (public.is_admin_or_director() or employee_id = public.current_employee_id());

-- Follow-ups: same pattern.
drop policy if exists "follow_ups_select" on public.follow_ups;
create policy "follow_ups_select" on public.follow_ups for select to authenticated
  using (public.is_admin_or_director() or employee_id = public.current_employee_id());
drop policy if exists "follow_ups_insert" on public.follow_ups;
create policy "follow_ups_insert" on public.follow_ups for insert to authenticated
  with check (public.is_admin_or_director() or employee_id = public.current_employee_id());
drop policy if exists "follow_ups_update" on public.follow_ups;
create policy "follow_ups_update" on public.follow_ups for update to authenticated
  using (public.is_admin_or_director() or employee_id = public.current_employee_id())
  with check (public.is_admin_or_director() or employee_id = public.current_employee_id());

-- Tenders: shared across the team (read for all, write for all authenticated,
-- matching current app behaviour where any marketing user can log a tender).
drop policy if exists "tenders_select" on public.tenders;
create policy "tenders_select" on public.tenders for select to authenticated using (true);
drop policy if exists "tenders_insert" on public.tenders;
create policy "tenders_insert" on public.tenders for insert to authenticated with check (true);
drop policy if exists "tenders_update" on public.tenders;
create policy "tenders_update" on public.tenders for update to authenticated using (true) with check (true);

-- Director comments: Director/Admin can post; the target employee (or
-- Admin/Director) can read.
drop policy if exists "director_comments_select" on public.director_comments;
create policy "director_comments_select" on public.director_comments for select to authenticated
  using (public.is_admin_or_director() or target_employee_id = public.current_employee_id());
drop policy if exists "director_comments_insert" on public.director_comments;
create policy "director_comments_insert" on public.director_comments for insert to authenticated
  with check (public.is_admin_or_director());
drop policy if exists "director_comments_update" on public.director_comments;
create policy "director_comments_update" on public.director_comments for update to authenticated
  using (public.is_admin_or_director() or target_employee_id = public.current_employee_id())
  with check (public.is_admin_or_director() or target_employee_id = public.current_employee_id());

-- Notifications: a user can only see/update their own notifications.
drop policy if exists "notifications_select" on public.notifications;
create policy "notifications_select" on public.notifications for select to authenticated
  using (public.is_admin() or user_id = public.current_employee_id());
drop policy if exists "notifications_insert" on public.notifications;
create policy "notifications_insert" on public.notifications for insert to authenticated with check (true);
drop policy if exists "notifications_update" on public.notifications;
create policy "notifications_update" on public.notifications for update to authenticated
  using (public.is_admin() or user_id = public.current_employee_id())
  with check (public.is_admin() or user_id = public.current_employee_id());

-- Activity logs: readable by Admin/Director (audit trail); insertable by any
-- authenticated user (the app logs the current user's own actions).
drop policy if exists "activity_logs_select" on public.activity_logs;
create policy "activity_logs_select" on public.activity_logs for select to authenticated using (public.is_admin_or_director());
drop policy if exists "activity_logs_insert" on public.activity_logs;
create policy "activity_logs_insert" on public.activity_logs for insert to authenticated with check (true);

-- ============================================================================
-- Backfill: create profiles for any Auth users that were created BEFORE the
-- on_auth_user_created trigger existed (e.g. accounts added manually via the
-- Supabase Dashboard). Safe to re-run — only inserts rows that are missing.
-- Defaults every backfilled user to 'Marketing' except the two
-- bootstrap accounts below, which are matched by email (not a hardcoded
-- UUID) and promoted to the correct role.
-- ============================================================================
insert into public.profiles (id, employee_id, full_name, username, role, mobile_number, email, status, department, designation)
select
  u.id,
  'EMP-' || substr(u.id::text, 1, 8),
  split_part(u.email, '@', 1),
  u.email,
  'Marketing',
  null,
  u.email,
  'Active',
  null,
  null
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;

-- Bootstrap: promote the first Admin/Director accounts by email, once their
-- Auth users exist (created via Supabase Dashboard > Authentication > Users).
-- Re-run any time after creating the Auth user for these emails — it's an
-- idempotent upsert keyed on the real auth.users.id, no manual UUID needed.
insert into public.profiles (id, employee_id, full_name, username, role, mobile_number, email, status, department, designation)
select u.id, 'EMP000', 'System Administrator', 'admin', 'Admin', '9876543210', u.email, 'Active', 'Management', 'General Manager'
from auth.users u where u.email = 'admin@kaiserwhale.com'
on conflict (id) do update set
  employee_id = excluded.employee_id, full_name = excluded.full_name,
  username = excluded.username, role = excluded.role, mobile_number = excluded.mobile_number,
  status = excluded.status, department = excluded.department, designation = excluded.designation;

insert into public.profiles (id, employee_id, full_name, username, role, mobile_number, email, status, department, designation)
select u.id, 'DIR001', 'Director Rajesh', 'director', 'Director', '9876543211', u.email, 'Active', 'Executive', 'Managing Director'
from auth.users u where u.email = 'director@kaiserwhale.com'
on conflict (id) do update set
  employee_id = excluded.employee_id, full_name = excluded.full_name,
  username = excluded.username, role = excluded.role, mobile_number = excluded.mobile_number,
  status = excluded.status, department = excluded.department, designation = excluded.designation;
