-- Give the weekly bill_update cron job visible, queryable run history instead of
-- a fire-and-forget pg_net call whose outcome was only ever visible in function logs.
-- Also removes the temporary debug_cron_status() introspection helper used to
-- confirm the existing cron job was actually firing (it was — this replaces that
-- one-off check with permanent logging).

DROP FUNCTION IF EXISTS public.debug_cron_status();

CREATE TABLE IF NOT EXISTS bill_update_runs (
  id BIGSERIAL PRIMARY KEY,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'triggered', -- triggered | success | error
  summary JSONB,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_bill_update_runs_triggered_at ON bill_update_runs(triggered_at);

COMMENT ON TABLE bill_update_runs IS 'One row per bill_update invocation (cron or manual). A row stuck at status=triggered past its expected runtime means the edge function never completed — the failure that was previously invisible.';

ALTER TABLE bill_update_runs ENABLE ROW LEVEL SECURITY;
-- No policies: only service_role (which bypasses RLS) reads/writes this table.

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
  new_run_id BIGINT;
BEGIN
  INSERT INTO bill_update_runs (status) VALUES ('triggered') RETURNING id INTO new_run_id;

  SELECT net.http_post(
    url := function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anon_key
    ),
    body := jsonb_build_object('run_id', new_run_id)
  ) INTO response_id;

  RAISE NOTICE 'Scheduled bill_update function call initiated at %. run_id: %, pg_net request id: %', now(), new_run_id, response_id;
EXCEPTION
  WHEN OTHERS THEN
    UPDATE bill_update_runs SET status = 'error', error = SQLERRM, finished_at = now() WHERE id = new_run_id;
    RAISE WARNING 'Failed to call bill_update function: %', SQLERRM;
END;
$$;

-- Re-register the job (idempotent) so the updated call_bill_update() body takes effect.
SELECT cron.unschedule('bill-update-weekly') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'bill-update-weekly'
);

SELECT cron.schedule(
  'bill-update-weekly',
  '0 0 * * 0',
  $$SELECT call_bill_update()$$
);

COMMENT ON FUNCTION call_bill_update() IS 'Calls the bill_update edge function to process new legislation from congress.gov, logging each invocation to bill_update_runs. Scheduled to run every 7 days via pg_cron.';
