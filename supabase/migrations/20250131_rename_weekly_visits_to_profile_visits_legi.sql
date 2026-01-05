-- Migration: Rename weekly_visits to profile_visits in legi_index table
-- Date: 2025-01-31
-- Description: Changes weekly_visits column to profile_visits in legi_index table.
--              This changes from weekly reset tracking to cumulative total views.
--              The 'week' column is no longer needed for legislation profiles.

-- Rename weekly_visits to profile_visits if weekly_visits exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'legi_index' AND column_name = 'weekly_visits'
  ) THEN
    ALTER TABLE legi_index RENAME COLUMN weekly_visits TO profile_visits;
    COMMENT ON COLUMN legi_index.profile_visits IS 'Total number of times this legislation profile has been viewed (cumulative, never resets)';
  END IF;
END $$;

-- Drop the 'week' column if it exists (no longer needed for legislation)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'legi_index' AND column_name = 'week'
  ) THEN
    ALTER TABLE legi_index DROP COLUMN week;
  END IF;
END $$;

