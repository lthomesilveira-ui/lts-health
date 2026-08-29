create table if not exists public.health_source_daily_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_record_id text not null,
  metric_date date not null,
  metric_type text not null,
  value numeric not null check (value >= 0),
  unit text,
  source_name text not null,
  source_family text not null,
  canonical_status text not null default 'candidate' check (canonical_status in ('candidate','canonical','held','superseded')),
  confidence text not null default 'high',
  source_file text,
  source_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source_record_id)
);

create index if not exists health_source_daily_metrics_user_date_idx
  on public.health_source_daily_metrics (user_id, metric_date desc);
create index if not exists health_source_daily_metrics_user_source_date_idx
  on public.health_source_daily_metrics (user_id, source_family, metric_date desc);
create index if not exists health_source_daily_metrics_user_type_date_idx
  on public.health_source_daily_metrics (user_id, metric_type, metric_date desc);

alter table public.health_source_daily_metrics enable row level security;

drop policy if exists health_source_daily_metrics_select_own on public.health_source_daily_metrics;
create policy health_source_daily_metrics_select_own on public.health_source_daily_metrics
  for select using (auth.uid() = user_id);

drop policy if exists health_source_daily_metrics_insert_own on public.health_source_daily_metrics;
create policy health_source_daily_metrics_insert_own on public.health_source_daily_metrics
  for insert with check (auth.uid() = user_id);

drop policy if exists health_source_daily_metrics_update_own on public.health_source_daily_metrics;
create policy health_source_daily_metrics_update_own on public.health_source_daily_metrics
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists health_source_daily_metrics_delete_own on public.health_source_daily_metrics;
create policy health_source_daily_metrics_delete_own on public.health_source_daily_metrics
  for delete using (auth.uid() = user_id);
