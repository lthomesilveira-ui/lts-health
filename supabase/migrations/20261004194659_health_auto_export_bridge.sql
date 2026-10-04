-- A revocable phone key; never expose the digest to browser/anonymous roles.
create table public.health_auto_export_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  key_hash text unique check (key_hash is null or key_hash ~ '^[0-9a-f]{64}$'),
  key_revision uuid not null default gen_random_uuid(),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  last_received_at timestamptz,
  last_metric_date date,
  last_metric_count integer not null default 0,
  last_water_date date,
  rate_window timestamptz not null default now(),
  rate_count integer not null default 0,
  check (not active or key_hash is not null)
);
alter table public.health_auto_export_connections enable row level security;
revoke all on public.health_auto_export_connections from public, anon, authenticated;
grant select, insert, update, delete on public.health_auto_export_connections to service_role;

create function public.health_auto_export_manage(p_user_id uuid,p_action text,p_key_hash text,p_expected_revision uuid default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare c public.health_auto_export_connections;
begin
  -- Serialize create/rotate/revoke even when a connection does not exist yet.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,71226));
  select * into c from public.health_auto_export_connections where user_id=p_user_id for update;
  if p_action='create' and c.active then return jsonb_build_object('error','already_configured'); end if;
  if p_action in ('rotate','disconnect') and (c.user_id is null or c.key_revision is distinct from p_expected_revision) then
    return jsonb_build_object('error','revision_changed');
  end if;
  if p_action='disconnect' then
    update public.health_auto_export_connections set active=false,key_hash=null,key_revision=gen_random_uuid() where user_id=p_user_id;
  elsif p_action in ('create','rotate') then
    if p_key_hash is null or p_key_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid key'; end if;
    insert into public.health_auto_export_connections(user_id,key_hash)
      values(p_user_id,p_key_hash)
      on conflict(user_id) do update set key_hash=excluded.key_hash,key_revision=gen_random_uuid(),active=true,
        created_at=now(),last_received_at=null,last_metric_count=0,rate_window=now(),rate_count=0;
  else raise exception 'invalid action'; end if;
  return jsonb_build_object('ok',true);
end $$;
revoke all on function public.health_auto_export_manage(uuid,text,text,uuid) from public, anon, authenticated;
grant execute on function public.health_auto_export_manage(uuid,text,text,uuid) to service_role;

create function public.health_auto_export_ingest(p_key_hash text,p_metrics jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  c public.health_auto_export_connections;
  r jsonb; touched record; written integer=0; n integer; sid text;
begin
  select * into c from public.health_auto_export_connections where key_hash=p_key_hash and active for update;
  -- Revocation/rotation locks the same row: an old in-flight key cannot write later.
  if c.user_id is null then return jsonb_build_object('error','unauthorized'); end if;
  if jsonb_typeof(p_metrics)<>'array' or jsonb_array_length(p_metrics) not between 1 and 2500 then raise exception 'invalid batch'; end if;
  if c.rate_window>now()-interval '1 hour' and c.rate_count>=120 then return jsonb_build_object('error','rate_limited'); end if;
  for r in select value from jsonb_array_elements(p_metrics) loop
    if r->>'source_family'<>'health_auto_export' or r->>'confidence'<>'authenticated_auto_export'
       or r->>'source_record_id' not like 'health_auto_export:%' then raise exception 'invalid source'; end if;
    insert into public.health_source_daily_metrics(user_id,source_record_id,metric_date,metric_type,value,unit,source_name,source_family,canonical_status,confidence,source_payload)
    values(c.user_id,r->>'source_record_id',(r->>'metric_date')::date,r->>'metric_type',(r->>'value')::numeric,r->>'unit',r->>'source_name','health_auto_export',r->>'canonical_status','authenticated_auto_export',r->'source_payload')
    on conflict(user_id,source_record_id) do update set value=excluded.value,unit=excluded.unit,
      source_payload=excluded.source_payload,updated_at=now()
      where public.health_source_daily_metrics.canonical_status not in ('held','superseded');
    get diagnostics n=row_count; written:=written+n;
  end loop;
  -- Rebuild only this bridge's projection. Different origins never become one daily row.
  -- Recompute from the stored metrics to support JSON requests split by metric.
  for touched in select distinct (value->>'metric_date')::date as day,value->>'source_name' as origin from jsonb_array_elements(p_metrics) loop
    sid:='health_auto_export:nutrition:'||jsonb_build_array(touched.day::text,touched.origin)::text;
    delete from public.health_daily_nutrition where user_id=c.user_id and source_record_id=sid and confidence='authenticated_auto_export';
    insert into public.health_daily_nutrition(user_id,source_record_id,nutrition_date,calories_kcal,protein_g,carbs_g,fat_g,fiber_g,source,confidence,source_payload)
    select c.user_id,sid,touched.day,
      max(value) filter(where metric_type='dietary_energy_kcal'),max(value) filter(where metric_type='dietary_protein_g'),
      max(value) filter(where metric_type='dietary_carbs_g'),max(value) filter(where metric_type='dietary_fat_g'),max(value) filter(where metric_type='dietary_fiber_g'),
      touched.origin||' (Health Auto Export)','authenticated_auto_export',jsonb_build_object('transport','health_auto_export','aggregation','day','derived_from_source_metrics',true)
    from public.health_source_daily_metrics where user_id=c.user_id and metric_date=touched.day and source_name=touched.origin
      and source_family='health_auto_export' and confidence='authenticated_auto_export' and canonical_status='canonical'
      and metric_type in ('dietary_energy_kcal','dietary_protein_g','dietary_carbs_g','dietary_fat_g','dietary_fiber_g')
    having count(*)>0
    on conflict(user_id,source_record_id) do update set calories_kcal=excluded.calories_kcal,protein_g=excluded.protein_g,
      carbs_g=excluded.carbs_g,fat_g=excluded.fat_g,fiber_g=excluded.fiber_g,source_payload=excluded.source_payload;
  end loop;
  update public.health_auto_export_connections set last_received_at=now(),last_metric_count=written,
    last_metric_date=(select max(metric_date) from public.health_source_daily_metrics where user_id=c.user_id and source_family='health_auto_export'),
    last_water_date=(select max(metric_date) from public.health_source_daily_metrics where user_id=c.user_id and source_family='health_auto_export' and metric_type='dietary_water_ml' and canonical_status='canonical' and value>0),
    rate_window=case when c.rate_window<=now()-interval '1 hour' then now() else c.rate_window end,
    rate_count=case when c.rate_window<=now()-interval '1 hour' then 1 else c.rate_count+1 end
    where user_id=c.user_id;
  return jsonb_build_object('received',true,'accepted_metrics',written);
end $$;
revoke all on function public.health_auto_export_ingest(text,jsonb) from public, anon, authenticated;
grant execute on function public.health_auto_export_ingest(text,jsonb) to service_role;
