CREATE FUNCTION public.synthetic_effect_trigger() RETURNS trigger LANGUAGE plpgsql AS $synthetic$
BEGIN
 INSERT INTO public.synthetic_effects(note) VALUES('synthetic-trigger-fired');
 RETURN NEW;
END;
$synthetic$;
CREATE TRIGGER synthetic_update_trigger BEFORE UPDATE ON public.health_lab_results
FOR EACH ROW EXECUTE FUNCTION public.synthetic_effect_trigger();
