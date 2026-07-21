-- ============================================================================
-- Kaiser Whale Marketing Visit Management System — Production Supabase Schema
-- ============================================================================
-- Run this entire file once in the Supabase SQL Editor (Project > SQL Editor)
-- on your production project. It is idempotent (safe to re-run).
--
-- After running this file:
--   1. Create the actual login users in Authentication > Users (email + password)
--      OR let them sign up, then insert a matching row into `profiles` with the
--      same `id` (auth.users.id) and the correct `role`.
--   2. Update the `profiles` seed rows below (or insert your own) with the
--      real auth user UUIDs before relying on role-based dashboards.
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
  employee_name text not null,
  username text unique,
  role text not null check (role in ('Admin', 'Director', 'Marketing Team')),
  mobile text,
  email text,
  status text not null default 'Active' check (status in ('Active', 'Inactive')),
  department text,
  designation text,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text,
  category text,
  status text not null default 'Active' check (status in ('Active', 'Disabled')),
  display_order int not null default 0
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
  notes text
);

create table if not exists public.visit_plans (
  id uuid primary key default gen_random_uuid(),
  employee_id text not null,
  employee_name text,
  visit_date date not null,
  expected_time text,
  customer_id uuid references public.customers (id) on delete set null,
  customer_name text,
  organization_type text,
  contact_person text,
  mobile text,
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
  created_at timestamptz not null default now()
);

create table if not exists public.visit_reports (
  id uuid primary key default gen_random_uuid(),
  visit_plan_id uuid references public.visit_plans (id) on delete set null,
  employee_id text not null,
  employee_name text,
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
  is_locked boolean not null default false
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
  is_locked boolean not null default false
);

create table if not exists public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  employee_id text not null,
  employee_name text,
  customer_id uuid references public.customers (id) on delete set null,
  customer_name text,
  follow_up_date date,
  type text,
  purpose text,
  priority text default 'Medium',
  status text not null default 'Pending',
  notes text
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
  assigned_employee_name text
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
  created_at timestamptz not null default now()
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
  using (public.is_admin_or_director() or employee_id = public.current_employee_id());

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
-- OPTIONAL: seed profiles for existing Auth users.
-- Replace the UUIDs below with the real `id` values from Authentication > Users
-- after creating each account, then run just this block.
-- ============================================================================
-- insert into public.profiles (id, employee_id, employee_name, username, role, mobile, email, status, department, designation)
-- values
--   ('00000000-0000-0000-0000-000000000000', 'EMP000', 'System Administrator', 'admin', 'Admin', '9876543210', 'admin@kaiserwhale.com', 'Active', 'Management', 'General Manager'),
--   ('00000000-0000-0000-0000-000000000001', 'DIR001', 'Director Rajesh', 'director', 'Director', '9876543211', 'director@kaiserwhale.com', 'Active', 'Executive', 'Managing Director');
