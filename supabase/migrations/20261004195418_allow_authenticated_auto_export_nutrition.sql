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
);
-- Authenticated browser roles may read their own received rows through existing RLS,
-- but cannot forge this server-authenticated transport or overwrite its evidence.
create function public.health_auto_export_server_write_only()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if current_user not in ('service_role','postgres','supabase_admin') then
    if to_jsonb(new)->>'source_family'='health_auto_export'
      or to_jsonb(new)->>'confidence'='authenticated_auto_export'
      or to_jsonb(new)->>'source_record_id' like 'health_auto_export:%'
      or (tg_op='UPDATE' and (to_jsonb(old)->>'source_family'='health_auto_export'
        or to_jsonb(old)->>'confidence'='authenticated_auto_export'
        or to_jsonb(old)->>'source_record_id' like 'health_auto_export:%')) then
      raise exception 'server transport write only' using errcode='42501';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.health_auto_export_server_write_only() from public,anon,authenticated;
create trigger health_auto_export_server_write_source before insert or update on public.health_source_daily_metrics
  for each row execute function public.health_auto_export_server_write_only();
create trigger health_auto_export_server_write_nutrition before insert or update on public.health_daily_nutrition
  for each row execute function public.health_auto_export_server_write_only();
