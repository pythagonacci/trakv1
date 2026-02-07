-- Production-ready approach: Use pg_cron + pg_net to call worker HTTP endpoint
-- This is the recommended approach for Next.js apps

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
-- Note: pg_net (supabase_functions.http_post) should be enabled via Supabase dashboard

-- Create a function to trigger the indexing worker via HTTP
CREATE OR REPLACE FUNCTION trigger_indexing_worker_http()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  worker_url TEXT;
  cron_secret TEXT;
  request_id BIGINT;
BEGIN
  -- Get configuration from a settings table
  SELECT value INTO worker_url
  FROM app_settings
  WHERE key = 'indexing_worker_url'
  LIMIT 1;

  SELECT value INTO cron_secret
  FROM app_settings
  WHERE key = 'cron_secret'
  LIMIT 1;

  -- Fallback to environment variable or hardcoded value if not in settings
  IF worker_url IS NULL OR worker_url = '' THEN
    -- You should set this via INSERT into app_settings or use a vault secret
    worker_url := 'https://your-deployment-url.vercel.app/api/internal/indexing/worker';
    RAISE WARNING 'Worker URL not configured. Using fallback. Set indexing_worker_url in app_settings table.';
  END IF;

  -- Make async HTTP POST request using Supabase's pg_net
  SELECT INTO request_id
    net.http_post(
      url := worker_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || COALESCE(cron_secret, '')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000  -- 30 second timeout
    );

  -- Log the request (optional)
  RAISE NOTICE 'Triggered indexing worker. Request ID: %', request_id;

EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the cron job
    RAISE WARNING 'Failed to trigger indexing worker: %', SQLERRM;
END;
$$;

-- Create app_settings table to store configuration
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default configuration (update these values!)
INSERT INTO app_settings (key, value, description) VALUES
  ('indexing_worker_url', 'https://your-deployment.vercel.app/api/internal/indexing/worker', 'URL of the indexing worker endpoint'),
  ('cron_secret', '', 'Secret token for authenticating cron jobs (set this!)')
ON CONFLICT (key) DO NOTHING;

-- Schedule the cron job to run every minute
SELECT cron.schedule(
  'trigger-indexing-worker',
  '* * * * *',  -- every minute (adjust as needed: */5 for every 5 minutes, etc.)
  'SELECT trigger_indexing_worker_http();'
);

-- Helpful queries for managing the cron job:

-- View all cron jobs:
-- SELECT * FROM cron.job;

-- View cron job run history:
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;

-- Update the schedule (e.g., change to every 5 minutes):
-- SELECT cron.unschedule('trigger-indexing-worker');
-- SELECT cron.schedule('trigger-indexing-worker', '*/5 * * * *', 'SELECT trigger_indexing_worker_http();');

-- Disable the cron job:
-- SELECT cron.unschedule('trigger-indexing-worker');

-- Re-enable the cron job:
-- SELECT cron.schedule('trigger-indexing-worker', '* * * * *', 'SELECT trigger_indexing_worker_http();');

-- Update worker URL:
-- UPDATE app_settings SET value = 'https://your-new-url.vercel.app/api/internal/indexing/worker' WHERE key = 'indexing_worker_url';

-- Update cron secret:
-- UPDATE app_settings SET value = 'your-secret-here' WHERE key = 'cron_secret';

COMMENT ON TABLE app_settings IS 'Application-wide settings including URLs and secrets for cron jobs';
COMMENT ON FUNCTION trigger_indexing_worker_http() IS 'Triggers the indexing worker via HTTP. Called by pg_cron.';
