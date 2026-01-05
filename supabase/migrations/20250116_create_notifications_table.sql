-- Migration: Create notifications table
-- Date: 2025-01-16
-- Description: Creates table to store notifications for subscribed users

CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id TEXT NOT NULL, -- Format: "ppl123" or "legi123"
  profile_name TEXT NOT NULL,
  is_ppl BOOLEAN NOT NULL, -- true for politician, false for legislation
  message TEXT NOT NULL,
  categories TEXT[], -- Array of category display names
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read BOOLEAN NOT NULL DEFAULT FALSE
);

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);

-- Create index on created_at for sorting and cleanup
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

-- Create index on profile_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_notifications_profile_id ON notifications(profile_id);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Create policy: Users can only see their own notifications
CREATE POLICY "Users can view own notifications"
  ON notifications
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create policy: Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
  ON notifications
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Add comment
COMMENT ON TABLE notifications IS 'Stores notifications for users when new cards are generated for subscribed profiles';

