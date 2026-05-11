-- ============================================================
-- Run in Supabase SQL Editor AFTER supabase-selections-schema.sql
-- ============================================================

create or replace function public.increment_cycle_completions(
  p_user_id uuid,
  p_cycle_number integer
)
returns void
language plpgsql
security definer
as $$
begin
  update public.cycles
  set total_completions = total_completions + 1
  where user_id = p_user_id and cycle_number = p_cycle_number;
end;
$$;
