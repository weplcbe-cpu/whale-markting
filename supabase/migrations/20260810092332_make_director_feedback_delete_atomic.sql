create or replace function public.delete_director_feedback(p_feedback_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_deleted_id uuid;
begin
  if v_actor_id is null then
    raise exception 'Feedback not found or not authorized.' using errcode = '42501';
  end if;

  perform 1
  from public.director_comments
  where id = p_feedback_id
    and (director_id = v_actor_id or public.is_admin())
  for update;

  if not found then
    raise exception 'Feedback not found or not authorized.' using errcode = '42501';
  end if;

  delete from public.notifications
  where type = 'director_feedback'
    and reference_id = p_feedback_id::text;

  delete from public.director_comments
  where id = p_feedback_id
  returning id into v_deleted_id;

  if v_deleted_id is distinct from p_feedback_id then
    raise exception 'Feedback deletion was not confirmed.' using errcode = 'P0001';
  end if;

  return v_deleted_id;
end;
$$;

revoke all on function public.delete_director_feedback(uuid) from public, anon;
grant execute on function public.delete_director_feedback(uuid) to authenticated;
