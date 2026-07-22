-- Recover the August plan that the previous UI marked submitted but only kept
-- in localStorage. The guard makes this safe when the plan already exists.
with plan_batch as (
  select gen_random_uuid() as id
  where exists (
    select 1 from public.profiles
    where employee_id = 'EMP002' and full_name = 'Fathima'
  )
  and not exists (
    select 1 from public.visit_plans
    where employee_id = 'EMP002'
      and plan_type = 'Monthly'
      and period_from = date '2026-08-01'
      and period_to = date '2026-08-31'
  )
), plan_entries (visit_date, area, products) as (
  values
    (date '2026-08-03', 'Tirunelveli', array['Super Sucker']::text[]),
    (date '2026-08-04', 'Thoothukudi', array['New Super Sucker', 'New Requirements', 'Recycler Hiring']::text[]),
    (date '2026-08-05', 'Dindigul', array['Service', 'New Requirements']::text[]),
    (date '2026-08-06', 'Madurai', array['Super Sucker', 'Recycler Hiring']::text[]),
    (date '2026-08-07', 'Sivakasi', array['Water Tanker']::text[]),
    (date '2026-08-08', 'Sivagangai', array['Service']::text[]),
    (date '2026-08-10', 'Nagercoil', array['New Requirements']::text[])
)
insert into public.visit_plans (
  employee_id, full_name, visit_date, area, district, city, products,
  requirement, priority, status, batch_id, plan_type, period_from,
  period_to, submitted_at
)
select
  'EMP002', 'Fathima', entry.visit_date, entry.area, entry.area, entry.area,
  entry.products, array_to_string(entry.products, ', '), 'Medium',
  'Pending Approval', batch.id, 'Monthly', date '2026-08-01',
  date '2026-08-31', now()
from plan_batch batch
cross join plan_entries entry;

insert into public.notifications (user_id, title, message, timestamp, is_read, type)
select
  employee_id,
  'Monthly tour plan awaiting review',
  'Fathima submitted 7 plan entries.',
  to_char(now(), 'DD/MM/YYYY, HH12:MI AM'),
  false,
  'plan'
from public.profiles
where role = 'Director'
  and status = 'Active'
  and not exists (
    select 1 from public.notifications notification
    where notification.user_id = profiles.employee_id
      and notification.title = 'Monthly tour plan awaiting review'
      and notification.message = 'Fathima submitted 7 plan entries.'
  );

insert into public.activity_logs (user_label, module, action, timestamp)
select
  'Fathima (EMP002)',
  'Tour Plan',
  'Submitted monthly tour plan with 7 entries for Director approval',
  to_char(now(), 'DD/MM/YYYY, HH12:MI AM')
where not exists (
  select 1 from public.activity_logs
  where user_label = 'Fathima (EMP002)'
    and module = 'Tour Plan'
    and action = 'Submitted monthly tour plan with 7 entries for Director approval'
);
