SET TIME ZONE 'UTC';
DO $assert$
BEGIN
 IF (SELECT count(*) FROM public.health_lab_results) <> 3 THEN RAISE EXCEPTION 'Expected exactly three synthetic rows'; END IF;
 IF EXISTS (SELECT 1 FROM public.synthetic_expected e LEFT JOIN public.health_lab_results l USING(id) WHERE to_jsonb(l) IS DISTINCT FROM e.after_row) THEN
  RAISE EXCEPTION 'Synthetic exact after state failed';
 END IF;
END;
$assert$;
