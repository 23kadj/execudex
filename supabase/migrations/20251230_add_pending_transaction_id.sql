-- Add pending_transaction_id column to users table
-- This allows storing transaction IDs temporarily until Apple confirms via webhook

ALTER TABLE users ADD COLUMN pending_transaction_id TEXT;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_users_pending_transaction_id ON users(pending_transaction_id);

-- Add comment
COMMENT ON COLUMN users.pending_transaction_id IS 'Temporary transaction ID storage until Apple webhook confirmation';
