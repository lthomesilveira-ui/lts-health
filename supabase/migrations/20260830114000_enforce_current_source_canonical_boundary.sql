-- Current LTS Health source-level canonical contract is intentionally fail-closed.
-- Until a new promotion rule is explicitly validated and versioned, only Apple ActivitySummary
-- active energy, exercise minutes, and stand hours may be canonical in health_source_daily_metrics.

create or replace function public.health_source_daily_metrics_preserve_status()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.canonical_status in ('held','superseded')
     and new.canonical_status in ('candidate','canonical') then
    new.canonical_status := old.canonical_status;
  elsif old.canonical_status = 'canonical'
        and new.canonical_status = 'candidate'
        and old.source_family = 'apple_activity_summary'
        and old.metric_type in ('active_energy_kcal','exercise_minutes','stand_hours') then
    new.canonical_status := old.canonical_status;
  end if;
  return new;
end;
$$;

-- Preserve every source row and provenance; correct only status for legacy rows outside the current contract.
update public.health_source_daily_metrics
set canonical_status = 'candidate',
    updated_at = now()
where canonical_status = 'canonical'
  and not (
    source_family = 'apple_activity_summary'
    and metric_type in ('active_energy_kcal','exercise_minutes','stand_hours')
  );

alter table public.health_source_daily_metrics
  drop constraint if exists health_source_daily_metrics_current_canonical_boundary;

alter table public.health_source_daily_metrics
  add constraint health_source_daily_metrics_current_canonical_boundary
  check (
    canonical_status <> 'canonical'
    or (
      source_family = 'apple_activity_summary'
      and metric_type in ('active_energy_kcal','exercise_minutes','stand_hours')
    )
  );
