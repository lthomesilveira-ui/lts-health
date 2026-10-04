-- Polar OAuth credentials are encrypted in Edge Functions and are service-only.
create table public.health_polar_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tokens_encrypted text not null,
  scopes text[] not null,
  revision uuid not null default gen_random_uuid(),
  connected_at timestamptz not null default now(),
  last_sync_at timestamptz,
  last_attempt_at timestamptz,
  sync_error text check (sync_error in ('provider_unavailable','authorization_expired','write_failed')),
  sync_lease_until timestamptz not null default '1970-01-01T00:00:00Z'
);
alter table public.health_polar_connections enable row level security;
revoke all on public.health_polar_connections from public, anon, authenticated;
grant select, insert, update, delete on public.health_polar_connections to service_role;

create table public.health_polar_oauth_states (
  state_hash text primary key check (state_hash ~ '^[a-f0-9]{64}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index health_polar_oauth_states_user_expiry on public.health_polar_oauth_states(user_id, expires_at);
alter table public.health_polar_oauth_states enable row level security;
revoke all on public.health_polar_oauth_states from public, anon, authenticated;
grant select, insert, delete on public.health_polar_oauth_states to service_role;

-- A provider session stays separate from canonical strength sessions, avoiding double counting.
create table public.health_polar_sessions (
  user_id uuid not null references auth.users(id) on delete cascade,
  source_record_id text not null,
  workout_date date not null,
  recorded_start text not null,
  session_name text not null,
  duration_minutes numeric check (duration_minutes >= 0),
  heart_rate_avg numeric check (heart_rate_avg > 0 and heart_rate_avg <= 300),
  heart_rate_max numeric check (heart_rate_max > 0 and heart_rate_max <= 300),
  source_name text not null,
  source_payload jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, source_record_id)
);
alter table public.health_polar_sessions enable row level security;
revoke all on public.health_polar_sessions from public, anon, authenticated;
grant select on public.health_polar_sessions to authenticated;
grant select, insert, update, delete on public.health_polar_sessions to service_role;
create policy "Owners read their Polar sessions" on public.health_polar_sessions for select to authenticated using ((select auth.uid()) = user_id);
create index health_polar_sessions_user_date on public.health_polar_sessions(user_id, workout_date);
