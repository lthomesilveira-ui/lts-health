-- Minimal SYNTHETIC dependency fixture, not a full production schema rebuild.
-- The test runner permits only a named disposable PostgreSQL 17 loopback DB.
drop schema if exists health_ingest_private cascade;
drop schema if exists public cascade;
drop schema if exists auth cascade;
create schema public;
create schema auth;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;
grant usage on schema public to anon, authenticated, service_role;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
insert into auth.users(id) values ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
create table public.health_daily_nutrition (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_record_id text not null,
  nutrition_date date not null,
  calories_kcal numeric, protein_g numeric, carbs_g numeric, fat_g numeric, fiber_g numeric,
  source text not null, confidence text not null, source_payload jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique(user_id,source_record_id)
);
alter table public.health_daily_nutrition enable row level security;
