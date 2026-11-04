-- Dormant official read path. No Google credentials, grants or health writes are created here.
create table public.health_google_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  generation uuid not null default gen_random_uuid(),
  status text not null default 'unlinked' check(status in ('unlinked','connected')),
  health_user_id text check(health_user_id ~ '^[A-Za-z0-9-]{1,63}$'),
  tokens_encrypted text check(length(tokens_encrypted) <= 131072),
  scopes text[] not null default '{}',
  connected_at timestamptz,
  pending_state_hash text check(pending_state_hash ~ '^[a-f0-9]{64}$'),
  lease_token uuid,
  lease_until timestamptz not null default '1970-01-01T00:00:00Z',
  last_attempt_at timestamptz,
  last_read_at timestamptz,
  last_error text check(last_error ~ '^[a-z_]{1,64}$'),
  check ((status='unlinked' and tokens_encrypted is null and health_user_id is null and scopes='{}') or
    (status='connected' and tokens_encrypted is not null and health_user_id is not null and
      scopes=array['https://www.googleapis.com/auth/googlehealth.nutrition.readonly']))
);
alter table public.health_google_connections enable row level security;
revoke all on public.health_google_connections from public,anon,authenticated,service_role;
grant select,insert,update,delete on public.health_google_connections to service_role;

create table public.health_google_oauth_states (
  state_hash text primary key check(state_hash ~ '^[a-f0-9]{64}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  generation uuid not null,
  payload_encrypted text not null check(length(payload_encrypted) <= 131072),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index health_google_oauth_states_user_expiry on public.health_google_oauth_states(user_id,expires_at);
alter table public.health_google_oauth_states enable row level security;
revoke all on public.health_google_oauth_states from public,anon,authenticated,service_role;
grant select,insert,delete on public.health_google_oauth_states to service_role;

-- Immutable, private reads remain separate from canonical water and original MFP exports.
create table public.health_google_hydration_reads (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  health_user_id text not null check(health_user_id ~ '^[A-Za-z0-9-]{1,63}$'),
  from_date date not null,
  to_date_exclusive date not null,
  payload_sha256 text not null check(payload_sha256 ~ '^[a-f0-9]{64}$'),
  result jsonb not null,
  received_at timestamptz not null default now(),
  check(to_date_exclusive > from_date and to_date_exclusive-from_date <= 31),
  unique(user_id,health_user_id,from_date,to_date_exclusive,payload_sha256)
);
create index health_google_hydration_reads_user_received on public.health_google_hydration_reads(user_id,received_at desc);
alter table public.health_google_hydration_reads enable row level security;
revoke all on public.health_google_hydration_reads from public,anon,authenticated,service_role;
grant select,insert on public.health_google_hydration_reads to service_role;
revoke all on sequence public.health_google_hydration_reads_id_seq from public,anon,authenticated,service_role;
grant usage,select on sequence public.health_google_hydration_reads_id_seq to service_role;

-- SECURITY INVOKER: only the service role can execute; caller ownership is established in Edge.
create function public.health_google_begin_authorization(p_user_id uuid,p_state_hash text,p_payload_encrypted text,p_expires_at timestamptz)
returns uuid language plpgsql security invoker set search_path='' as $$
declare next_generation uuid;
begin
  if p_state_hash !~ '^[a-f0-9]{64}$' or p_expires_at <= clock_timestamp() or
      p_expires_at > clock_timestamp()+interval '11 minutes' then raise exception 'invalid_authorization_state'; end if;
  insert into public.health_google_connections(user_id) values(p_user_id) on conflict(user_id) do nothing;
  perform 1 from public.health_google_connections where user_id=p_user_id for update;
  next_generation:=gen_random_uuid();
  update public.health_google_connections set generation=next_generation,pending_state_hash=p_state_hash,
    lease_token=null,lease_until='1970-01-01T00:00:00Z' where user_id=p_user_id;
  delete from public.health_google_oauth_states where user_id=p_user_id;
  insert into public.health_google_oauth_states(state_hash,user_id,generation,payload_encrypted,expires_at)
    values(p_state_hash,p_user_id,next_generation,p_payload_encrypted,p_expires_at);
  return next_generation;
end $$;

create function public.health_google_consume_state(p_state_hash text)
returns table(user_id uuid,generation uuid,payload_encrypted text,health_user_id text)
language sql security invoker set search_path='' as $$
  with consumed as (
    delete from public.health_google_oauth_states s
      where s.state_hash=p_state_hash and s.expires_at>clock_timestamp()
      returning s.user_id,s.generation,s.payload_encrypted
  ) select s.user_id,s.generation,s.payload_encrypted,c.health_user_id
      from consumed s join public.health_google_connections c on c.user_id=s.user_id
      and c.generation=s.generation and c.pending_state_hash=p_state_hash;
$$;

create function public.health_google_save_authorization(p_user_id uuid,p_generation uuid,p_state_hash text,p_health_user_id text,p_tokens_encrypted text)
returns boolean language plpgsql security invoker set search_path='' as $$
declare updated integer;
begin
  update public.health_google_connections set status='connected',health_user_id=p_health_user_id,
    tokens_encrypted=p_tokens_encrypted,scopes=array['https://www.googleapis.com/auth/googlehealth.nutrition.readonly'],
    connected_at=clock_timestamp(),generation=gen_random_uuid(),pending_state_hash=null,
    lease_token=null,lease_until='1970-01-01T00:00:00Z',last_read_at=null,last_error=null
    where user_id=p_user_id and generation=p_generation and pending_state_hash=p_state_hash
      and (health_user_id is null or health_user_id=p_health_user_id);
  get diagnostics updated=row_count;
  return updated=1;
end $$;

create function public.health_google_disconnect(p_user_id uuid)
returns void language plpgsql security invoker set search_path='' as $$
begin
  perform 1 from public.health_google_connections where user_id=p_user_id for update;
  update public.health_google_connections set status='unlinked',health_user_id=null,tokens_encrypted=null,
    scopes='{}',connected_at=null,generation=gen_random_uuid(),pending_state_hash=null,
    lease_token=null,lease_until='1970-01-01T00:00:00Z',last_read_at=null,last_attempt_at=null,last_error=null
    where user_id=p_user_id;
  delete from public.health_google_oauth_states where user_id=p_user_id;
  -- Retain private immutable read history. No source or canonical health row is removed.
end $$;

create function public.health_google_finish_read(p_user_id uuid,p_generation uuid,p_lease_token uuid,p_result jsonb)
returns text language plpgsql security invoker set search_path='' as $$
declare connection public.health_google_connections%rowtype; fingerprint text; normalized jsonb; stored integer;
begin
  select * into connection from public.health_google_connections c where c.user_id=p_user_id
    and c.status='connected' and c.generation=p_generation and c.lease_token=p_lease_token
    and c.lease_until>clock_timestamp() for update;
  if not found then return 'stale'; end if;
  if p_result->>'format' is distinct from 'lts-google-health-hydration-read' or
     p_result->>'complete' is distinct from 'true' or p_result->>'mode' is distinct from 'read_only' or
     p_result->>'canonical_eligible' is distinct from 'false' or
     p_result->>'health_user_id' is distinct from connection.health_user_id or
     p_result->>'source_family' is distinct from 'users/me/dataSourceFamilies/all-sources' or
     jsonb_typeof(p_result->'records') is distinct from 'array' or
     octet_length(p_result::text)>10000000 then raise exception 'invalid_complete_read'; end if;
  if jsonb_array_length(p_result->'records')>10000 or exists (
      select 1 from jsonb_array_elements(p_result->'records') r where r->>'canonical_eligible' is distinct from 'false'
        or r->>'health_user_id' is distinct from connection.health_user_id
    ) then raise exception 'invalid_held_records'; end if;
  -- Ignore transport-only variation and sort by stable resource identity, preserving raw/source content.
  normalized:=jsonb_set(p_result-'pages'-'received_count','{records}',coalesce((
    select jsonb_agg(r order by r->>'resource_name') from jsonb_array_elements(p_result->'records') r
  ),'[]'::jsonb));
  fingerprint:=encode(sha256(convert_to(normalized::text,'UTF8')),'hex');
  insert into public.health_google_hydration_reads(user_id,health_user_id,from_date,to_date_exclusive,payload_sha256,result)
    values(p_user_id,connection.health_user_id,(p_result->>'from')::date,(p_result->>'to_exclusive')::date,fingerprint,normalized)
    on conflict(user_id,health_user_id,from_date,to_date_exclusive,payload_sha256) do nothing;
  get diagnostics stored=row_count;
  update public.health_google_connections set last_read_at=clock_timestamp(),last_error=null,
    lease_token=null,lease_until='1970-01-01T00:00:00Z' where user_id=p_user_id;
  return case when stored=1 then 'stored' else 'unchanged' end;
end $$;

revoke all on function public.health_google_begin_authorization(uuid,text,text,timestamptz) from public,anon,authenticated;
revoke all on function public.health_google_consume_state(text) from public,anon,authenticated;
revoke all on function public.health_google_save_authorization(uuid,uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.health_google_disconnect(uuid) from public,anon,authenticated;
revoke all on function public.health_google_finish_read(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.health_google_begin_authorization(uuid,text,text,timestamptz) to service_role;
grant execute on function public.health_google_consume_state(text) to service_role;
grant execute on function public.health_google_save_authorization(uuid,uuid,text,text,text) to service_role;
grant execute on function public.health_google_disconnect(uuid) to service_role;
grant execute on function public.health_google_finish_read(uuid,uuid,uuid,jsonb) to service_role;
