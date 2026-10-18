SET TIME ZONE 'UTC';
DO $assert$
BEGIN
 IF (SELECT count(*) FROM public.health_lab_results) <> 67 THEN RAISE EXCEPTION 'Expected exactly 67 synthetic rows'; END IF;
 IF EXISTS (SELECT 1 FROM public.synthetic_expected e LEFT JOIN public.health_lab_results l USING(id) WHERE to_jsonb(l) IS DISTINCT FROM e.before_row) THEN
  RAISE EXCEPTION 'Synthetic exact before state failed';
 END IF;
END;
$assert$;
