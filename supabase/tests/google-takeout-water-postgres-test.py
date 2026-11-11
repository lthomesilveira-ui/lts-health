"""Execute the real migration against a fresh, disposable loopback PostgreSQL."""
import json
import os
import subprocess
from pathlib import Path

assert os.environ.get("TAKEOUT_WATER_SYNTHETIC_TEST") == "1"
assert os.environ.get("PGDATABASE") == "takeout_water_test"
assert os.environ.get("PGUSER") == "postgres"
assert os.environ.get("PGPASSWORD") == "synthetic-ci-only"
assert os.environ.get("PGHOST") in ("127.0.0.1", "::1")
assert not any(os.environ.get(k) for k in ("PGHOSTADDR", "PGSERVICE", "PGSERVICEFILE"))
env = {k: os.environ[k] for k in ("PATH", "PGHOST", "PGPORT", "PGDATABASE", "PGUSER", "PGPASSWORD")}
env.update(PGCONNECT_TIMEOUT="5", PGSSLMODE="disable", PGPASSFILE="/dev/null")


def run(sql, error=None):
    result = subprocess.run(["psql", "-X", "-Atq", "-v", "ON_ERROR_STOP=1"],
                            input="set statement_timeout='10s';\n" + sql, text=True,
                            capture_output=True, env=env, timeout=20)
    if error:
        assert result.returncode != 0, "unsafe write unexpectedly succeeded"
        assert error in result.stderr, result.stderr
    else:
        assert result.returncode == 0, result.stderr
    return result.stdout.strip()


def literal(value):
    return "'" + str(value).replace("'", "''") + "'"


root = Path(__file__).resolve().parents[2]
owner = "11111111-1111-4111-8111-111111111111"
other = "22222222-2222-4222-8222-222222222222"
assert run("select current_database();") == "takeout_water_test"
assert run("select not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public') and not exists(select 1 from pg_namespace where nspname='auth');") == "t", "refuse existing database"
run(f"""
create role anon; create role authenticated; create role service_role bypassrls;
create schema auth; create table auth.users(id uuid primary key);
insert into auth.users values('{owner}'),('{other}');
create function auth.uid() returns uuid language sql stable as
$$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema public,auth to anon,authenticated,service_role;
{(root/'supabase/migrations/20260829190410_add_source_daily_metrics_for_apple_bridge.sql').read_text()}
create table public.health_daily_nutrition(source_family text,confidence text,source_record_id text);
alter table public.health_source_daily_metrics add constraint health_source_daily_metrics_current_canonical_boundary check(true);
grant all on public.health_source_daily_metrics to anon,authenticated,service_role;
{(root/'supabase/migrations/20261004195418_allow_authenticated_auto_export_nutrition.sql').read_text()}
""")
run(f"""insert into public.health_source_daily_metrics(user_id,source_record_id,metric_date,metric_type,value,unit,source_name,source_family,canonical_status)
values('{owner}','existing-synthetic','2030-02-10','exercise_minutes',42,'min','Apple Health','apple_activity_summary','canonical');""")
baseline = run("select md5(row_to_json(t)::text) from public.health_source_daily_metrics t;")
migration = root / 'supabase/migrations/20261111023742_allow_authenticated_google_takeout_water.sql'
run(migration.read_text())
assert run("select md5(row_to_json(t)::text) from public.health_source_daily_metrics t;") == baseline
payload = dict(entry_method="google_health_takeout_water_v1", export_version=1,
               archive_sha256="a" * 64, original_unit="MILLILITER", original_source="MyFitnessPal Fitbit 3P Web API",
               aggregation="day", local_date="2030-02-11", archive_member="synthetic_hydration.csv", csv_line=2,
               original_start="2030-02-11T03:00:00Z", original_end="2030-02-11T03:01:00Z")
row = dict(user_id=owner, source_record_id="google_health_takeout:water:" + "b" * 64,
           metric_date="2030-02-11", metric_type="dietary_water_ml", value=1234, unit="mL",
           source_name="MyFitnessPal · Google Health", source_family="google_health_takeout",
           canonical_status="canonical", confidence="authenticated_google_takeout", source_payload=payload)


def insert(record, role="service_role", error=None):
    sql = ",".join(literal(json.dumps(v) if isinstance(v, dict) else v) for v in record.values())
    return run(f"set role {role};set request.jwt.claim.sub='{owner}';insert into public.health_source_daily_metrics({','.join(record)}) values({sql});", error)


# Required evidence cannot exploit SQL CHECK's NULL acceptance.
for key in payload:
    incomplete = {k: v for k, v in payload.items() if k != key}
    insert({**row, "source_payload": incomplete}, error="check constraint")
for changes in [{"value": 0}, {"value": 100001}, {"unit": "L"}, {"metric_type": "dietary_energy_kcal"},
                {"confidence": "user_confirmed"}, {"source_name": "Google Health App"},
                {"metric_date": "2030-02-12"}, {"source_record_id": "google_health_takeout:water:invalid"},
                {"source_payload": {**payload, "original_source": "MyFitnessPal Google Web API"}}]:
    insert({**row, **changes}, error="check constraint")
insert(row)
insert(row, error="unique constraint")
assert run("select count(*) from public.health_source_daily_metrics;") == "2"

# Authenticated browsers cannot forge, update or relabel protected evidence.
insert({**row, "source_record_id": "google_health_takeout:water:" + "c" * 64}, "authenticated", "server transport write only")
insert({**row, "canonical_status": "held", "source_payload": {}}, "authenticated", "server transport write only")
for change in ["value=2000", "source_family='unverified',confidence='high',source_record_id='renamed',canonical_status='held'"]:
    run(f"set role authenticated;set request.jwt.claim.sub='{owner}';update public.health_source_daily_metrics set {change} where source_family='google_health_takeout';", "server transport write only")

# Existing manual-water behavior and owner isolation remain intact.
manual = {**row, "source_record_id": "mfp-water:2030-02-12", "metric_date": "2030-02-12",
          "source_family": "myfitnesspal", "source_name": "MyFitnessPal", "confidence": "user_confirmed",
          "source_payload": {"entry_method": "mfp_water_total_v1"}}
insert(manual, "authenticated")
insert({**manual, "user_id": other}, "authenticated", "row-level security")
bridge = {**row, "source_record_id": "health_auto_export:synthetic", "source_family": "health_auto_export",
          "confidence": "authenticated_auto_export", "source_payload": {"transport": "health_auto_export", "aggregation": "day", "export_version": 2}}
insert(bridge)
insert({**bridge, "source_record_id": "health_auto_export:forged"}, "authenticated", "server transport write only")
assert run("select md5(row_to_json(t)::text) from public.health_source_daily_metrics t where source_record_id='existing-synthetic';") == baseline
assert run("select relrowsecurity from pg_class where oid='public.health_source_daily_metrics'::regclass;") == "t"
assert run("select has_function_privilege('authenticated','public.health_google_takeout_server_write_only()','execute');") == "f"
print("Takeout PostgreSQL boundary, missing evidence, browser forgery, owner isolation and preserved sources: passed")
