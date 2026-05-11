-- Daily summary table for streak tracking and analytics
create table if not exists daily_summary (
  id            uuid default gen_random_uuid() primary key,
  user_id       uuid not null references users(id) on delete cascade,
  date          date not null,
  quests_completed  integer not null default 0,
  total_xp_earned   integer not null default 0,
  streak_maintained boolean not null default false,
  weak_day          boolean not null default false,
  penalty_triggered boolean not null default false,
  created_at    timestamp with time zone default now(),
  unique(user_id, date)
);

alter table daily_summary enable row level security;

create policy "Users can view own daily summaries"
  on daily_summary for select using (auth.uid() = user_id);

create policy "Users can insert own daily summaries"
  on daily_summary for insert with check (auth.uid() = user_id);

create policy "Users can update own daily summaries"
  on daily_summary for update using (auth.uid() = user_id);
