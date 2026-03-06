-- Auto-indexing: run every 3 minutes, but only call the worker when there are pending jobs.
-- This avoids unnecessary HTTP calls when there are no new chunks to process.

-- 1. Replace the trigger function to check for pending jobs before calling the worker
CREATE OR REPLACE FUNCTION trigger_indexing_worker_http()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  worker_url TEXT;
  cron_secret TEXT;
  request_id BIGINT;
  has_pending BOOLEAN;
BEGIN
  -- Only trigger when there is at least one pending indexing job (new chunks to process)
  SELECT EXISTS (
    SELECT 1 FROM public.indexing_jobs WHERE status = 'pending' LIMIT 1
  ) INTO has_pending;

  IF NOT has_pending THEN
    RAISE NOTICE 'No pending indexing jobs; skipping worker trigger.';
    RETURN;
  END IF;

  -- Get configuration from app_settings
  SELECT value INTO worker_url
  FROM app_settings
  WHERE key = 'indexing_worker_url'
  LIMIT 1;

  SELECT value INTO cron_secret
  FROM app_settings
  WHERE key = 'cron_secret'
  LIMIT 1;

  IF worker_url IS NULL OR worker_url = '' THEN
    worker_url := 'https://your-app-domain.com/api/internal/indexing/worker';
    RAISE WARNING 'Worker URL not configured. Using fallback. Set indexing_worker_url in app_settings table.';
  END IF;

  SELECT INTO request_id
    net.http_post(
      url := worker_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || COALESCE(cron_secret, '')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );

  RAISE NOTICE 'Triggered indexing worker (pending jobs found). Request ID: %', request_id;

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to trigger indexing worker: %', SQLERRM;
END;
$$;

COMMENT ON FUNCTION trigger_indexing_worker_http() IS 'Triggers the indexing worker via HTTP only when indexing_jobs has pending rows. Called by pg_cron every 3 minutes.';

-- 2. Reschedule cron to run every 3 minutes (was every 1 minute)
SELECT cron.unschedule('trigger-indexing-worker');
SELECT cron.schedule(
  'trigger-indexing-worker',
  '*/3 * * * *',
  'SELECT trigger_indexing_worker_http();'
);
