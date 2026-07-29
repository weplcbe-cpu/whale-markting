create or replace function public.create_director_feedback(
  p_target_employee_id text,
  p_target_type text,
  p_target_id text,
  p_target_title text,
  p_message text,
  p_comment_type text default 'General Comment',
  p_submission_key uuid default gen_random_uuid()
)
returns public.director_comments
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_profile public.profiles;
  v_target public.profiles;
  v_feedback public.director_comments;
begin
  select * into v_profile from public.profiles where id = (select auth.uid());
  if v_profile.id is null or v_profile.status <> 'Active'
    or v_profile.role not in ('Director', 'Admin')
  then
    raise exception using errcode = '42501',
      message = 'Only an active Director or Admin can create feedback.';
  end if;

  select * into v_target
  from public.profiles
  where employee_id = p_target_employee_id
    and role in ('Marketing', 'Marketing Team');
  if v_target.id is null then
    raise exception using errcode = '22023',
      message = 'Select a valid Marketing employee.';
  end if;

  if nullif(trim(p_message), '') is null then
    raise exception using errcode = '22023', message = 'Feedback message is required.';
  end if;
  if p_comment_type not in (
    'General Comment', 'Need More Details', 'High Priority',
    'Follow-up Required', 'Correction Required'
  ) then
    raise exception using errcode = '22023', message = 'Unsupported feedback type.';
  end if;

  insert into public.director_comments (
    author, author_role, director_id, director_name,
    target_employee_id, target_employee_name,
    target_module, reference_id, target_type, target_id, target_title,
    message, comment_type, is_read, replies, submission_key
  ) values (
    coalesce(v_profile.full_name, v_profile.username, 'Director'),
    v_profile.role,
    v_profile.id,
    coalesce(v_profile.full_name, v_profile.username, 'Director'),
    v_target.employee_id,
    coalesce(v_target.full_name, v_target.username, v_target.employee_id),
    coalesce(nullif(trim(p_target_type), ''), 'General'),
    p_target_id,
    coalesce(nullif(trim(p_target_type), ''), 'General'),
    p_target_id,
    coalesce(nullif(trim(p_target_title), ''), coalesce(nullif(trim(p_target_type), ''), 'General') || ' feedback'),
    trim(p_message),
    p_comment_type,
    false,
    '[]'::jsonb,
    p_submission_key
  )
  on conflict (submission_key) do nothing
  returning * into v_feedback;

  if v_feedback.id is null then
    select * into v_feedback
    from public.director_comments
    where submission_key = p_submission_key;
    return v_feedback;
  end if;

  insert into public.notifications (
    user_id, title, message, timestamp, is_read, type, reference_id
  ) values (
    v_target.employee_id,
    'New Director Feedback',
    coalesce(v_profile.full_name, v_profile.username, 'Director')
      || ' added feedback to your '
      || coalesce(nullif(trim(p_target_type), ''), 'record') || '.',
    to_char(now(), 'DD Mon YYYY, HH12:MI AM'),
    false,
    'director_feedback',
    v_feedback.id::text
  );

  return v_feedback;
end;
$$;

revoke all on function public.create_director_feedback(text, text, text, text, text, text, uuid) from public;
grant execute on function public.create_director_feedback(text, text, text, text, text, text, uuid) to authenticated;
