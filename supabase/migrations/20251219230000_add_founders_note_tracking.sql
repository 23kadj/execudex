-- Migration: Add founder's note tracking to users table
-- Date: 2025-12-19
-- Description: Adds column to track if user has seen the founder's note (once per account)

-- Add column to track if founder's note has been shown
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS has_seen_founders_note boolean DEFAULT false;

-- Add comment to document the column
COMMENT ON COLUMN users.has_seen_founders_note IS 'Tracks if user has seen the founder''s note (once per account, persists across devices)';

-- Create an index for faster queries (optional, but helpful for queries)
CREATE INDEX IF NOT EXISTS idx_users_founders_note ON users(has_seen_founders_note);

