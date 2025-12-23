-- Add subscription tracking columns to users table
-- sub_logs: text field to store subscription event logs
-- last_transaction_id: track Apple transaction IDs for webhook mapping

-- Add sub_logs column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'sub_logs'
  ) THEN
    ALTER TABLE users ADD COLUMN sub_logs TEXT;
    COMMENT ON COLUMN users.sub_logs IS 'Log of subscription events and changes';
  END IF;
END $$;

-- Add last_transaction_id column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'last_transaction_id'
  ) THEN
    ALTER TABLE users ADD COLUMN last_transaction_id TEXT;
    COMMENT ON COLUMN users.last_transaction_id IS 'Apple original transaction ID for subscription mapping';
  END IF;
END $$;

-- Add index on last_transaction_id for faster webhook lookups
CREATE INDEX IF NOT EXISTS idx_users_last_transaction_id 
ON users(last_transaction_id) 
WHERE last_transaction_id IS NOT NULL;

-- Add plus_til column if it doesn't exist (scheduled downgrade date)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'plus_til'
  ) THEN
    ALTER TABLE users ADD COLUMN plus_til TIMESTAMPTZ;
    COMMENT ON COLUMN users.plus_til IS 'Date when Plus subscription expires (scheduled downgrade)';
  END IF;
END $$;


