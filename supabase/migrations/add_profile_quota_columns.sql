-- Migration: Add profile quota tracking columns to users table
-- Date: 2025-10-09
-- Description: Adds columns to track weekly profile access for subscription quota management

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

