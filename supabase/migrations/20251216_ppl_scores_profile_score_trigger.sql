-- Migration: Keep ppl_profiles.score in sync with ppl_scores average
-- Date: 2025-12-16
-- Description:
--   Whenever a score is inserted/updated/deleted in ppl_scores, recompute the
--   average score for that politician (by index_id) and store it in
--   ppl_profiles.score.

CREATE OR REPLACE FUNCTION public.recompute_ppl_profile_score(p_index_id integer)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_avg numeric;
BEGIN
  IF p_index_id IS NULL THEN
    RETURN;
  END IF;

  SELECT round(avg(score)::numeric, 1)
  INTO v_avg
  FROM public.ppl_scores
  WHERE index_id = p_index_id
    AND score IS NOT NULL;

  UPDATE public.ppl_profiles
  SET score = v_avg
  WHERE index_id = p_index_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_ppl_scores_recompute_profile_score()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    PERFORM public.recompute_ppl_profile_score(OLD.index_id);
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    IF (NEW.index_id IS DISTINCT FROM OLD.index_id) THEN
      PERFORM public.recompute_ppl_profile_score(OLD.index_id);
    END IF;
    PERFORM public.recompute_ppl_profile_score(NEW.index_id);
    RETURN NEW;
  ELSE
    PERFORM public.recompute_ppl_profile_score(NEW.index_id);
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS ppl_scores_recompute_profile_score ON public.ppl_scores;

CREATE TRIGGER ppl_scores_recompute_profile_score
AFTER INSERT OR UPDATE OR DELETE ON public.ppl_scores
FOR EACH ROW
EXECUTE FUNCTION public.trg_ppl_scores_recompute_profile_score();


