-- Debug migration: Check ppl_scores table structure and fix user_id issue
-- Date: 2025-12-19

-- First, let's see what's in the table currently
DO $$
BEGIN
  RAISE NOTICE 'Current ppl_scores table structure:';
END $$;

-- Check if there are any BEFORE triggers that might set user_id to NULL
SELECT 
  tgname as trigger_name,
  tgtype,
  tgenabled,
  proname as function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgrelid = 'public.ppl_scores'::regclass
  AND tgtype & 2 = 2; -- BEFORE trigger

-- Check column definition
SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'ppl_scores'
  AND column_name = 'user_id';

-- Drop the table and recreate it from scratch with correct structure
DROP TABLE IF EXISTS public.ppl_scores CASCADE;

CREATE TABLE public.ppl_scores (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL,  -- Make it NOT NULL to force proper saving
  index_id integer NOT NULL,
  score integer NOT NULL CHECK (score >= 0 AND score <= 5),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_ppl_scores_user_id ON public.ppl_scores(user_id);
CREATE INDEX idx_ppl_scores_index_id ON public.ppl_scores(index_id);
CREATE UNIQUE INDEX idx_ppl_scores_user_index ON public.ppl_scores(user_id, index_id);

-- Enable RLS
ALTER TABLE public.ppl_scores ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view all scores" ON public.ppl_scores;
DROP POLICY IF EXISTS "Users can insert their own scores" ON public.ppl_scores;
DROP POLICY IF EXISTS "Users can update their own scores" ON public.ppl_scores;
DROP POLICY IF EXISTS "Service role can do anything" ON public.ppl_scores;

-- Create RLS policies
CREATE POLICY "Users can view all scores"
ON public.ppl_scores
FOR SELECT
TO authenticated, anon
USING (true);

CREATE POLICY "Users can insert their own scores"
ON public.ppl_scores
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scores"
ON public.ppl_scores
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Service role bypasses ALL RLS
CREATE POLICY "Service role full access"
ON public.ppl_scores
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Recreate the trigger for updating ppl_profiles.score
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

-- Add comments
COMMENT ON TABLE public.ppl_scores IS 'Stores individual user scores (0-5 stars) for politicians';
COMMENT ON COLUMN public.ppl_scores.user_id IS 'UUID of the user who submitted this score - REQUIRED';
COMMENT ON COLUMN public.ppl_scores.index_id IS 'Reference to ppl_index.id';
COMMENT ON COLUMN public.ppl_scores.score IS 'User rating from 0-5 stars';

