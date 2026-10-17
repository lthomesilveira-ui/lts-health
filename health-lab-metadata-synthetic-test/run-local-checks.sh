#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
for command in initdb pg_ctl psql createdb; do
 command -v "$command" >/dev/null || { echo "Missing local PostgreSQL executable: $command. No install or database action attempted." >&2; exit 2; }
done
cluster=$(mktemp -d /tmp/health-lab-synthetic.XXXXXX)
cleanup(){ pg_ctl -D "$cluster/data" -m immediate -w stop >/dev/null 2>&1 || true; rm -rf "$cluster"; }
trap cleanup EXIT
mkdir -m 700 "$cluster/socket"
initdb -D "$cluster/data" -A trust --no-locale >/dev/null
pg_ctl -D "$cluster/data" -l "$cluster/server.log" -o "-h '' -k '$cluster/socket' -p 55432" -w start >/dev/null
export PGHOST="$cluster/socket" PGPORT=55432 PGDATABASE=synthetic_lab_review HEALTH_SYNTHETIC_PG=1
createdb synthetic_lab_review
bash run-checks.sh
