-- Resolve the 2026-08-03 Security Advisor findings without changing the
-- application's authenticated Admin RPC or ownership-based RLS model.

-- Function identities were read from pg_proc using
-- pg_get_function_identity_arguments before this migration was authored.
alter function public.current_role_name() set search_path = '';
alter function public.current_employee_id() set search_path = '';
alter function public.is_admin() set search_path = '';
alter function public.is_admin_or_director() set search_path = '';
alter function public.set_updated_at() set search_path = '';
alter function public.handle_new_auth_user() set search_path = '';
alter function public.admin_update_user_with_visit_places(uuid, jsonb, text[]) set search_path = '';

-- RLS policies call the four helpers as authenticated users. Keep only that
-- required client grant; anonymous users must not invoke them over PostgREST.
revoke execute on function public.current_role_name() from public, anon;
revoke execute on function public.current_employee_id() from public, anon;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.is_admin_or_director() from public, anon;
grant execute on function public.current_role_name() to authenticated;
grant execute on function public.current_employee_id() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_admin_or_director() to authenticated;

-- Trigger functions have no supported direct RPC use. Revoking client EXECUTE
-- does not disable triggers already attached by their owning role.
revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- The Admin UI intentionally invokes this function as an authenticated user;
-- its first operation independently verifies an active public.profiles Admin.
revoke execute on function public.admin_update_user_with_visit_places(uuid, jsonb, text[])
from public, anon;
grant execute on function public.admin_update_user_with_visit_places(uuid, jsonb, text[])
to authenticated;

-- Bind every new client-authored activity row to the authenticated profile.
-- Historical rows remain nullable because their actor cannot be reconstructed
-- reliably from a free-form legacy label.
alter table public.activity_logs
  add column if not exists actor_user_id uuid references auth.users(id) on delete set null,
  add column if not exists employee_id text,
  add column if not exists actor_role text;

create or replace function public.prepare_activity_log_actor()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor public.profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'ACTIVITY_LOG_AUTH_REQUIRED';
  end if;

  select profile.*
  into actor
  from public.profiles profile
  where profile.id = auth.uid()
    and profile.status = 'Active';

  if not found then
    raise exception using errcode = '42501', message = 'ACTIVITY_LOG_ACTOR_INVALID';
  end if;

  new.actor_user_id := actor.id;
  new.employee_id := actor.employee_id;
  new.actor_role := actor.role;
  new.user_label := coalesce(actor.full_name, actor.username, actor.employee_id)
    || ' (' || actor.employee_id || ')';
  new.timestamp := coalesce(nullif(btrim(new.timestamp), ''), to_char(now(), 'DD/MM/YYYY, HH12:MI AM'));
  return new;
end;
$$;

revoke execute on function public.prepare_activity_log_actor() from public, anon, authenticated;

drop trigger if exists prepare_activity_log_actor on public.activity_logs;
create trigger prepare_activity_log_actor
before insert on public.activity_logs
for each row execute function public.prepare_activity_log_actor();

drop policy if exists "activity_logs_insert" on public.activity_logs;
create policy "activity_logs_insert"
on public.activity_logs
for insert
to authenticated
with check (
  actor_user_id = (select auth.uid())
  and employee_id = (select public.current_employee_id())
  and actor_role = (select public.current_role_name())
  and (
    (select public.is_admin())
    or (
      actor_role = 'Director'
      and module in ('Authentication', 'Director Comments', 'Tour Plan Review', 'Daily Report Management')
    )
    or (
      actor_role in ('Marketing', 'Marketing Team')
      and module in ('Authentication', 'Follow-up Management', 'Tour Plan', 'Visit Plan', 'Visit Status', 'Daily Report')
    )
  )
);

-- Stamp notification provenance server-side. This prevents callers from
-- impersonating another employee or role even if they supply forged columns.
alter table public.notifications
  add column if not exists creator_user_id uuid references auth.users(id) on delete set null,
  add column if not exists creator_employee_id text,
  add column if not exists creator_role text;

create or replace function public.prepare_notification_creator()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  creator public.profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'NOTIFICATION_AUTH_REQUIRED';
  end if;

  select profile.*
  into creator
  from public.profiles profile
  where profile.id = auth.uid()
    and profile.status = 'Active';

  if not found then
    raise exception using errcode = '42501', message = 'NOTIFICATION_CREATOR_INVALID';
  end if;

  new.creator_user_id := creator.id;
  new.creator_employee_id := creator.employee_id;
  new.creator_role := creator.role;
  new.is_read := false;
  return new;
end;
$$;

revoke execute on function public.prepare_notification_creator() from public, anon, authenticated;

drop trigger if exists prepare_notification_creator on public.notifications;
create trigger prepare_notification_creator
before insert on public.notifications
for each row execute function public.prepare_notification_creator();

drop policy if exists "notifications_insert" on public.notifications;
create policy "notifications_insert"
on public.notifications
for insert
to authenticated
with check (
  creator_user_id = (select auth.uid())
  and creator_employee_id = (select public.current_employee_id())
  and creator_role = (select public.current_role_name())
  and (
    (select public.is_admin())
    or (
      creator_role = 'Director'
      and type in ('plan', 'director_feedback')
      and exists (
        select 1
        from public.profiles recipient
        where recipient.employee_id = notifications.user_id
          and recipient.role in ('Marketing', 'Marketing Team')
          and recipient.status = 'Active'
      )
    )
    or (
      creator_role in ('Marketing', 'Marketing Team')
      and type = 'plan'
      and title in (
        'Weekly tour plan submitted',
        'Monthly tour plan submitted',
        'New Visit Plan Submitted',
        'Visit plan submitted',
        'Visit plan awaiting review'
      )
      and exists (
        select 1
        from public.profiles recipient
        where recipient.employee_id = notifications.user_id
          and recipient.role = 'Director'
          and recipient.status = 'Active'
      )
      and exists (
        select 1
        from public.profiles creator
        where creator.id = (select auth.uid())
          and notifications.message like coalesce(creator.full_name, creator.username, creator.employee_id) || '%'
      )
    )
  )
);

-- Tender UI and write workflows have been retired. Preserve historical rows
-- for Admin audit while removing all normal authenticated mutations.
drop policy if exists "tenders_insert" on public.tenders;
drop policy if exists "tenders_update" on public.tenders;
drop policy if exists "tenders_select" on public.tenders;
drop policy if exists "tenders_select_admin" on public.tenders;
create policy "tenders_select_admin"
on public.tenders
for select
to authenticated
using ((select public.is_admin()));

revoke all on table public.tenders from anon;
revoke insert, update, delete on table public.tenders from authenticated;
grant select on table public.tenders to authenticated;

notify pgrst, 'reload schema';
