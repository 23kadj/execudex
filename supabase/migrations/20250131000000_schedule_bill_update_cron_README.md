# Bill Update Scheduled Cron Job

This migration sets up an automatic schedule for the `bill_update` edge function to run every 7 days.

## What It Does

- Creates a database function `call_bill_update()` that makes an HTTP POST request to the bill_update edge function
- Schedules it to run automatically every Sunday at midnight UTC (every 7 days)
- Uses pg_cron and pg_net extensions to handle the scheduling and HTTP requests

## Installation

Run this migration in your Supabase project:

```bash
# Apply the migration
supabase db push
```

Or manually run the SQL in the Supabase SQL Editor.

## Configuration

### Change the Schedule

To change when it runs, modify the cron expression in the migration:

- `'0 0 * * 0'` - Every Sunday at midnight UTC (current)
- `'0 0 * * 1'` - Every Monday at midnight UTC
- `'0 2 * * 0'` - Every Sunday at 2 AM UTC
- `'0 12 * * 3'` - Every Wednesday at noon UTC

Cron format: `minute hour day-of-month month day-of-week`

### Update the API Key

If your anon key changes, update it in the `call_bill_update()` function in the migration file.

## Verification

Check if the cron job is scheduled:

```sql
SELECT * FROM cron.job WHERE jobname = 'bill-update-weekly';
```

View cron job history:

```sql
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'bill-update-weekly')
ORDER BY start_time DESC
LIMIT 10;
```

## Manual Execution

To manually trigger the job (for testing):

```sql
SELECT call_bill_update();
```

## Removing the Schedule

To remove the scheduled job:

```sql
SELECT cron.unschedule('bill-update-weekly');
```

## Notes

- The function uses the anon key for authentication (the same key from your curl command)
- The job runs server-side, so it doesn't require your client app to be running
- UTC time is used - adjust the cron expression if you need a different timezone
- Logs will appear in the Supabase function logs for bill_update
