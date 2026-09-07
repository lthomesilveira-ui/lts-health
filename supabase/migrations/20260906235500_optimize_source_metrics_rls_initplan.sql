begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

drop policy if exists health_source_daily_metrics_select_own on public.health_source_daily_metrics;
create policy health_source_daily_metrics_select_own
  on public.health_source_daily_metrics
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists health_source_daily_metrics_insert_own on public.health_source_daily_metrics;
create policy health_source_daily_metrics_insert_own
  on public.health_source_daily_metrics
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists health_source_daily_metrics_update_own on public.health_source_daily_metrics;
create policy health_source_daily_metrics_update_own
  on public.health_source_daily_metrics
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists health_source_daily_metrics_delete_own on public.health_source_daily_metrics;
create policy health_source_daily_metrics_delete_own
  on public.health_source_daily_metrics
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

commit;
