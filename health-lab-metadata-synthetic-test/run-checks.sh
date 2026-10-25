#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
: "${HEALTH_SYNTHETIC_PG:?Set HEALTH_SYNTHETIC_PG=1 for a disposable synthetic database only}"
[[ "$HEALTH_SYNTHETIC_PG" == 1 ]] || exit 2
: "${PGHOST:?Explicit local host or Unix socket directory required}"
case "$PGHOST" in 127.0.0.1|localhost|/*) ;; *) echo 'Refusing a nonlocal database host' >&2; exit 2;; esac
[[ "${PGDATABASE:-}" == synthetic_lab_review ]] || { echo 'Refusing a database outside the synthetic fixture contract' >&2; exit 2; }
command -v psql >/dev/null || { echo 'PostgreSQL psql is required; no installation attempted.' >&2; exit 2; }
PSQL=(psql -X -v ON_ERROR_STOP=1)
[[ "$("${PSQL[@]}" -Atc 'SELECT current_database()')" == synthetic_lab_review ]] || exit 2
[[ "$("${PSQL[@]}" -Atc "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','f','S')")" == 0 ]] || { echo 'Refusing a nonempty public schema' >&2; exit 2; }
TMP_TEST=$(mktemp -d)
trap 'rm -rf "$TMP_TEST"' EXIT
log(){ printf 'PASS %s\n' "$1"; }
run(){ "${PSQL[@]}" -f "$1" >/dev/null; }
expect_failure(){
 local file=$1 expected=$2
 if "${PSQL[@]}" -f "$file" >"$TMP_TEST/failure.log" 2>&1; then echo "Expected failure: $file" >&2; exit 1; fi
 grep -F "$expected" "$TMP_TEST/failure.log" >/dev/null || { cat "$TMP_TEST/failure.log"; exit 1; }
}
checkpoint(){ "${PSQL[@]}" -c 'TRUNCATE public.synthetic_checkpoint; INSERT INTO public.synthetic_checkpoint SELECT id,to_jsonb(l) FROM public.health_lab_results l;' >/dev/null; }
assert_checkpoint(){ "${PSQL[@]}" <<'SQL' >/dev/null
DO $assert$
BEGIN
 IF (SELECT count(*) FROM public.health_lab_results)<>(SELECT count(*) FROM public.synthetic_checkpoint) OR
 EXISTS(SELECT 1 FROM public.synthetic_checkpoint e FULL JOIN public.health_lab_results l USING(id) WHERE e.row_data IS DISTINCT FROM to_jsonb(l)) THEN
  RAISE EXCEPTION 'Failed operation changed the synthetic checkpoint';
 END IF;
END;
$assert$;
SQL
}
assert_no_effects(){ [[ "$("${PSQL[@]}" -Atc 'SELECT count(*) FROM public.synthetic_effects')" == 0 ]]; }
restore_notes(){ "${PSQL[@]}" -c "UPDATE public.health_lab_results l SET notes=e.before_row->>'notes' FROM public.synthetic_expected e WHERE l.id=e.id;" >/dev/null; }
run fixture.sql
"${PSQL[@]}" <<'SQL' >/dev/null
CREATE TABLE public.synthetic_checkpoint(id uuid PRIMARY KEY,row_data jsonb NOT NULL);
CREATE TABLE public.synthetic_effects(note text NOT NULL);
SQL
run assert-before.sql
run apply.sql; run assert-after.sql; log 'normal apply changes exactly the three intended rows/fields'
before_version=$(${PSQL[@]} -Atc "SELECT string_agg(id::text||':'||xmin::text,',' ORDER BY id) FROM public.health_lab_results")
run apply.sql; run assert-after.sql
[[ "$before_version" == "$(${PSQL[@]} -Atc "SELECT string_agg(id::text||':'||xmin::text,',' ORDER BY id) FROM public.health_lab_results")" ]]
log 'exact apply replay is a physical no-op'
run rollback.sql; run assert-before.sql; log 'rollback restores the exact before-images'
before_version=$(${PSQL[@]} -Atc "SELECT string_agg(id::text||':'||xmin::text,',' ORDER BY id) FROM public.health_lab_results")
run rollback.sql; run assert-before.sql
[[ "$before_version" == "$(${PSQL[@]} -Atc "SELECT string_agg(id::text||':'||xmin::text,',' ORDER BY id) FROM public.health_lab_results")" ]]
log 'rollback replay is a physical no-op'
"${PSQL[@]}" -c "UPDATE public.health_lab_results SET notes='Synthetic concurrent edit' WHERE id='00000000-0000-0000-0000-000000000002';" >/dev/null
checkpoint; expect_failure apply.sql 'Reviewed target changed'; assert_checkpoint; log 'apply conflict aborts before any target write'
restore_notes; run assert-before.sql
run apply.sql
"${PSQL[@]}" -c "UPDATE public.health_lab_results SET notes='Synthetic later edit' WHERE id='00000000-0000-0000-0000-000000000002';" >/dev/null
checkpoint; expect_failure rollback.sql 'Reviewed target changed'; assert_checkpoint; log 'rollback protects later edits'
restore_notes; run assert-after.sql; run rollback.sql
"${PSQL[@]}" -c "DELETE FROM public.health_lab_results WHERE id='00000000-0000-0000-0000-000000000002';" >/dev/null
checkpoint; expect_failure apply.sql 'Reviewed target missing or owner mismatch'; assert_checkpoint; log 'missing row aborts without partial apply'
"${PSQL[@]}" -c 'INSERT INTO public.health_lab_results SELECT (jsonb_populate_record(NULL::public.health_lab_results,e.before_row)).* FROM public.synthetic_expected e WHERE NOT EXISTS(SELECT 1 FROM public.health_lab_results l WHERE l.id=e.id);' >/dev/null
run assert-before.sql
for direction in apply rollback; do
 if [[ "$direction" == rollback ]]; then run apply.sql; fi
 run add-trigger.sql; checkpoint
 expect_failure "$direction.sql" 'Trigger configuration changed'; assert_checkpoint; assert_no_effects
 "${PSQL[@]}" -c 'DROP TRIGGER synthetic_update_trigger ON public.health_lab_results; DROP FUNCTION public.synthetic_effect_trigger();' >/dev/null
 log "$direction blocks trigger side effects"
 run add-rule.sql; checkpoint
 expect_failure "$direction.sql" 'Rewrite rule configuration changed'; assert_checkpoint; assert_no_effects
 "${PSQL[@]}" -c 'DROP RULE synthetic_update_rule ON public.health_lab_results;' >/dev/null
 log "$direction blocks rewrite-rule side effects"
 if [[ "$direction" == rollback ]]; then run rollback.sql; fi
done
run assert-before.sql
log 'all synthetic SQL checks completed'
