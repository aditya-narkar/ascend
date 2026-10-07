-- Read-only check: which pieces of the schema are present in your Supabase project?
-- Run in the SQL Editor. Every column should be true; a false means that migration was never applied.

select
  to_regclass('public.quest_pools')        is not null as quest_pools,
  to_regclass('public.quest_selections')   is not null as quest_selections,
  to_regclass('public.cycles')             is not null as cycles,
  to_regclass('public.daily_summary')      is not null as daily_summary,
  to_regclass('public.penalty_quests')     is not null as penalty_quests,
  to_regclass('public.penalty_history')    is not null as penalty_history,
  to_regclass('public.push_subscriptions') is not null as push_subscriptions,
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'users' and column_name = 'penalty_tier')          as users_penalty_columns,
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'users' and column_name = 'streak_shield_active') as users_shield_columns,
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'push_subscriptions' and column_name = 'endpoint') as push_multi_device,
  exists (select 1 from pg_proc where proname = 'increment_stat')             as fn_increment_stat,
  exists (select 1 from pg_proc where proname = 'decrement_stat')             as fn_decrement_stat,
  exists (select 1 from pg_proc where proname = 'apply_all_stat_penalty')     as fn_apply_all_stat_penalty,
  exists (select 1 from pg_proc where proname = 'increment_cycle_completions') as fn_increment_cycle_completions;
