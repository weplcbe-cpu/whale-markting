-- BEFORE INSERT triggers authoritatively overwrite provenance columns, but RLS
-- WITH CHECK may evaluate independently of those generated values. Authorize
-- the caller and business event here; keep identity stamping in the triggers.

drop policy if exists "activity_logs_insert" on public.activity_logs;
create policy "activity_logs_insert"
on public.activity_logs
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles actor
    where actor.id = (select auth.uid())
      and actor.status = 'Active'
      and (
        actor.role = 'Admin'
        or (
          actor.role = 'Director'
          and activity_logs.module in (
            'Authentication', 'Director Comments', 'Tour Plan Review', 'Daily Report Management'
          )
        )
        or (
          actor.role in ('Marketing', 'Marketing Team')
          and activity_logs.module in (
            'Authentication', 'Follow-up Management', 'Tour Plan',
            'Visit Plan', 'Visit Status', 'Daily Report'
          )
        )
      )
  )
);

drop policy if exists "notifications_insert" on public.notifications;
create policy "notifications_insert"
on public.notifications
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles creator
    where creator.id = (select auth.uid())
      and creator.status = 'Active'
      and (
        creator.role = 'Admin'
        or (
          creator.role = 'Director'
          and notifications.type in ('plan', 'director_feedback')
          and exists (
            select 1
            from public.profiles recipient
            where recipient.employee_id = notifications.user_id
              and recipient.role in ('Marketing', 'Marketing Team')
              and recipient.status = 'Active'
          )
        )
        or (
          creator.role in ('Marketing', 'Marketing Team')
          and notifications.type = 'plan'
          and notifications.title in (
            'Weekly tour plan submitted',
            'Monthly tour plan submitted',
            'New Visit Plan Submitted',
            'Visit plan submitted',
            'Visit plan awaiting review'
          )
          and notifications.message like coalesce(creator.full_name, creator.username, creator.employee_id) || '%'
          and exists (
            select 1
            from public.profiles recipient
            where recipient.employee_id = notifications.user_id
              and recipient.role = 'Director'
              and recipient.status = 'Active'
          )
        )
      )
  )
);

notify pgrst, 'reload schema';
