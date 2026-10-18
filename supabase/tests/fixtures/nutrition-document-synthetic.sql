-- SYNTHETIC, DISPOSABLE PostgreSQL 17 TEST DATABASE ONLY. Never run in production.
-- The JavaScript integration harness checks host and database before this file.
DO $$ BEGIN
  IF current_database() <> 'nutrition_document_test' OR current_setting('server_version_num')::integer / 10000 <> 17
  THEN RAISE EXCEPTION 'Expected isolated nutrition_document_test PostgreSQL 17 database'; END IF;
END $$;

DROP TABLE IF EXISTS public.health_documents CASCADE;
DROP TABLE IF EXISTS public.health_personal_goals;
DROP TABLE IF EXISTS public.health_lab_results;
DROP TABLE IF EXISTS public.health_medication_prescriptions;
DROP TABLE IF EXISTS public.health_daily_nutrition;
DROP TABLE IF EXISTS public.health_source_daily_metrics;

CREATE TABLE public.health_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source_record_id text NOT NULL,
  document_date date,
  title text,
  document_type text,
  source_file text,
  source text,
  checksum text,
  extraction_status text CHECK (extraction_status IS NULL OR extraction_status IN ('pending','extracted','review_required','validated')),
  confidence text,
  notes text,
  source_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, source_record_id)
);
-- Scope sentinels, deliberately not copies of any production medical schema.
CREATE TABLE public.health_personal_goals (id integer PRIMARY KEY, value jsonb NOT NULL);
CREATE TABLE public.health_lab_results (id integer PRIMARY KEY, value jsonb NOT NULL);
CREATE TABLE public.health_medication_prescriptions (id integer PRIMARY KEY, value jsonb NOT NULL);
CREATE TABLE public.health_daily_nutrition (id integer PRIMARY KEY, value jsonb NOT NULL);
CREATE TABLE public.health_source_daily_metrics (id integer PRIMARY KEY, value jsonb NOT NULL);
INSERT INTO public.health_personal_goals VALUES (1, '{"synthetic":"personal goals preserved"}');
INSERT INTO public.health_lab_results VALUES (1, '{"synthetic":"results preserved"}');
INSERT INTO public.health_medication_prescriptions VALUES (1, '{"synthetic":"prescriptions preserved"}');
INSERT INTO public.health_daily_nutrition VALUES (1, '{"synthetic":"consumption preserved"}');
INSERT INTO public.health_source_daily_metrics VALUES (1, '{"synthetic":"water metrics preserved"}');
INSERT INTO public.health_documents
  (id,user_id,source_record_id,document_date,title,document_type,source_file,source,checksum,extraction_status,confidence,notes,source_payload,created_at)
VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','11111111-1111-4111-8111-111111111111','synthetic:existing:anchor','2025-01-01','Synthetic anchor','medical_plan','synthetic-anchor.pdf','Synthetic source',repeat('b',64),'validated','source_verified','Preserve exactly','{"synthetic":true,"water_reference_ui":{"base_ml_per_day":2100}}','2025-01-01T01:00:00Z'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','11111111-1111-4111-8111-111111111111','synthetic:existing:history','2025-01-02','Synthetic history','care_followup','synthetic-history.pdf','Synthetic source',repeat('c',64),'validated','source_verified',NULL,'{"synthetic":true,"history":"preserve"}','2025-01-02T02:00:00Z'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1','22222222-2222-4222-8222-222222222222','synthetic:other-owner:document','2025-01-03','Synthetic other owner','medical_plan','synthetic-other.pdf','Synthetic source',repeat('d',64),'validated','source_verified','Other owner preserved','{"synthetic":true,"other_owner":true}','2025-01-03T03:00:00Z');
