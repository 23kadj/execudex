-- Migration: Fix ppl_scores user_id column
-- Date: 2025-12-18
-- Description: Ensure user_id column exists and is properly configured for storing user IDs

-- Ensure the ppl_scores table exists with proper structure
CREATE TABLE IF NOT EXISTS public.ppl_scores (
  id bigserial PRIMARY KEY,
  user_id uuid,
  index_id integer NOT NULL,
  score integer NOT NULL CHECK (score >= 0 AND score <= 5),
  created_at timestamptz DEFAULT now()
);

-- Ensure user_id column exists (in case table was created without it)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'ppl_scores' 
    AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.ppl_scores ADD COLUMN user_id uuid;
  END IF;
END $$;

-- Ensure user_id is uuid type (in case it was created with wrong type)
DO $$
BEGIN
  -- This will safely convert if needed
  ALTER TABLE public.ppl_scores 
  ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
EXCEPTION
  WHEN OTHERS THEN
    -- If conversion fails, column might already be correct type
    RAISE NOTICE 'user_id column type already correct or conversion not needed';
END $$;

-- Create index on user_id for better query performance
CREATE INDEX IF NOT EXISTS idx_ppl_scores_user_id ON public.ppl_scores(user_id);

-- Create compound index for user_id + index_id lookups (the most common query)
CREATE UNIQUE INDEX IF NOT EXISTS idx_ppl_scores_user_index 
ON public.ppl_scores(user_id, index_id);

-- Create index on index_id for average calculations
CREATE INDEX IF NOT EXISTS idx_ppl_scores_index_id ON public.ppl_scores(index_id);

-- Add foreign key constraint to users table (if users table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'users'
  ) THEN
    -- Drop existing constraint if it exists
    ALTER TABLE public.ppl_scores 
    DROP CONSTRAINT IF EXISTS fk_ppl_scores_user_id;
    
    -- Add foreign key constraint
    ALTER TABLE public.ppl_scores 
    ADD CONSTRAINT fk_ppl_scores_user_id 
    FOREIGN KEY (user_id) REFERENCES public.users(uuid) ON DELETE CASCADE;
  END IF;
END $$;

-- Enable RLS on ppl_scores table
ALTER TABLE public.ppl_scores ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view all scores" ON public.ppl_scores;
DROP POLICY IF EXISTS "Users can insert their own scores" ON public.ppl_scores;
DROP POLICY IF EXISTS "Users can update their own scores" ON public.ppl_scores;
DROP POLICY IF EXISTS "Service role can do anything" ON public.ppl_scores;

-- Create RLS policies
-- Policy 1: Anyone can view all scores (for averages)
CREATE POLICY "Users can view all scores"
ON public.ppl_scores
FOR SELECT
TO authenticated, anon
USING (true);

-- Policy 2: Users can insert their own scores
CREATE POLICY "Users can insert their own scores"
ON public.ppl_scores
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy 3: Users can update their own scores
CREATE POLICY "Users can update their own scores"
ON public.ppl_scores
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy 4: Service role bypasses all RLS
CREATE POLICY "Service role can do anything"
ON public.ppl_scores
TO service_role
USING (true)
WITH CHECK (true);

-- Add helpful comment
COMMENT ON TABLE public.ppl_scores IS 'Stores individual user scores (0-5 stars) for politicians. user_id links to users.uuid, index_id links to ppl_index.id';
COMMENT ON COLUMN public.ppl_scores.user_id IS 'UUID of the user who submitted this score (from auth.users.id or users.uuid)';
COMMENT ON COLUMN public.ppl_scores.index_id IS 'Reference to ppl_index.id (the politician being scored)';
COMMENT ON COLUMN public.ppl_scores.score IS 'User rating from 0-5 stars';

-- Create RPC function for inserting scores (bypasses any client-side issues)
CREATE OR REPLACE FUNCTION public.insert_ppl_score(
  p_user_id uuid,
  p_index_id integer,
  p_score integer
)
RETURNS TABLE (
  id bigint,
  user_id uuid,
  index_id integer,
  score integer,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Log the input parameters
  RAISE NOTICE 'insert_ppl_score called with user_id=%, index_id=%, score=%', p_user_id, p_index_id, p_score;
  
  -- Insert and return the row
  RETURN QUERY
  INSERT INTO public.ppl_scores (user_id, index_id, score, created_at)
  VALUES (p_user_id, p_index_id, p_score, now())
  RETURNING ppl_scores.id, ppl_scores.user_id, ppl_scores.index_id, ppl_scores.score, ppl_scores.created_at;
END;
$$;

-- Create RPC function for updating scores
CREATE OR REPLACE FUNCTION public.update_ppl_score(
  p_user_id uuid,
  p_index_id integer,
  p_score integer
)
RETURNS TABLE (
  id bigint,
  user_id uuid,
  index_id integer,
  score integer,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Log the input parameters
  RAISE NOTICE 'update_ppl_score called with user_id=%, index_id=%, score=%', p_user_id, p_index_id, p_score;
  
  -- Update and return the row
  RETURN QUERY
  UPDATE public.ppl_scores
  SET score = p_score, created_at = now()
  WHERE ppl_scores.user_id = p_user_id AND ppl_scores.index_id = p_index_id
  RETURNING ppl_scores.id, ppl_scores.user_id, ppl_scores.index_id, ppl_scores.score, ppl_scores.created_at;
END;
$$;

-- Grant execute permissions to authenticated users and service role
GRANT EXECUTE ON FUNCTION public.insert_ppl_score(uuid, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_ppl_score(uuid, integer, integer) TO authenticated, service_role;

