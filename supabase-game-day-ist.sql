-- ============================================================
-- Game day is now an IST calendar day (see lib/date.ts).
-- Move the daily reset from 00:00 UTC (05:30 IST) to 00:00 IST.
-- Run in the Supabase SQL editor. ALTER the existing job; do not add a second one.
--
-- Rollout: deploy the app + `supabase functions deploy daily-reset` between
-- ~06:00 and ~23:30 IST. In that window the UTC date and the IST date are
-- identical, so existing quest/streak/cycle dates stay valid. Avoid deploying
-- between 00:00 and 05:30 IST, when the two dates differ.
-- ============================================================

select cron.alter_job(
  job_id   := (select jobid from cron.job where jobname = 'ascend-daily-reset'),
  schedule := '30 18 * * *'
);

-- Verify
select jobname, schedule from cron.job where jobname = 'ascend-daily-reset';
