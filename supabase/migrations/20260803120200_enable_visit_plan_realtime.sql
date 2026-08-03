-- Director dashboards consume visit-plan and notification Postgres Changes.
-- Adding each table conditionally keeps this migration safe to re-run in
-- environments where Realtime may already have been enabled manually.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'visit_plans'
  ) then
    alter publication supabase_realtime add table public.visit_plans;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;
