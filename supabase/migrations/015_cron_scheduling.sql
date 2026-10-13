-- ============================================================
-- Schedule the DebiCheck background jobs that previously existed only as
-- deployed Edge Functions with nothing ever actually calling them:
--   - nupay-status-poll          (every 15 min — see supabase/functions/nupay-status-poll)
--   - debicheck-reminder         (every 30 min — see supabase/functions/debicheck-reminder)
--   - nupay-reconcile-instalments (daily 06:00 UTC — see supabase/functions/nupay-reconcile-instalments)
--
-- All three are deployed with --no-verify-jwt specifically so this can call
-- them with no Authorization header at all. There is no Postgres setting
-- that holds the project's service_role key by default (the commonly
-- copy-pasted `current_setting('app.settings.service_role_key')` pattern
-- assumes you've manually run `ALTER DATABASE ... SET app.settings...`
-- with the real secret value first) — rather than require that extra,
-- easy-to-get-wrong manual step, these jobs are unauthenticated at the
-- gateway level and rely on their own internal logic being safe to call
-- repeatedly/publicly (idempotent, no destructive or user-suppliable
-- params).
--
-- Run this in: Supabase Dashboard → SQL Editor
-- Replace the project URL below if restoring this on a different project.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT cron.schedule(
  'nupay-status-poll',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://wmpfweskrnliqwkqkpoq.supabase.co/functions/v1/nupay-status-poll',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'debicheck-reminder',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://wmpfweskrnliqwkqkpoq.supabase.co/functions/v1/debicheck-reminder',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'nupay-reconcile-instalments',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://wmpfweskrnliqwkqkpoq.supabase.co/functions/v1/nupay-reconcile-instalments',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
  $$
);
