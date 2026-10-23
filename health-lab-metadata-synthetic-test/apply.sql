-- SYNTHETIC ONLY. Run solely in a disposable local PostgreSQL cluster.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL TIME ZONE 'UTC';
-- Freeze trigger/rule DDL before checking side effects; unrelated row writes remain allowed.
LOCK TABLE public.health_lab_results IN ROW EXCLUSIVE MODE;
DO $review$
DECLARE
  targets jsonb := $review_rows$[{"before":{"id":"00000000-0000-0000-0000-000000000001","user_id":"00000000-0000-0000-0000-000000000099","source_record_id":"synthetic-marker-1","biomarker":"Synthetic marker 1","collection_date":"2025-01-15","report_date":"2025-01-15","result_raw":"11","result_numeric":11,"unit":"synthetic-unit","method":"Synthetic method","laboratory":"Synthetic laboratory","source":"Synthetic fixture","source_file":"synthetic.pdf","flag":null,"confidence":"synthetic","notes":"Synthetic fixture only","created_at":"2025-01-15T00:00:00+00:00","reference_range":null,"source_payload":{"retained":{"nested":[1,2,3]},"method_verification":{"audit_id":"synthetic-method-proof"}}},"after":{"id":"00000000-0000-0000-0000-000000000001","user_id":"00000000-0000-0000-0000-000000000099","source_record_id":"synthetic-marker-1","biomarker":"Synthetic marker 1","collection_date":"2025-01-15","report_date":"2025-01-15","result_raw":"11","result_numeric":11,"unit":"synthetic-unit","method":"Synthetic method","laboratory":"Synthetic laboratory","source":"Synthetic fixture","source_file":"synthetic.pdf","flag":null,"confidence":"synthetic","notes":"Synthetic fixture only","created_at":"2025-01-15T00:00:00+00:00","reference_range":"1 a 21 synthetic-unit","source_payload":{"retained":{"nested":[1,2,3]},"method_verification":{"audit_id":"synthetic-method-proof"},"reference_verification":{"audit_id":"synthetic-reference-proof","pdf_page":1,"reference_text":"1 a 21 synthetic-unit"}}}},{"before":{"id":"00000000-0000-0000-0000-000000000002","user_id":"00000000-0000-0000-0000-000000000099","source_record_id":"synthetic-marker-2","biomarker":"Synthetic marker 2","collection_date":"2025-01-15","report_date":"2025-01-15","result_raw":"12","result_numeric":12,"unit":"synthetic-unit","method":"Synthetic method","laboratory":"Synthetic laboratory","source":"Synthetic fixture","source_file":"synthetic.pdf","flag":null,"confidence":"synthetic","notes":"Synthetic fixture only","created_at":"2025-01-15T00:00:00+00:00","reference_range":null,"source_payload":{"retained":{"nested":[1,2,3]},"method_verification":{"audit_id":"synthetic-method-proof"}}},"after":{"id":"00000000-0000-0000-0000-000000000002","user_id":"00000000-0000-0000-0000-000000000099","source_record_id":"synthetic-marker-2","biomarker":"Synthetic marker 2","collection_date":"2025-01-15","report_date":"2025-01-15","result_raw":"12","result_numeric":12,"unit":"synthetic-unit","method":"Synthetic method","laboratory":"Synthetic laboratory","source":"Synthetic fixture","source_file":"synthetic.pdf","flag":null,"confidence":"synthetic","notes":"Synthetic fixture only","created_at":"2025-01-15T00:00:00+00:00","reference_range":"2 a 22 synthetic-unit","source_payload":{"retained":{"nested":[1,2,3]},"method_verification":{"audit_id":"synthetic-method-proof"},"reference_verification":{"audit_id":"synthetic-reference-proof","pdf_page":2,"reference_text":"2 a 22 synthetic-unit"}}}},{"before":{"id":"00000000-0000-0000-0000-000000000003","user_id":"00000000-0000-0000-0000-000000000099","source_record_id":"synthetic-marker-3","biomarker":"Synthetic marker 3","collection_date":"2025-01-15","report_date":"2025-01-15","result_raw":"13","result_numeric":13,"unit":"synthetic-unit","method":"Synthetic method","laboratory":"Synthetic laboratory","source":"Synthetic fixture","source_file":"synthetic.pdf","flag":null,"confidence":"synthetic","notes":"Synthetic fixture only","created_at":"2025-01-15T00:00:00+00:00","reference_range":null,"source_payload":{"retained":{"nested":[1,2,3]},"method_verification":{"audit_id":"synthetic-method-proof"}}},"after":{"id":"00000000-0000-0000-0000-000000000003","user_id":"00000000-0000-0000-0000-000000000099","source_record_id":"synthetic-marker-3","biomarker":"Synthetic marker 3","collection_date":"2025-01-15","report_date":"2025-01-15","result_raw":"13","result_numeric":13,"unit":"synthetic-unit","method":"Synthetic method","laboratory":"Synthetic laboratory","source":"Synthetic fixture","source_file":"synthetic.pdf","flag":null,"confidence":"synthetic","notes":"Synthetic fixture only","created_at":"2025-01-15T00:00:00+00:00","reference_range":"3 a 23 synthetic-unit","source_payload":{"retained":{"nested":[1,2,3]},"method_verification":{"audit_id":"synthetic-method-proof"},"reference_verification":{"audit_id":"synthetic-reference-proof","pdf_page":3,"reference_text":"3 a 23 synthetic-unit"}}}}]$review_rows$::jsonb;
  target jsonb;
  current_row jsonb;
  changed_count integer;
  total_changed integer := 0;
BEGIN
  IF jsonb_array_length(targets) <> 3 OR
     (SELECT count(DISTINCT value->'before'->>'id') FROM jsonb_array_elements(targets)) <> 3 THEN
    RAISE EXCEPTION 'Expected exactly three distinct reviewed targets';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.health_lab_results'::regclass AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'Trigger configuration changed; review write side effects first';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_rewrite WHERE ev_class='public.health_lab_results'::regclass AND rulename<>'_RETURN') THEN
    RAISE EXCEPTION 'Rewrite rule configuration changed; review write side effects first';
  END IF;
  -- Lock and validate every row before the first update.
  FOR target IN SELECT value FROM jsonb_array_elements(targets) ORDER BY value->'before'->>'id' LOOP
    SELECT to_jsonb(l) INTO current_row FROM public.health_lab_results AS l
      WHERE l.id=(target->'before'->>'id')::uuid
        AND l.user_id=(target->'before'->>'user_id')::uuid
      FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Reviewed target missing or owner mismatch'; END IF;
    IF current_row IS DISTINCT FROM target->'before' AND current_row IS DISTINCT FROM target->'after' THEN
      RAISE EXCEPTION 'Reviewed target changed; refresh preimage and review again';
    END IF;
  END LOOP;
  FOR target IN SELECT value FROM jsonb_array_elements(targets) ORDER BY value->'before'->>'id' LOOP
    SELECT to_jsonb(l) INTO current_row FROM public.health_lab_results AS l
      WHERE l.id=(target->'before'->>'id')::uuid AND l.user_id=(target->'before'->>'user_id')::uuid;
    IF current_row = target->'before' THEN
      UPDATE public.health_lab_results AS l
        SET reference_range=target->'after'->>'reference_range',
            source_payload=CASE WHEN target->'after'->'source_payload'='null'::jsonb THEN NULL ELSE target->'after'->'source_payload' END
        WHERE l.id=(target->'before'->>'id')::uuid
          AND l.user_id=(target->'before'->>'user_id')::uuid
          AND to_jsonb(l)=target->'before';
      GET DIAGNOSTICS changed_count = ROW_COUNT;
      IF changed_count <> 1 THEN RAISE EXCEPTION 'Conditional write did not change exactly one target'; END IF;
      total_changed := total_changed + changed_count;
    END IF;
  END LOOP;
  FOR target IN SELECT value FROM jsonb_array_elements(targets) LOOP
    SELECT to_jsonb(l) INTO current_row FROM public.health_lab_results AS l
      WHERE l.id=(target->'before'->>'id')::uuid AND l.user_id=(target->'before'->>'user_id')::uuid;
    IF NOT FOUND OR current_row IS DISTINCT FROM target->'after' THEN
      RAISE EXCEPTION 'Exact postcondition failed; rollback transaction';
    END IF;
  END LOOP;
  RAISE NOTICE 'Reviewed reference apply: changed %, total targets 3', total_changed;
END;
$review$;
COMMIT;
