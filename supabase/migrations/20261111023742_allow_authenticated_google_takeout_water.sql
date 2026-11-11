-- Original Takeout files remain private. Positive, typed, source-proven daily logs only.
alter table public.health_source_daily_metrics drop constraint health_source_daily_metrics_current_canonical_boundary;
alter table public.health_source_daily_metrics add constraint health_source_daily_metrics_current_canonical_boundary check (
  canonical_status <> 'canonical'
  or (source_family='apple_activity_summary' and metric_type in ('active_energy_kcal','exercise_minutes','stand_hours'))
  or (source_family='myfitnesspal' and source_name='MyFitnessPal' and metric_type='dietary_water_ml'
      and value>0 and value<=100000 and unit='mL'
      and ((confidence='user_confirmed' and source_payload->>'entry_method'='mfp_water_total_v1')
        or (confidence='account_authenticated_export' and source_payload->>'entry_method'='mfp_authenticated_water_export_v1'
          and source_payload->>'export_schema'='lts-health-mfp-water-export' and source_payload->>'export_version'='1')))
  or (source_family='health_auto_export' and confidence='authenticated_auto_export'
      and source_record_id like 'health_auto_export:%' and source_payload->>'transport'='health_auto_export'
      and source_payload->>'aggregation'='day' and source_payload->>'export_version'='2'
      and ((metric_type='dietary_water_ml' and unit='mL' and value<=100000)
        or (metric_type='dietary_energy_kcal' and unit='kcal' and value<=20000)
        or (metric_type in ('dietary_protein_g','dietary_fat_g') and unit='g' and value<=2000)
        or (metric_type='dietary_carbs_g' and unit='g' and value<=5000)
        or (metric_type='dietary_fiber_g' and unit='g' and value<=1000)))
  or coalesce((source_family='google_health_takeout'
      and source_name='MyFitnessPal · Google Health'
      and confidence='authenticated_google_takeout'
      and source_record_id ~ '^google_health_takeout:water:[a-f0-9]{64}$'
      and metric_type='dietary_water_ml' and unit='mL' and value>0 and value<=100000
      and source_payload->>'entry_method'='google_health_takeout_water_v1'
      and source_payload->>'export_version'='1'
      and source_payload->>'archive_sha256' ~ '^[a-f0-9]{64}$'
      and source_payload->>'original_unit'='MILLILITER'
      and source_payload->>'original_source'='MyFitnessPal Fitbit 3P Web API'
      and source_payload->>'aggregation'='day'
      and source_payload->>'local_date'=metric_date::text
      and coalesce(source_payload->>'archive_member','')<>''
      and source_payload->>'csv_line' ~ '^[1-9][0-9]*$'
      and coalesce(source_payload->>'original_start','')<>''
      and coalesce(source_payload->>'original_end','')<>''),false)
);

-- Keep the existing Auto Export boundary unchanged; add the same server-only
-- protection for authenticated Takeout evidence, including attempts to relabel it.
create function public.health_google_takeout_server_write_only()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if current_user not in ('service_role','postgres','supabase_admin') then
    if to_jsonb(new)->>'source_family'='google_health_takeout'
      or to_jsonb(new)->>'confidence'='authenticated_google_takeout'
      or to_jsonb(new)->>'source_record_id' like 'google_health_takeout:%'
      or (tg_op='UPDATE' and (to_jsonb(old)->>'source_family'='google_health_takeout'
        or to_jsonb(old)->>'confidence'='authenticated_google_takeout'
        or to_jsonb(old)->>'source_record_id' like 'google_health_takeout:%')) then
      raise exception 'server transport write only' using errcode='42501';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.health_google_takeout_server_write_only() from public,anon,authenticated;
create trigger health_google_takeout_server_write_source before insert or update on public.health_source_daily_metrics
  for each row execute function public.health_google_takeout_server_write_only();
