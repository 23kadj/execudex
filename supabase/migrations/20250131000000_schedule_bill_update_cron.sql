-- Schedule bill_update edge function to run automatically every 7 days
-- This uses pg_cron to schedule HTTP calls to the edge function via pg_net

-- Enable required extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create a function to call the bill_update edge function
-- Using anon key (from your curl command: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...)
CREATE OR REPLACE FUNCTION call_bill_update()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  supabase_url TEXT := 'https://tvvmkzoiicjrfjbmqzwc.supabase.co';
  function_url TEXT := supabase_url || '/functions/v1/bill_update';
  anon_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2dm1rem9paWNqcmZqYm1xendjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxMDY0OTUsImV4cCI6MjA2OTY4MjQ5NX0.ZlVa4YsMZVrnvSmkJ7wKBiilQ84jh_qcN1wLl7E-Kso';
  response_id BIGINT;
BEGIN
  -- Use pg_net to make HTTP POST request to the edge function
  SELECT net.http_post(
    url := function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anon_key
    ),
    body := '{}'::jsonb
  ) INTO response_id;
  
  RAISE NOTICE 'Scheduled bill_update function call initiated at %. Response ID: %', now(), response_id;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to call bill_update function: %', SQLERRM;
END;
$$;

-- Remove existing job if it exists (to allow re-running this migration)
SELECT cron.unschedule('bill-update-weekly') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'bill-update-weekly'
);

-- Schedule the job to run every 7 days (every Sunday at midnight UTC)
-- Cron syntax: '0 0 * * 0' = Sunday at 00:00 UTC
-- To change the day/time, modify the cron expression:
-- '0 0 * * 1' = Monday at 00:00 UTC
-- '0 2 * * 0' = Sunday at 02:00 UTC (2 AM)
SELECT cron.schedule(
  'bill-update-weekly',           -- Job name
  '0 0 * * 0',                    -- Run every Sunday at midnight UTC (every 7 days)
  $$SELECT call_bill_update()$$   -- SQL to execute
);

COMMENT ON FUNCTION call_bill_update() IS 'Calls the bill_update edge function to process new legislation from congress.gov. Scheduled to run every 7 days via pg_cron.';

