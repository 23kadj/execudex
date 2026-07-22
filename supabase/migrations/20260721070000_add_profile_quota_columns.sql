-- Migration: Add profile quota tracking columns to users table
-- Date: 2025-10-09 (renamed with a timestamp prefix 2026-07-21)
-- Description: Adds columns to track weekly profile access for subscription quota management
--
-- Renamed from add_profile_quota_columns.sql. Without a leading timestamp the
-- Supabase CLI skipped this file on every single push and reset -- it printed
-- "file name must match pattern <timestamp>_name.sql" and moved on -- so it had
-- never actually run anywhere. The timestamp is the rename date rather than the
-- original 2025-10-09 authoring date, so that it applies in order after the
-- migrations already recorded remotely instead of needing --include-all.
--
-- The column additions below are no-ops in practice: the baseline schema dump
-- (20250101000000, lines 441-445) was taken from the remote project after these
-- columns already existed there, so it already creates plan, week_profiles and
-- last_reset. Every statement here is IF NOT EXISTS, so re-running is safe.
--
-- The one piece of this file that was genuinely never applied anywhere is
-- idx_users_plan: it is absent from the baseline dump, from a freshly reset
-- local stack, and therefore from production.

-- Add columns for profile quota tracking
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS week_profiles text DEFAULT '',
ADD COLUMN IF NOT EXISTS last_reset timestamptz DEFAULT NULL,
ADD COLUMN IF NOT EXISTS plan text DEFAULT 'basic';

-- Create an index on plan column for faster queries
CREATE INDEX IF NOT EXISTS idx_users_plan ON users(plan);

-- Add comment to document the columns
COMMENT ON COLUMN users.week_profiles IS 'Comma-separated string with profile IDs (format: "123ppl,329ppl,11legi") accessed by user in current week';
COMMENT ON COLUMN users.last_reset IS 'Timestamp of last weekly reset (Sunday)';
COMMENT ON COLUMN users.plan IS 'User subscription plan: "basic" (10 profiles/week) or other (unlimited)';

