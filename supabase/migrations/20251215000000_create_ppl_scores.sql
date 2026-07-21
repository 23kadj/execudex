-- Migration: Create ppl_scores table
-- Date: 2025-12-15
-- Description:
--   Base table for user-submitted politician scores (0-5 stars). Backfilled
--   into migration history on 2026-07-13 because the table existed on the
--   linked remote project but was never captured by a CREATE TABLE migration,
--   which broke `supabase start` on a fresh local stack (20251216's trigger
--   migration referenced the table before it existed).

CREATE TABLE IF NOT EXISTS public.ppl_scores (
  id bigserial PRIMARY KEY,
  user_id uuid,
  index_id integer NOT NULL,
  score integer NOT NULL CHECK (score >= 0 AND score <= 5),
  created_at timestamptz DEFAULT now()
);
