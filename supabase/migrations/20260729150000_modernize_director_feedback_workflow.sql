alter table public.director_comments
  add column if not exists director_id uuid references public.profiles(id),
  add column if not exists director_name text,
  add column if not exists target_type text,
  add column if not exists target_id text,
  add column if not exists target_title text,
  add column if not exists comment_type text,
  add column if not exists read_at timestamptz,
  add column if not exists submission_key uuid;

alter table public.notifications
  add column if not exists reference_id text;

update public.director_comments feedback
set
  director_id = coalesce(feedback.director_id, profile.id),
  director_name = coalesce(feedback.director_name, feedback.author, profile.full_name, 'Director'),
  target_type = coalesce(feedback.target_type, feedback.target_module, 'General'),
  target_id = coalesce(feedback.target_id, feedback.reference_id),
  target_title = coalesce(feedback.target_title, coalesce(feedback.target_module, 'General') || ' feedback'),
  comment_type = coalesce(
    feedback.comment_type,
    case when lower(trim(feedback.message)) in (
      'approve', 'approved', 'reject', 'rejected', 'request changes',
      'changes requested', 'tour plan rejected', 'tour plan approved',
      'awaiting approval', 'submitted for approval'
    ) then 'Director Review Update' else 'General Comment' end
  ),
  read_at = case
    when feedback.is_read then coalesce(feedback.read_at, feedback.updated_at, feedback.created_at)
    else feedback.read_at
  end,
  submission_key = coalesce(feedback.submission_key, gen_random_uuid())
from public.profiles profile
where feedback.director_id is null
  and lower(coalesce(profile.full_name, profile.username, '')) = lower(coalesce(feedback.author, ''));

update public.director_comments
set
  director_name = coalesce(director_name, author, 'Director'),
  target_type = coalesce(target_type, target_module, 'General'),
  target_id = coalesce(target_id, reference_id),
  target_title = coalesce(target_title, coalesce(target_module, 'General') || ' feedback'),
  comment_type = coalesce(comment_type, 'General Comment'),
  submission_key = coalesce(submission_key, gen_random_uuid());

alter table public.director_comments
  alter column director_name set default 'Director',
  alter column target_type set default 'General',
  alter column comment_type set default 'General Comment',
  alter column submission_key set default gen_random_uuid(),
  alter column submission_key set not null;

create unique index if not exists director_comments_submission_key_key
  on public.director_comments(submission_key);

create unique index if not exists notifications_feedback_reference_key
  on public.notifications(type, reference_id)
  where reference_id is not null and type = 'director_feedback';

drop policy if exists "director_comments_select" on public.director_comments;
create policy "director_comments_select"
on public.director_comments
for select
to authenticated
using (
  public.is_admin()
  or target_employee_id = public.current_employee_id()
  or director_id = (select auth.uid())
);

drop policy if exists "director_comments_insert" on public.director_comments;
create policy "director_comments_insert"
on public.director_comments
for insert
to authenticated
with check (
  public.current_role_name() in ('Admin', 'Director')
  and director_id = (select auth.uid())
);

drop policy if exists "director_comments_update" on public.director_comments;
create policy "director_comments_update"
on public.director_comments
for update
to authenticated
using (
  public.is_admin()
  or target_employee_id = public.current_employee_id()
)
with check (
  public.is_admin()
  or target_employee_id = public.current_employee_id()
);

create or replace function public.enforce_director_feedback_update_scope()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if public.current_role_name() not in ('Marketing', 'Marketing Team')
    or old.target_employee_id <> public.current_employee_id()
    or new.is_read is not true
    or new.read_at is null
    or (to_jsonb(new) - 'is_read' - 'read_at' - 'updated_at')
       is distinct from
       (to_jsonb(old) - 'is_read' - 'read_at' - 'updated_at')
  then
    raise exception using errcode = '42501',
      message = 'Marketing may only mark owned Director feedback as read.';
  end if;
  return new;
end;
$$;

drop trigger if exists director_comments_update_scope on public.director_comments;
create trigger director_comments_update_scope
before update on public.director_comments
for each row execute function public.enforce_director_feedback_update_scope();

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
  )
  on conflict (type, reference_id)
    where reference_id is not null and type = 'director_feedback'
  do nothing;

  return v_feedback;
end;
$$;

revoke all on function public.create_director_feedback(text, text, text, text, text, text, uuid) from public;
grant execute on function public.create_director_feedback(text, text, text, text, text, text, uuid) to authenticated;
revoke all on function public.enforce_director_feedback_update_scope() from public;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'director_comments'
  ) then
    alter publication supabase_realtime add table public.director_comments;
  end if;
end;
$$;
