alter table public.follow_ups
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists outcome text,
  add column if not exists completion_notes text,
  add column if not exists previous_follow_up_date date,
  add column if not exists rescheduled_at timestamptz,
  add column if not exists reschedule_reason text;

update public.follow_ups
set status = case lower(btrim(status))
  when 'pending' then 'Pending'
  when 'in progress' then 'In Progress'
  when 'in_progress' then 'In Progress'
  when 'completed' then 'Completed'
  when 'cancelled' then 'Cancelled'
  when 'canceled' then 'Cancelled'
  else status
end;

alter table public.follow_ups
  drop constraint if exists follow_ups_status_check;
alter table public.follow_ups
  add constraint follow_ups_status_check
  check (status in ('Pending', 'In Progress', 'Completed', 'Cancelled'));

create or replace function public.enforce_follow_up_lifecycle()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_role text := public.current_role_name();
begin
  if v_role = 'Admin' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if v_role <> 'Marketing Team' or old.employee_id <> public.current_employee_id() then
    raise exception 'Follow-up mutation is not authorized' using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    if old.status <> 'Pending' then
      raise exception 'Only Pending follow-ups can be deleted' using errcode = '23514';
    end if;
    return old;
  end if;

  if new.employee_id <> old.employee_id
     or new.id <> old.id
     or new.created_at <> old.created_at
     or new.visit_plan_id is distinct from old.visit_plan_id
     or new.visit_report_id is distinct from old.visit_report_id then
    raise exception 'Protected follow-up fields cannot be changed' using errcode = '42501';
  end if;

  if old.status = 'Pending' and new.status = 'Pending' then
    if new.rescheduled_at is distinct from old.rescheduled_at then
      if new.follow_up_date is not distinct from old.follow_up_date
         or nullif(btrim(new.reschedule_reason), '') is null
         or new.previous_follow_up_date is distinct from old.follow_up_date then
        raise exception 'A reschedule requires a new date, reason, and previous date' using errcode = '23514';
      end if;
    elsif new.started_at is distinct from old.started_at
       or new.completed_at is distinct from old.completed_at
       or new.outcome is distinct from old.outcome
       or new.completion_notes is distinct from old.completion_notes
       or new.previous_follow_up_date is distinct from old.previous_follow_up_date
       or new.reschedule_reason is distinct from old.reschedule_reason then
      raise exception 'Pending edit contains lifecycle fields' using errcode = '23514';
    end if;
    return new;
  end if;

  if old.status = 'Pending' and new.status = 'In Progress' then
    if new.started_at is null
       or (to_jsonb(new) - array['status','started_at','updated_at'])
          is distinct from (to_jsonb(old) - array['status','started_at','updated_at']) then
      raise exception 'Invalid Start transition' using errcode = '23514';
    end if;
    return new;
  end if;

  if old.status in ('Pending', 'In Progress') and new.status = 'Pending'
     and new.rescheduled_at is distinct from old.rescheduled_at then
    if new.follow_up_date is not distinct from old.follow_up_date
       or nullif(btrim(new.reschedule_reason), '') is null
       or new.previous_follow_up_date is distinct from old.follow_up_date
       or (to_jsonb(new) - array['status','follow_up_date','previous_follow_up_date','rescheduled_at','reschedule_reason','updated_at'])
          is distinct from (to_jsonb(old) - array['status','follow_up_date','previous_follow_up_date','rescheduled_at','reschedule_reason','updated_at']) then
      raise exception 'Invalid Reschedule transition' using errcode = '23514';
    end if;
    return new;
  end if;

  if old.status = 'In Progress' and new.status = 'Completed' then
    if new.completed_at is null
       or nullif(btrim(new.outcome), '') is null
       or (to_jsonb(new) - array['status','completed_at','outcome','completion_notes','updated_at'])
          is distinct from (to_jsonb(old) - array['status','completed_at','outcome','completion_notes','updated_at']) then
      raise exception 'Invalid Complete transition' using errcode = '23514';
    end if;
    return new;
  end if;

  raise exception 'Invalid follow-up lifecycle transition from % to %', old.status, new.status using errcode = '23514';
end;
$$;

drop trigger if exists enforce_follow_up_lifecycle on public.follow_ups;
create trigger enforce_follow_up_lifecycle
before update or delete on public.follow_ups
for each row execute function public.enforce_follow_up_lifecycle();

drop policy if exists "follow_ups_insert" on public.follow_ups;
create policy "follow_ups_insert" on public.follow_ups for insert to authenticated
  with check (
    public.is_admin()
    or (public.current_role_name() = 'Marketing Team' and employee_id = public.current_employee_id())
  );

drop policy if exists "follow_ups_update" on public.follow_ups;
create policy "follow_ups_update" on public.follow_ups for update to authenticated
  using (
    public.is_admin()
    or (public.current_role_name() = 'Marketing Team' and employee_id = public.current_employee_id())
  )
  with check (
    public.is_admin()
    or (public.current_role_name() = 'Marketing Team' and employee_id = public.current_employee_id())
  );

drop policy if exists "follow_ups_delete" on public.follow_ups;
create policy "follow_ups_delete" on public.follow_ups for delete to authenticated
  using (
    public.is_admin()
    or (
      public.current_role_name() = 'Marketing Team'
      and employee_id = public.current_employee_id()
      and status = 'Pending'
    )
  );
