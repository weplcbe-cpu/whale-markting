create or replace function public.enforce_director_feedback_update_scope()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if public.is_admin() then return new; end if;

  if public.current_role_name() = 'Director' and old.director_id = (select auth.uid()) then
    if nullif(btrim(new.message), '') is null
      or new.comment_type not in ('General Comment', 'Need More Details', 'High Priority', 'Follow-up Required', 'Correction Required')
      or (to_jsonb(new) - 'message' - 'comment_type' - 'updated_at')
         is distinct from (to_jsonb(old) - 'message' - 'comment_type' - 'updated_at') then
      raise exception 'Director may only edit feedback type and message.' using errcode = '42501';
    end if;
    return new;
  end if;

  if public.current_role_name() in ('Marketing', 'Marketing Team')
    and old.target_employee_id = public.current_employee_id()
    and new.is_read is true and new.read_at is not null
    and (to_jsonb(new) - 'is_read' - 'read_at' - 'updated_at')
        is not distinct from (to_jsonb(old) - 'is_read' - 'read_at' - 'updated_at') then
    return new;
  end if;

  raise exception 'Director feedback update is not authorized.' using errcode = '42501';
end;
$$;

drop policy if exists "director_comments_update" on public.director_comments;
create policy "director_comments_update" on public.director_comments for update to authenticated
using (
  public.is_admin()
  or director_id = (select auth.uid())
  or target_employee_id = public.current_employee_id()
)
with check (
  public.is_admin()
  or director_id = (select auth.uid())
  or target_employee_id = public.current_employee_id()
);

drop policy if exists "director_comments_delete" on public.director_comments;
create policy "director_comments_delete" on public.director_comments for delete to authenticated
using (public.is_admin() or director_id = (select auth.uid()));

drop policy if exists "notifications_delete_owned_feedback" on public.notifications;
create policy "notifications_delete_owned_feedback" on public.notifications for delete to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.director_comments feedback
    where feedback.id::text = notifications.reference_id
      and feedback.director_id = (select auth.uid())
  )
);

create or replace function public.delete_director_feedback(p_feedback_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare v_deleted_id uuid;
begin
  delete from public.notifications
  where type = 'director_feedback' and reference_id = p_feedback_id::text;

  delete from public.director_comments
  where id = p_feedback_id
  returning id into v_deleted_id;

  if v_deleted_id is null then
    raise exception 'Feedback not found or not authorized.' using errcode = '42501';
  end if;
  return v_deleted_id;
end;
$$;

revoke all on function public.delete_director_feedback(uuid) from public;
grant execute on function public.delete_director_feedback(uuid) to authenticated;
