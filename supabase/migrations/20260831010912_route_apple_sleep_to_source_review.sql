create schema if not exists health_private;

create or replace function health_private.route_apple_sleep_to_source_review()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.health_source_daily_metrics (
    user_id,
    source_record_id,
    metric_date,
    metric_type,
    value,
    unit,
    source_name,
    source_family,
    canonical_status,
    confidence,
    source_file,
    source_payload
  ) values (
    new.user_id,
    'apple_sleep_review:' || coalesce(new.source_record_id, new.id::text),
    new.measured_at::date,
    new.metric_type,
    new.value,
    new.unit,
    coalesce(nullif(new.source,''), 'Apple Saúde'),
    'healthkit_candidate',
    'candidate',
    coalesce(nullif(new.confidence,''), 'medium'),
    new.source_file,
    coalesce(new.source_payload, '{}'::jsonb) || jsonb_build_object(
      'routed_from', 'health_metrics',
      'original_source_record_id', new.source_record_id
    )
  )
  on conflict (user_id, source_record_id) do update set
    metric_date = excluded.metric_date,
    metric_type = excluded.metric_type,
    value = excluded.value,
    unit = excluded.unit,
    source_name = excluded.source_name,
    source_family = excluded.source_family,
    canonical_status = 'candidate',
    confidence = excluded.confidence,
    source_file = excluded.source_file,
    source_payload = excluded.source_payload,
    updated_at = now();

  return null;
end;
$$;

revoke all on function health_private.route_apple_sleep_to_source_review() from public;

drop trigger if exists health_metrics_route_apple_sleep_to_review on public.health_metrics;
create trigger health_metrics_route_apple_sleep_to_review
before insert on public.health_metrics
for each row
when (
  new.metric_type like 'sleep_%'
  and lower(coalesce(new.source,'') || ' ' || coalesce(new.source_file,'')) ~ '(apple|healthkit|iphone)'
)
execute function health_private.route_apple_sleep_to_source_review();