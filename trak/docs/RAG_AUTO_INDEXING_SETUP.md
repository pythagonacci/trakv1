# RAG auto-indexing setup (every 3 minutes, only when there’s work)

This guide walks you through enabling automatic RAG indexing so you don’t have to visit **dashboard/search-test** to trigger the worker manually.

---

## How it works

- **pg_cron** (inside Supabase) runs every **3 minutes**.
- Each run calls **`trigger_indexing_worker_http()`**, which:
  1. Checks if there are any **pending** rows in `indexing_jobs`.
  2. If **no** pending jobs → does nothing (no HTTP call).
  3. If **there are** pending jobs → sends an HTTP POST to your app’s worker with a secret token; the worker then processes up to 10 jobs.

So indexing runs at most every 3 minutes, and only when there are new chunks to process.

---

## What you need to do

### 1. Run the migration

Apply the migration that updates the trigger and reschedules the cron.

**Option A – Supabase CLI (if you use it)**

From the repo root (or from `trak/` if your config is there):

```bash
cd trak
npx supabase db push
```

Or, to run only the new migration against a remote DB:

```bash
npx supabase migration up
```

**Option B – Supabase Dashboard (SQL Editor)**

1. Open your project: [Supabase Dashboard](https://supabase.com/dashboard) → your project.
2. Go to **SQL Editor**.
3. Open the migration file:
   `trak/supabase/migrations/20260305120000_indexing_cron_every_3min_only_when_pending.sql`
4. Copy its entire contents, paste into the SQL Editor, and click **Run**.

---

### 2. Enable required extensions

The cron trigger uses **pg_cron** (schedule) and **pg_net** (HTTP from the DB).

1. In Supabase Dashboard go to **Database** → **Extensions**.
2. Enable:
   - **pg_cron**
   - **pg_net** (often listed as “Supabase Edge Functions” or “HTTP” – it’s the one that provides `net.http_post`).

If `pg_net` is not available in the list, check Supabase docs for your plan; some setups use “Database Webhooks” or a different way to send HTTP from the DB.

---

### 3. Configure `app_settings` in the database

The trigger reads two values from the **`app_settings`** table. Set them with real values.

**3a. Worker URL**

This must be the full URL of your deployed app’s indexing worker (no trailing slash). Use whatever domain you host the app on.

Examples:

- `https://twodapp.com/api/internal/indexing/worker`
- `https://your-domain.com/api/internal/indexing/worker`

Run in SQL Editor (replace with your app’s base URL):

```sql
UPDATE app_settings
SET value = 'https://YOUR-DOMAIN.com/api/internal/indexing/worker'
WHERE key = 'indexing_worker_url';

-- If the row doesn't exist yet:
INSERT INTO app_settings (key, value, description)
VALUES (
  'indexing_worker_url',
  'https://YOUR-DOMAIN.com/api/internal/indexing/worker',
  'URL of the indexing worker endpoint'
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

**3b. Cron secret**

Choose a long, random secret (e.g. 32+ characters). It must be the **same** value in:

- The database (`app_settings.cron_secret`), and  
- Your app’s environment variable **`CRON_SECRET`** (so the worker can accept the request).

Run in SQL Editor (replace with your secret):

```sql
UPDATE app_settings
SET value = 'your-long-random-secret-at-least-32-chars'
WHERE key = 'cron_secret';

-- If the row doesn't exist yet:
INSERT INTO app_settings (key, value, description)
VALUES (
  'cron_secret',
  'your-long-random-secret-at-least-32-chars',
  'Secret token for authenticating cron jobs'
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

**Important:** Use the same secret in your app’s environment variables (see step 4).

---

### 4. Set `CRON_SECRET` in your app environment

Your Next.js app must have **`CRON_SECRET`** set to the same value as `app_settings.cron_secret`, so the worker can accept the cron request.

- **Production:** Set **CRON_SECRET** in your host’s environment/config (e.g. Railway, Render, your server’s env, Docker, etc.) to the same value you stored in `app_settings.cron_secret`.
- **Local:** In `trak/.env.local` add:
  ```env
  CRON_SECRET=your-long-random-secret-at-least-32-chars
  ```
  (Use the same value as in the DB when testing cron from Supabase to your app.)

Redeploy or restart the app after changing env vars so the worker sees the new `CRON_SECRET`.

---

### 5. Verify the cron job

In Supabase SQL Editor:

```sql
-- List scheduled jobs (should include trigger-indexing-worker)
SELECT * FROM cron.job;

-- Optional: recent runs
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
```

You should see a job named **`trigger-indexing-worker`** with schedule **`*/3 * * * *`** (every 3 minutes).

---

### 6. Optional: verify `app_settings`

```sql
SELECT key, value, description FROM app_settings
WHERE key IN ('indexing_worker_url', 'cron_secret');
```

- `indexing_worker_url` should be your full worker URL.
- `cron_secret` should be set (value will be visible here; keep the table restricted in production).

---

## Summary checklist

- [ ] Migration applied (SQL Editor or `supabase db push` / `migration up`).
- [ ] **pg_cron** and **pg_net** enabled in Supabase (Database → Extensions).
- [ ] **`app_settings.indexing_worker_url`** = full worker URL (e.g. `https://.../api/internal/indexing/worker`).
- [ ] **`app_settings.cron_secret`** = a strong secret.
- [ ] **`CRON_SECRET`** in app env (your host’s env or .env.local) = same value as `cron_secret` in DB.
- [ ] App redeployed or restarted after env changes.
- [ ] Optional: confirmed `cron.job` shows `trigger-indexing-worker` with `*/3 * * * *`.

After this, indexing will run automatically every 3 minutes when there are pending jobs. You can still use **dashboard/search-test** to trigger the worker manually in development (with **x-manual-trigger**); in production, only requests with the correct **CRON_SECRET** are accepted.
