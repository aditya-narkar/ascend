-- ============================================================
-- Lock down SECURITY DEFINER RPCs.
-- These take a caller-supplied p_user_id, so exposing them to
-- anon/authenticated lets any signed-in user change another
-- user's stats (or their own by any amount).
-- Only the service role (server actions via createAdminClient,
-- and the Supabase edge functions) may call them.
--
-- Deploy the app change FIRST, then run this in the SQL editor.
-- Safe to re-run: every function is create-or-replace.
-- ============================================================

-- 1. Make sure the functions exist.
--    decrement_stat / apply_all_stat_penalty normally come from supabase-penalty-system.sql and
--    increment_cycle_completions from supabase-rpc-cycle.sql; if those were never applied the
--    revoke below fails with "function ... does not exist". Replacing an existing one is a no-op.

create or replace function public.decrement_stat(
  p_user_id uuid,
  p_stat    text,
  p_amount  integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_stat not in ('strength', 'focus', 'discipline', 'confidence', 'intelligence', 'purpose', 'energy') then
    return;
  end if;
  execute format('update public.stats set %I = greatest(0, %I - $1), updated_at = now() where user_id = $2', p_stat, p_stat)
    using p_amount, p_user_id;
end;
$$;

create or replace function public.apply_all_stat_penalty(
  p_user_id uuid,
  p_amount  integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.stats set
    strength     = greatest(0, strength     - p_amount),
    focus        = greatest(0, focus        - p_amount),
    discipline   = greatest(0, discipline   - p_amount),
    confidence   = greatest(0, confidence   - p_amount),
    intelligence = greatest(0, intelligence - p_amount),
    purpose      = greatest(0, purpose      - p_amount),
    energy       = greatest(0, energy       - p_amount),
    updated_at   = now()
  where user_id = p_user_id;
end;
$$;

create or replace function public.increment_cycle_completions(
  p_user_id      uuid,
  p_cycle_number integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.cycles
  set total_completions = total_completions + 1
  where user_id = p_user_id and cycle_number = p_cycle_number;
end;
$$;

-- increment_stat comes from the base schema (supabase-schema.sql); only pin its search_path.
alter function public.increment_stat(uuid, text, integer) set search_path = public;

-- 2. Service role only.

revoke execute on function public.increment_stat(uuid, text, integer)        from public, anon, authenticated;
revoke execute on function public.decrement_stat(uuid, text, integer)        from public, anon, authenticated;
revoke execute on function public.apply_all_stat_penalty(uuid, integer)      from public, anon, authenticated;
revoke execute on function public.increment_cycle_completions(uuid, integer) from public, anon, authenticated;

grant execute on function public.increment_stat(uuid, text, integer)        to service_role;
grant execute on function public.decrement_stat(uuid, text, integer)        to service_role;
grant execute on function public.apply_all_stat_penalty(uuid, integer)      to service_role;
grant execute on function public.increment_cycle_completions(uuid, integer) to service_role;
