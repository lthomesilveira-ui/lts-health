-- Sleep is source-specific context in LTS Health and must never be canonical automatically.
-- Preserve every historical row and provenance; only correct classification before enforcing the invariant.
update public.health_source_daily_metrics
set canonical_status = 'candidate',
    updated_at = now()
where canonical_status = 'canonical'
  and metric_type like 'sleep_%';

alter table public.health_source_daily_metrics
  drop constraint if exists health_source_daily_metrics_sleep_not_canonical;

alter table public.health_source_daily_metrics
  add constraint health_source_daily_metrics_sleep_not_canonical
  check (not (canonical_status = 'canonical' and metric_type like 'sleep_%'));
