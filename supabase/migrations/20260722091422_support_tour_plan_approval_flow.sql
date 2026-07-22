-- Store weekly and monthly tour-plan submissions in the existing visit_plans
-- table. One batch_id groups the individual visit rows submitted together.
alter table public.visit_plans
  add column if not exists batch_id uuid,
  add column if not exists plan_type text,
  add column if not exists period_from date,
  add column if not exists period_to date,
  add column if not exists submitted_at timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by text,
  add column if not exists review_comment text,
  add column if not exists review_history jsonb not null default '[]'::jsonb;

update public.visit_plans
set status = case lower(trim(status))
  when 'submitted' then 'Pending Approval'
  when 'submitted for director approval' then 'Pending Approval'
  when 'pending approval' then 'Pending Approval'
  when 'pendingapproval' then 'Pending Approval'
  else status
end
where lower(trim(status)) in (
  'submitted',
  'submitted for director approval',
  'pending approval',
  'pendingapproval'
);

update public.visit_plans
set plan_type = case
  when period_from is not null and period_to is not null
    and (period_to - period_from) > 7 then 'Monthly'
  else 'Weekly'
end
where plan_type is null;

alter table public.visit_plans
  drop constraint if exists visit_plans_plan_type_check;

alter table public.visit_plans
  add constraint visit_plans_plan_type_check
  check (plan_type is null or plan_type in ('Weekly', 'Monthly'));

create index if not exists visit_plans_review_queue_idx
  on public.visit_plans (status, plan_type, submitted_at desc);

create index if not exists visit_plans_batch_idx
  on public.visit_plans (batch_id);

-- Existing visit_plans_select policy already allows Admin/Director to read all
-- rows and Marketing employees to read only their own employee_id rows. Keep
-- RLS enabled and preserve that permission model.
