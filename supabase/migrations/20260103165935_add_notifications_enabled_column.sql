-- Migration: Add notifications_enabled column to users table
-- Date: 2026-01-03
-- Description: Adds a column to track whether users have notifications enabled in-app

-- Add notifications_enabled column (defaults to true for existing users)
ALTER TABLE users ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN DEFAULT true NOT NULL;

-- Add comment
COMMENT ON COLUMN users.notifications_enabled IS 'Whether the user has enabled notifications in-app (independent of device permission status)';

