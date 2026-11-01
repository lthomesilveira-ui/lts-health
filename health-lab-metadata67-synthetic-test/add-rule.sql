CREATE RULE synthetic_update_rule AS ON UPDATE TO public.health_lab_results
DO ALSO INSERT INTO public.synthetic_effects(note) VALUES('synthetic-rule-fired');
