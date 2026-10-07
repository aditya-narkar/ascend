-- ============================================================
-- Streak shield + cycle-day columns on public.users.
-- Required by updateStreak() (lib/streakShield.ts, supabase/functions/daily-reset) and the
-- StreakCard. Without these columns the day-boundary update fails as a whole, so
-- current_streak / best_streak / last_active_date never advance.
--
-- Run in the Supabase SQL Editor. Safe to re-run.
-- ============================================================

alter table public.users
  add column if not exists streak_shield_active   boolean not null default false,
  add column if not exists streak_shield_used_date date,
  add column if not exists last_shield_earned_date date,
  add column if not exists cycle_days_completed   integer not null default 0,
  add column if not exists pending_system_message text;

-- Verify: should list all five columns.
select column_name, data_type, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'users'
  and column_name in ('streak_shield_active', 'streak_shield_used_date', 'last_shield_earned_date',
                      'cycle_days_completed', 'pending_system_message')
order by column_name;
