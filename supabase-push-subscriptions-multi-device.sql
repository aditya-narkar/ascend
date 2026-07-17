-- Allow one user to receive Web Push notifications on multiple devices.
-- Run this once in Supabase SQL editor before relying on multi-device sends.

alter table public.push_subscriptions
  add column if not exists id uuid default gen_random_uuid();

alter table public.push_subscriptions
  add column if not exists endpoint text;

alter table public.push_subscriptions
  add column if not exists updated_at timestamptz default now();

update public.push_subscriptions
set
  endpoint = subscription->>'endpoint',
  updated_at = coalesce(updated_at, now())
where endpoint is null;

delete from public.push_subscriptions
where endpoint is null;

alter table public.push_subscriptions
  alter column endpoint set not null;

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select c.conname
    from pg_constraint c
    join pg_attribute a
      on a.attrelid = c.conrelid
      and a.attnum = c.conkey[1]
    where c.conrelid = 'public.push_subscriptions'::regclass
      and c.contype = 'u'
      and array_length(c.conkey, 1) = 1
      and a.attname = 'user_id'
  loop
    execute format('alter table public.push_subscriptions drop constraint %I', constraint_name);
  end loop;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.push_subscriptions'::regclass
      and conname = 'push_subscriptions_user_endpoint_key'
  ) then
    alter table public.push_subscriptions
      add constraint push_subscriptions_user_endpoint_key unique (user_id, endpoint);
  end if;
end $$;

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions(user_id);
