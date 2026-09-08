-- Permit canonical MyFitnessPal water only through one of the two explicit
-- provenance contracts: an owner-confirmed daily total or the authenticated
-- same-origin web export. All other MyFitnessPal metrics remain non-canonical.

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
      and (
        (
          confidence = 'user_confirmed'
          and source_payload ->> 'entry_method' = 'mfp_water_total_v1'
        )
        or (
          confidence = 'account_authenticated_export'
          and source_payload ->> 'entry_method' = 'mfp_authenticated_water_export_v1'
          and source_payload ->> 'export_schema' = 'lts-health-mfp-water-export'
          and source_payload ->> 'export_version' = '1'
        )
      )
    )
  );

comment on constraint health_source_daily_metrics_current_canonical_boundary
  on public.health_source_daily_metrics is
  'Canonical rows are limited to stable Apple ActivitySummary metrics or exact MyFitnessPal daily water totals with owner-confirmed or authenticated-export provenance.';
