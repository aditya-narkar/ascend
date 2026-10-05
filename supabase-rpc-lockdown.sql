-- ============================================================
-- Lock down SECURITY DEFINER RPCs.
-- These take a caller-supplied p_user_id, so exposing them to
-- anon/authenticated lets any signed-in user change another
-- user's stats (or their own by any amount).
-- Only the service role (server actions via createAdminClient,
-- and the Supabase edge functions) may call them.
--
-- Deploy the app change FIRST, then run this in the SQL editor.
-- ============================================================

alter function public.increment_stat(uuid, text, integer)            set search_path = public;
alter function public.decrement_stat(uuid, text, integer)            set search_path = public;
alter function public.apply_all_stat_penalty(uuid, integer)          set search_path = public;
alter function public.increment_cycle_completions(uuid, integer)     set search_path = public;

revoke execute on function public.increment_stat(uuid, text, integer)        from public, anon, authenticated;
revoke execute on function public.decrement_stat(uuid, text, integer)        from public, anon, authenticated;
revoke execute on function public.apply_all_stat_penalty(uuid, integer)      from public, anon, authenticated;
revoke execute on function public.increment_cycle_completions(uuid, integer) from public, anon, authenticated;

grant execute on function public.increment_stat(uuid, text, integer)        to service_role;
grant execute on function public.decrement_stat(uuid, text, integer)        to service_role;
grant execute on function public.apply_all_stat_penalty(uuid, integer)      to service_role;
grant execute on function public.increment_cycle_completions(uuid, integer) to service_role;
