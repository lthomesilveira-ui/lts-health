-- Capture received basal snapshots as private, unverified evidence only.
-- No daily-total projection, source summation, frontend policy or canonical grant.
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create schema health_ingest_private;
revoke all on schema health_ingest_private from public, anon, authenticated, service_role;
grant usage on schema health_ingest_private to service_role;

create function health_ingest_private.valid_basal_source_date(p_value text)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare d date; offset_hour integer; offset_minute integer;
begin
  if p_value is null or length(p_value) not in (10,25) or p_value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}( [0-9]{2}:[0-9]{2}:[0-9]{2} [+-][0-9]{4})?$' then return false; end if;
  begin d:=substring(p_value from 1 for 10)::date;
  exception when invalid_datetime_format or datetime_field_overflow then return false; end;
  if d < date '2000-01-01' then return false; end if;
  if length(p_value)=25 then
    offset_hour:=substring(p_value from 22 for 2)::integer;
    offset_minute:=substring(p_value from 24 for 2)::integer;
    if substring(p_value from 12 for 2)::integer>23
      or substring(p_value from 15 for 2)::integer>59
      or substring(p_value from 18 for 2)::integer>59
      or offset_hour>14 or offset_minute>59
      or (offset_hour=14 and offset_minute<>0) then return false; end if;
  end if;
  return true;
end $$;
revoke all on function health_ingest_private.valid_basal_source_date(text) from public, anon, authenticated;
grant execute on function health_ingest_private.valid_basal_source_date(text) to service_role;

-- The digest binds the whole request, including legacy metrics, without storing
-- a second copy of those metrics. A retry never invokes legacy ingestion twice.
create table health_ingest_private.ingest_receipts (
  user_id uuid not null references auth.users(id) on delete cascade,
  receipt_id uuid not null,
  request_hash bytea not null check (octet_length(request_hash)=32),
  accepted_metrics integer not null check (accepted_metrics between 0 and 2500),
  accepted_basal_candidates integer not null check (accepted_basal_candidates between 0 and 2500),
  created_at timestamptz not null default now(),
  primary key (user_id, receipt_id)
);
create table health_ingest_private.basal_energy_candidates (
  user_id uuid not null,
  receipt_id uuid not null,
  point_index integer not null check (point_index between 0 and 2499),
  quantity numeric not null check (quantity>=0 and quantity<=1000000000),
  unit text not null check (length(unit) between 1 and 32 and unit !~ U&'^[ \00A0\1680\2000-\200A\2028\2029\202F\205F\3000\FEFF]*$' and unit !~ '[[:cntrl:]]'),
  source_date text not null check (health_ingest_private.valid_basal_source_date(source_date)),
  metric_date date not null check (metric_date>=date '2000-01-01' and metric_date=substring(source_date from 1 for 10)::date),
  original_source text check (original_source is null or (length(original_source) between 1 and 160 and original_source !~ '[[:cntrl:]]')),
  source_start_date text check (source_start_date is null or health_ingest_private.valid_basal_source_date(source_start_date)),
  source_end_date text check (source_end_date is null or health_ingest_private.valid_basal_source_date(source_end_date)),
  source_creation_date text check (source_creation_date is null or health_ingest_private.valid_basal_source_date(source_creation_date)),
  coverage_verified boolean not null default false check (not coverage_verified),
  created_at timestamptz not null default now(),
  primary key (user_id, receipt_id, point_index),
  foreign key (user_id, receipt_id) references health_ingest_private.ingest_receipts(user_id, receipt_id) on delete cascade
);
create index basal_energy_candidates_user_date_idx on health_ingest_private.basal_energy_candidates(user_id, metric_date desc);
alter table health_ingest_private.ingest_receipts enable row level security;
alter table health_ingest_private.basal_energy_candidates enable row level security;
-- No browser grants or policies. service_role already bypasses RLS; still grant
-- only the table operations required by this invoker RPC, never UPDATE/DELETE.
revoke all on health_ingest_private.ingest_receipts, health_ingest_private.basal_energy_candidates from public, anon, authenticated, service_role;
grant select, insert on health_ingest_private.ingest_receipts, health_ingest_private.basal_energy_candidates to service_role;

-- Runtime callers cannot UPDATE, DELETE or TRUNCATE evidence. A privileged
-- owner-erasure workflow can still cascade deletion from auth.users.

create function public.health_auto_export_ingest_candidates(
  p_key_hash text, p_metrics jsonb, p_basal_candidates jsonb, p_receipt_id uuid
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  c public.health_auto_export_connections;
  receipt health_ingest_private.ingest_receipts;
  r jsonb; item record; field text; value_text text;
  request_hash bytea; result jsonb; metric_count integer; basal_count integer;
  today date:=(statement_timestamp() at time zone 'America/Sao_Paulo')::date;
begin
  -- Exactly the lock used by legacy ingestion and connection rotation/revoke.
  -- READ COMMITTED rechecks the predicate after waiting for a concurrent edit.
  select * into c from public.health_auto_export_connections where key_hash=p_key_hash and active for update;
  if c.user_id is null then return jsonb_build_object('error','unauthorized'); end if;
  if p_receipt_id is null or jsonb_typeof(p_metrics) is distinct from 'array'
    or jsonb_typeof(p_basal_candidates) is distinct from 'array' then raise exception 'invalid batch' using errcode='22023'; end if;
  metric_count:=jsonb_array_length(p_metrics); basal_count:=jsonb_array_length(p_basal_candidates);
  if metric_count>2500 or basal_count>2500 or metric_count+basal_count=0 then raise exception 'invalid batch' using errcode='22023'; end if;
  request_hash:=sha256(convert_to(jsonb_build_array(p_metrics,p_basal_candidates)::text,'UTF8'));
  select * into receipt from health_ingest_private.ingest_receipts where user_id=c.user_id and receipt_id=p_receipt_id;
  if found then
    if receipt.request_hash<>request_hash then raise exception 'receipt collision' using errcode='22023'; end if;
    return jsonb_build_object('received',true,'accepted_metrics',receipt.accepted_metrics,
      'accepted_basal_candidates',receipt.accepted_basal_candidates,'already_captured',true);
  end if;

  -- Protect the unchanged legacy function against SQL/JSON NULL bypasses.
  -- Its existing table constraints and projection remain authoritative.
  for r in select value from jsonb_array_elements(p_metrics) loop
    if jsonb_typeof(r) is distinct from 'object'
      or r->>'source_family' is distinct from 'health_auto_export'
      or r->>'confidence' is distinct from 'authenticated_auto_export'
      or coalesce(r->>'source_record_id','') not like 'health_auto_export:%'
      or jsonb_typeof(r->'value') is distinct from 'number'
      or (r->>'value')::numeric<0 or (r->>'value')::numeric>1000000000
      or jsonb_typeof(r->'metric_date') is distinct from 'string'
      or not health_ingest_private.valid_basal_source_date(r->>'metric_date')
      or length(r->>'metric_date')<>10 then raise exception 'invalid legacy metric' using errcode='22023'; end if;
  end loop;
  for item in select value, ordinality from jsonb_array_elements(p_basal_candidates) with ordinality loop
    r:=item.value;
    if jsonb_typeof(r) is distinct from 'object' then raise exception 'invalid basal candidate' using errcode='22023'; end if;
    if exists (select 1 from jsonb_object_keys(r) k where k not in ('point_index','quantity','unit','source_date','metric_date','original_source','source_start_date','source_end_date','source_creation_date'))
      or jsonb_typeof(r->'point_index') is distinct from 'number'
      or (r->>'point_index')::numeric is distinct from (item.ordinality-1)::numeric
      or jsonb_typeof(r->'quantity') is distinct from 'number'
      or (r->>'quantity')::numeric<0 or (r->>'quantity')::numeric>1000000000
      or jsonb_typeof(r->'unit') is distinct from 'string'
      or length(r->>'unit') not between 1 and 32 or r->>'unit' ~ U&'^[ \00A0\1680\2000-\200A\2028\2029\202F\205F\3000\FEFF]*$' or r->>'unit' ~ '[[:cntrl:]]'
      or jsonb_typeof(r->'source_date') is distinct from 'string'
      or not health_ingest_private.valid_basal_source_date(r->>'source_date')
      or jsonb_typeof(r->'metric_date') is distinct from 'string'
      or r->>'metric_date' is distinct from substring(r->>'source_date' from 1 for 10)
      then raise exception 'invalid basal candidate' using errcode='22023'; end if;
    if (r->>'metric_date')::date>today then raise exception 'invalid basal candidate date' using errcode='22023'; end if;
    if r ? 'original_source' and r->'original_source'<>'null'::jsonb then
      if jsonb_typeof(r->'original_source') is distinct from 'string'
        or length(r->>'original_source') not between 1 and 160 or r->>'original_source' ~ '[[:cntrl:]]'
        then raise exception 'invalid basal candidate source' using errcode='22023'; end if;
    end if;
    foreach field in array array['source_start_date','source_end_date','source_creation_date'] loop
      if r ? field and r->field<>'null'::jsonb then
        value_text:=r->>field;
        if jsonb_typeof(r->field) is distinct from 'string' or not health_ingest_private.valid_basal_source_date(value_text)
          then raise exception 'invalid basal candidate timestamp' using errcode='22023'; end if;
        if substring(value_text from 1 for 10)::date>today then raise exception 'invalid basal candidate timestamp' using errcode='22023'; end if;
      end if;
    end loop;
  end loop;

  if c.rate_window>now()-interval '1 hour' and c.rate_count>=120 then return jsonb_build_object('error','rate_limited'); end if;
  if metric_count>0 then
    -- Preserve legacy ingestion byte-for-byte. One call means one rate charge
    -- and the exact existing nutrition/water behavior for mixed requests.
    result:=public.health_auto_export_ingest(p_key_hash,p_metrics);
    if result ? 'error' then return result; end if;
  else
    -- Basal-only capture cannot delete/rebuild nutrition or source metrics.
    update public.health_auto_export_connections set last_received_at=now(),last_metric_count=0,
      rate_window=case when c.rate_window<=now()-interval '1 hour' then now() else c.rate_window end,
      rate_count=case when c.rate_window<=now()-interval '1 hour' then 1 else c.rate_count+1 end
      where user_id=c.user_id;
    result:=jsonb_build_object('received',true,'accepted_metrics',0);
  end if;
  insert into health_ingest_private.ingest_receipts(user_id,receipt_id,request_hash,accepted_metrics,accepted_basal_candidates)
    values(c.user_id,p_receipt_id,request_hash,(result->>'accepted_metrics')::integer,basal_count);
  insert into health_ingest_private.basal_energy_candidates(
    user_id,receipt_id,point_index,quantity,unit,source_date,metric_date,original_source,source_start_date,source_end_date,source_creation_date
  ) select c.user_id,p_receipt_id,((b.value->>'point_index')::numeric)::integer,(b.value->>'quantity')::numeric,b.value->>'unit',b.value->>'source_date',
      (b.value->>'metric_date')::date,b.value->>'original_source',b.value->>'source_start_date',b.value->>'source_end_date',b.value->>'source_creation_date'
    from jsonb_array_elements(p_basal_candidates) as b(value);
  return result||jsonb_build_object('accepted_basal_candidates',basal_count,'already_captured',false);
end $$;
revoke all on function public.health_auto_export_ingest_candidates(text,jsonb,jsonb,uuid) from public, anon, authenticated;
grant execute on function public.health_auto_export_ingest_candidates(text,jsonb,jsonb,uuid) to service_role;

comment on table health_ingest_private.basal_energy_candidates is 'Private append-only transport observations. Original quantities and provenance only; coverage is unverified and no total-energy/nutrition projection is permitted.';
comment on table health_ingest_private.ingest_receipts is 'Private request-level idempotency ledger; hashes bind both legacy metrics and basal candidates.';
