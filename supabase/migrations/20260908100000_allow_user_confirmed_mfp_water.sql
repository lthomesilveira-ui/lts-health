-- Promote only an exact daily MyFitnessPal water total that the signed-in owner
-- explicitly confirmed in LTS Health. Other MyFitnessPal-via-Apple nutrition
-- remains candidate/held and the existing Apple ActivitySummary boundary stays intact.

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
    or (
      source_family = 'myfitnesspal'
      and source_name = 'MyFitnessPal'
      and metric_type = 'dietary_water_ml'
      and value > 0
      and value <= 100000
      and unit = 'mL'
      and confidence = 'user_confirmed'
      and source_payload ->> 'entry_method' = 'mfp_water_total_v1'
    )
  );

comment on constraint health_source_daily_metrics_current_canonical_boundary
  on public.health_source_daily_metrics is
  'Canonical rows are limited to stable Apple ActivitySummary metrics or owner-confirmed MyFitnessPal daily water totals in mL.';
