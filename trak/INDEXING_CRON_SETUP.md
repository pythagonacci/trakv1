# Automated Indexing Worker Setup (Supabase)

This guide explains how to set up automated periodic indexing for your RAG search system using Supabase pg_cron.

## Overview

The indexing system has three components:
1. **Job Queue**: `indexing_jobs` table stores pending work
2. **Worker API**: `/api/internal/indexing/worker` processes jobs
3. **Cron Scheduler**: Triggers the worker periodically

## Setup Instructions

### 1. Enable Required Extensions in Supabase

In your Supabase dashboard:

1. Go to **Database** → **Extensions**
2. Enable the following extensions:
   - `pg_cron` - For scheduling
   - `pg_net` - For making HTTP requests (under "http" in the extensions list)

### 2. Run the Migration

Apply the migration to set up the cron job:

```bash
cd trak
npx supabase db push
```

Or if you're using Supabase CLI migrations:
```bash
npx supabase migration up
```

This will:
- Create an `app_settings` table for configuration
- Create a function `trigger_indexing_worker_http()` that calls your worker endpoint
- Schedule a cron job to run every minute

### 3. Configure the Worker URL

Update the worker URL in the `app_settings` table with your actual deployment URL:

```sql
UPDATE app_settings
SET value = 'https://your-actual-deployment.vercel.app/api/internal/indexing/worker'
WHERE key = 'indexing_worker_url';
```

### 4. Set Up Authentication (Optional but Recommended)

For production security:

1. Generate a secret token:
   ```bash
   openssl rand -base64 32
   ```

2. Update the secret in Supabase:
   ```sql
   UPDATE app_settings
   SET value = 'your-generated-secret-here'
   WHERE key = 'cron_secret';
   ```

3. Add the same secret to your Vercel environment variables:
   ```
   CRON_SECRET=your-generated-secret-here
   ```

### 5. Verify Setup

1. Check that the cron job is scheduled:
   ```sql
   SELECT * FROM cron.job;
   ```

2. Wait a minute and check the run history:
   ```sql
   SELECT *
   FROM cron.job_run_details
   WHERE jobname = 'trigger-indexing-worker'
   ORDER BY start_time DESC
   LIMIT 10;
   ```

3. Monitor your indexing queue status in the search-test dashboard or via:
   ```sql
   SELECT status, COUNT(*)
   FROM indexing_jobs
   GROUP BY status;
   ```

## Managing the Cron Job

### View All Cron Jobs
```sql
SELECT * FROM cron.job;
```

### View Recent Run History
```sql
SELECT jobname, status, start_time, end_time, return_message
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 20;
```

### Change Schedule Frequency

**Every 5 minutes:**
```sql
SELECT cron.unschedule('trigger-indexing-worker');
SELECT cron.schedule('trigger-indexing-worker', '*/5 * * * *', 'SELECT trigger_indexing_worker_http();');
```

**Every 15 minutes:**
```sql
SELECT cron.unschedule('trigger-indexing-worker');
SELECT cron.schedule('trigger-indexing-worker', '*/15 * * * *', 'SELECT trigger_indexing_worker_http();');
```

**Every hour:**
```sql
SELECT cron.unschedule('trigger-indexing-worker');
SELECT cron.schedule('trigger-indexing-worker', '0 * * * *', 'SELECT trigger_indexing_worker_http();');
```

### Pause the Cron Job
```sql
SELECT cron.unschedule('trigger-indexing-worker');
```

### Resume the Cron Job
```sql
SELECT cron.schedule('trigger-indexing-worker', '* * * * *', 'SELECT trigger_indexing_worker_http();');
```

## Cron Schedule Syntax

The schedule uses standard cron syntax: `minute hour day month weekday`

- `* * * * *` - Every minute
- `*/5 * * * *` - Every 5 minutes
- `0 * * * *` - Every hour
- `0 */6 * * *` - Every 6 hours
- `0 0 * * *` - Daily at midnight
- `0 9 * * 1` - Every Monday at 9 AM

## Troubleshooting

### Cron job not running

1. Verify extensions are enabled:
   ```sql
   SELECT * FROM pg_available_extensions WHERE name IN ('pg_cron', 'pg_net');
   ```

2. Check for errors in run history:
   ```sql
   SELECT * FROM cron.job_run_details WHERE status = 'failed' ORDER BY start_time DESC;
   ```

3. Manually test the trigger function:
   ```sql
   SELECT trigger_indexing_worker_http();
   ```

### HTTP requests failing

1. Verify the worker URL is correct:
   ```sql
   SELECT * FROM app_settings WHERE key = 'indexing_worker_url';
   ```

2. Test the endpoint manually:
   ```bash
   curl -X POST https://your-url.vercel.app/api/internal/indexing/worker \
     -H "x-manual-trigger: true"
   ```

3. Check pg_net request logs:
   ```sql
   SELECT * FROM net.http_request_queue ORDER BY id DESC LIMIT 10;
   ```

### Jobs stuck in "processing" state

If jobs get stuck (e.g., worker crashed mid-processing):

```sql
-- Reset stuck jobs back to pending
UPDATE indexing_jobs
SET status = 'pending', updated_at = NOW()
WHERE status = 'processing'
  AND updated_at < NOW() - INTERVAL '10 minutes';
```

## Migration Files

The setup uses three migration files (use the one that best fits your needs):

1. **`20260206130000_setup_indexing_cron.sql`** - Basic HTTP-based trigger with env vars
2. **`20260206130100_setup_indexing_cron_simple.sql`** - Database-only approach (requires porting indexing logic to PL/pgSQL)
3. **`20260206130200_setup_indexing_cron_http.sql`** - **RECOMMENDED**: Production-ready with app_settings table

If you applied multiple migrations, you may want to clean up:

```sql
-- Remove old cron jobs
SELECT cron.unschedule('process-indexing-queue');
SELECT cron.unschedule('process-indexing-queue-simple');

-- Keep only the recommended one
SELECT * FROM cron.job WHERE jobname = 'trigger-indexing-worker';
```

## Performance Tuning

- **High volume**: Increase worker batch size (currently 10 jobs per run) in the worker API
- **Low volume**: Reduce cron frequency to every 5-15 minutes to save resources
- **Mixed workload**: Keep at 1 minute but add logic to skip runs if queue is empty

## Next Steps

1. Monitor the indexing queue in your search-test dashboard
2. Adjust the cron frequency based on your typical queue size
3. Set up alerting if jobs start failing consistently
4. Consider adding metrics/logging for worker performance
