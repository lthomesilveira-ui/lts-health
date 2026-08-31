drop trigger if exists health_metrics_route_apple_sleep_to_review on public.health_metrics;

drop trigger if exists health_metrics_route_review_evidence on public.health_metrics;

create or replace function health_private.route_review_metric_to_source_evidence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  source_text text;
  family text;
  route_id text;
  existing_id text;
begin
  source_text := lower(coalesce(new.source,'') || ' ' || coalesce(new.source_file,''));

  family := case
    when source_text ~ 'polar' then 'polar_flow'
    when source_text ~ 'ringconn' then 'ringconn'
    when source_text ~ 'apple[ _-]?watch' then 'apple_watch'
    when source_text ~ 'iphone' then 'iphone'
    when source_text ~ '(apple|healthkit)' then 'healthkit_candidate'
    else 'other'
  end;

  route_id := case
    when new.metric_type like 'sleep_%' and source_text ~ '(apple|healthkit|iphone)'
      then 'apple_sleep_review:' || coalesce(new.source_record_id,new.id::text)
    else 'source_metric_review:' || coalesce(new.source_record_id,new.id::text)
  end;

  update public.health_source_daily_metrics
     set value = new.value,
         unit = new.unit,
         source_name = coalesce(nullif(new.source,''),'Origem preservada'),
         canonical_status = 'candidate',
         confidence = coalesce(nullif(new.confidence,''),'medium'),
         source_file = new.source_file,
         source_payload = coalesce(new.source_payload,'{}'::jsonb) || jsonb_build_object(
           'routed_from','health_metrics',
           'original_source_record_id',new.source_record_id
         ),
         updated_at = now()
   where user_id = new.user_id
     and metric_date = new.measured_at::date
     and metric_type = new.metric_type
     and source_family = family
     and coalesce(source_file,'') = coalesce(new.source_file,'')
     and canonical_status in ('candidate','held')
  returning source_record_id into existing_id;

  if existing_id is not null then
    return null;
  end if;

  insert into public.health_source_daily_metrics (
    user_id,source_record_id,metric_date,metric_type,value,unit,
    source_name,source_family,canonical_status,confidence,source_file,source_payload
  ) values (
    new.user_id,route_id,new.measured_at::date,new.metric_type,new.value,new.unit,
    coalesce(nullif(new.source,''),'Origem preservada'),family,'candidate',
    coalesce(nullif(new.confidence,''),'medium'),new.source_file,
    coalesce(new.source_payload,'{}'::jsonb) || jsonb_build_object(
      'routed_from','health_metrics',
      'original_source_record_id',new.source_record_id
    )
  )
  on conflict (user_id,source_record_id) do update set
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

create trigger health_metrics_route_review_evidence
before insert on public.health_metrics
for each row
when (
  new.metric_type like 'sleep_%'
  or (
    lower(coalesce(new.source,'') || ' ' || coalesce(new.source_file,'')) ~ '(apple|healthkit|iphone)'
    and not (
      lower(coalesce(new.source,'') || ' ' || coalesce(new.source_file,'')) ~ 'activity[ _-]?summary'
      and new.metric_type in ('active_energy_kcal','exercise_minutes','stand_hours')
    )
  )
)
execute function health_private.route_review_metric_to_source_evidence();

drop function if exists health_private.route_apple_sleep_to_source_review();