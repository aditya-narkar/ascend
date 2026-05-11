-- ============================================================
-- ASCEND — Supabase Schema
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ============================================================
-- TABLES
-- ============================================================

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz default now(),
  hunter_name text,
  archetype text,
  rank text default 'F',
  level integer default 1,
  total_xp integer default 0,
  current_xp integer default 0,
  xp_to_next_level integer default 500,
  commitment_text text,
  current_streak integer default 0,
  best_streak integer default 0,
  last_active_date date
);

create table if not exists public.stats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  strength integer default 20,
  focus integer default 20,
  discipline integer default 20,
  confidence integer default 20,
  intelligence integer default 20,
  purpose integer default 20,
  energy integer default 20,
  updated_at timestamptz default now(),
  unique (user_id)
);

create table if not exists public.quests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  description text,
  category text not null,
  quest_type text not null,
  xp_reward integer not null default 30,
  stat_target text,
  stat_reward integer,
  is_completed boolean default false,
  date_assigned date not null,
  date_completed timestamptz
);

create table if not exists public.archetype_quests (
  id uuid primary key default gen_random_uuid(),
  archetype text not null,
  title text not null,
  description text,
  category text not null,
  xp_reward integer not null default 30,
  stat_target text,
  difficulty text not null default 'small'
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.users enable row level security;
alter table public.stats enable row level security;
alter table public.quests enable row level security;
alter table public.archetype_quests enable row level security;

-- Users: can read/write own row only
create policy "Users can read own profile" on public.users
  for select using (auth.uid() = id);
create policy "Users can insert own profile" on public.users
  for insert with check (auth.uid() = id);
create policy "Users can update own profile" on public.users
  for update using (auth.uid() = id);

-- Stats: can read/write own row only
create policy "Users can read own stats" on public.stats
  for select using (auth.uid() = user_id);
create policy "Users can insert own stats" on public.stats
  for insert with check (auth.uid() = user_id);
create policy "Users can update own stats" on public.stats
  for update using (auth.uid() = user_id);

-- Quests: can read/write own rows only
create policy "Users can read own quests" on public.quests
  for select using (auth.uid() = user_id);
create policy "Users can insert own quests" on public.quests
  for insert with check (auth.uid() = user_id);
create policy "Users can update own quests" on public.quests
  for update using (auth.uid() = user_id);

-- Archetype quests: readable by all authenticated users
create policy "Anyone authenticated can read archetype quests" on public.archetype_quests
  for select using (auth.role() = 'authenticated');

-- ============================================================
-- FUNCTION: increment_stat
-- Used by quest completion server action
-- ============================================================

create or replace function public.increment_stat(
  p_user_id uuid,
  p_stat text,
  p_amount integer
)
returns void
language plpgsql
security definer
as $$
begin
  if p_stat = 'strength' then
    update public.stats set strength = strength + p_amount, updated_at = now()
    where user_id = p_user_id;
  elsif p_stat = 'focus' then
    update public.stats set focus = focus + p_amount, updated_at = now()
    where user_id = p_user_id;
  elsif p_stat = 'discipline' then
    update public.stats set discipline = discipline + p_amount, updated_at = now()
    where user_id = p_user_id;
  elsif p_stat = 'confidence' then
    update public.stats set confidence = confidence + p_amount, updated_at = now()
    where user_id = p_user_id;
  elsif p_stat = 'intelligence' then
    update public.stats set intelligence = intelligence + p_amount, updated_at = now()
    where user_id = p_user_id;
  elsif p_stat = 'purpose' then
    update public.stats set purpose = purpose + p_amount, updated_at = now()
    where user_id = p_user_id;
  elsif p_stat = 'energy' then
    update public.stats set energy = energy + p_amount, updated_at = now()
    where user_id = p_user_id;
  end if;
end;
$$;

-- ============================================================
-- SEED DATA: archetype_quests
-- 10+ quests per archetype
-- ============================================================

insert into public.archetype_quests (archetype, title, description, category, xp_reward, stat_target, difficulty) values

-- ── SILENT WARRIOR ──────────────────────────────────────────
('Silent Warrior', 'Cold Exposure Protocol', 'End your shower with 30 seconds of cold water. Do not skip.', 'discipline', 30, 'confidence', 'small'),
('Silent Warrior', 'Self-Evidence Log', 'Write 3 specific things you did well today. Evidence, not compliments.', 'mental', 30, 'confidence', 'small'),
('Silent Warrior', 'Social Contact Drill', 'Initiate one real conversation with someone today. Say what you think.', 'discipline', 70, 'confidence', 'medium'),
('Silent Warrior', 'Avoidance Slayer', 'Complete one task you have been avoiding for over 24 hours.', 'discipline', 70, 'discipline', 'medium'),
('Silent Warrior', 'Mirror Protocol', 'Stand in front of a mirror and speak your goals aloud for 2 minutes.', 'mental', 30, 'confidence', 'small'),
('Silent Warrior', 'Resilience Sets', 'Complete 50 push-ups distributed throughout the day.', 'physical', 30, 'strength', 'small'),
('Silent Warrior', 'Focus Block', 'Read 20 minutes with zero distraction. No phone in reach.', 'mental', 30, 'focus', 'small'),
('Silent Warrior', 'Fear Dissection', 'Write your current fear, then write 5 reasons it does not define your outcome.', 'mental', 70, 'confidence', 'medium'),
('Silent Warrior', '5-Minute Breath Reset', 'Set a timer. 5 minutes of deliberate breathing. Nothing else.', 'discipline', 30, 'focus', 'small'),
('Silent Warrior', 'No-Snooze Execution', 'Wake up at your first alarm. Sit up immediately. Begin.', 'discipline', 30, 'discipline', 'small'),
('Silent Warrior', 'Failure Audit', 'Write your biggest past failure and the one thing it actually taught you.', 'mental', 70, 'confidence', 'medium'),
('Silent Warrior', 'Pressure Set', 'Do a workout or physical challenge you would normally quit halfway through.', 'physical', 120, 'strength', 'hard'),

-- ── DORMANT TITAN ───────────────────────────────────────────
('Dormant Titan', 'Morning Sequence', 'Complete your full morning routine without skipping a single step.', 'discipline', 70, 'discipline', 'medium'),
('Dormant Titan', '45-Minute Lock-In', 'Work on your main goal for 45 uninterrupted minutes. Timer running.', 'discipline', 70, 'discipline', 'medium'),
('Dormant Titan', 'Consistency Checkpoint', 'Complete at least 2 tasks today. Streak protection active.', 'discipline', 30, 'discipline', 'small'),
('Dormant Titan', '100 Rep Challenge', 'Hit 100 total reps of any exercise distributed throughout the day.', 'physical', 70, 'strength', 'medium'),
('Dormant Titan', 'Sleep Before 11', 'In bed and lights off by 23:00 tonight. Recovery is training.', 'discipline', 30, 'energy', 'small'),
('Dormant Titan', 'Pre-Noon Media Blackout', 'Zero social media before 12:00 PM. Replace it with one productive action.', 'discipline', 30, 'discipline', 'small'),
('Dormant Titan', 'Clean Fuel Day', 'Eat clean all day. No processed food. No exception after 7 PM.', 'physical', 30, 'energy', 'small'),
('Dormant Titan', 'Sunrise Intent Protocol', 'Write 3 goals before 9 AM. Review and grade them at 9 PM.', 'mental', 30, 'purpose', 'small'),
('Dormant Titan', 'Promise Kept', 'Complete one specific thing you promised yourself yesterday.', 'discipline', 70, 'discipline', 'medium'),
('Dormant Titan', 'Deep Work Block', '1 hour of focused work. No interruptions. Phone in another room.', 'discipline', 120, 'discipline', 'hard'),
('Dormant Titan', 'Physical Anchor', 'Do a workout even if energy is low. Show up for 20 minutes minimum.', 'physical', 70, 'strength', 'medium'),
('Dormant Titan', 'System Day', 'Follow your schedule 100%. Every planned item executed.', 'discipline', 150, 'discipline', 'elite'),

-- ── LOST HUNTER ─────────────────────────────────────────────
('Lost Hunter', 'Priority Mapping', 'Write your top 3 priorities for the week and rank them by importance.', 'mental', 30, 'purpose', 'small'),
('Lost Hunter', 'Skill Scouting', 'Spend 20 minutes researching one skill aligned with your goal.', 'mental', 30, 'intelligence', 'small'),
('Lost Hunter', 'Structure Day', 'Write a schedule for today and execute it. Review compliance tonight.', 'discipline', 70, 'discipline', 'medium'),
('Lost Hunter', 'Mentor Contact', 'Reach out to one person more advanced than you in your field.', 'discipline', 70, 'purpose', 'medium'),
('Lost Hunter', '10-Page Input', 'Read 10 pages of a book directly relevant to your chosen direction.', 'mental', 30, 'intelligence', 'small'),
('Lost Hunter', 'Core Values Session', 'Write your 5 non-negotiable personal values. Define each one.', 'mental', 70, 'purpose', 'medium'),
('Lost Hunter', 'One Step Forward', 'Take one concrete, measurable action toward your 6-month goal.', 'discipline', 70, 'purpose', 'medium'),
('Lost Hunter', 'Zero-Waste Day', 'Complete a full day where every hour was used intentionally. Log it.', 'discipline', 120, 'discipline', 'hard'),
('Lost Hunter', '30 Minutes Learning', 'Watch or listen to 30 minutes of educational content in your domain.', 'mental', 30, 'intelligence', 'small'),
('Lost Hunter', '3-Day Roadmap', 'Build a task list for the next 3 days. Prioritized. Estimated time each.', 'mental', 30, 'purpose', 'small'),
('Lost Hunter', 'Identity Statement', 'Write who you are becoming in present tense. Read it three times.', 'mental', 30, 'confidence', 'small'),
('Lost Hunter', 'Direction Week', 'Set a 7-day goal. Write why it matters. Begin it today.', 'mental', 150, 'purpose', 'elite'),

-- ── BROKEN MAGE ─────────────────────────────────────────────
('Broken Mage', 'First Hour Protocol', 'No phone for the first hour after waking. Replace with a high-value action.', 'discipline', 70, 'discipline', 'medium'),
('Broken Mage', 'Phone Exile', 'Phone stays in a separate room for 2 hours during your work block.', 'discipline', 70, 'focus', 'medium'),
('Broken Mage', 'App Purge', 'Delete 2 apps that consistently waste your time. Uninstall now.', 'discipline', 120, 'discipline', 'hard'),
('Broken Mage', 'Completion Gate', 'No entertainment until all priority tasks are done today.', 'discipline', 70, 'discipline', 'medium'),
('Broken Mage', 'Screen-Free Breath', 'Sit with no screens for 20 minutes. Observe your thoughts. No input.', 'mental', 30, 'focus', 'small'),
('Broken Mage', 'Physical Reading', 'Read a physical book or printout for 30 minutes. Eyes off all screens.', 'mental', 30, 'intelligence', 'small'),
('Broken Mage', '24-Hour Silence', 'Zero social media for 24 hours. Replace time with real-world action.', 'discipline', 150, 'discipline', 'elite'),
('Broken Mage', 'Distraction-Free Zone', 'Work in a fully distraction-free environment for 1 hour. Measure output.', 'discipline', 30, 'focus', 'small'),
('Broken Mage', 'Trigger Audit', 'Identify your top 3 distraction triggers. Write the exact cost of each.', 'mental', 30, 'intelligence', 'small'),
('Broken Mage', 'Site Blocker Setup', 'Install a site/app blocker and configure it for your work session today.', 'discipline', 70, 'discipline', 'medium'),
('Broken Mage', 'Attention Reclaim', 'Complete a full 2-hour work session with zero social media.', 'discipline', 70, 'focus', 'medium'),
('Broken Mage', 'Recovery Day', 'Eat clean, sleep 7+ hours, no screens after 9 PM tonight.', 'physical', 120, 'energy', 'hard'),

-- ── OVERTHINKER ROGUE ────────────────────────────────────────
('Overthinker Rogue', '5-Second Launch', 'Make one decision within 5 seconds and act on it without revisiting.', 'discipline', 70, 'discipline', 'medium'),
('Overthinker Rogue', '60-Second Start', 'Pick a task and begin within 60 seconds of thinking about it.', 'discipline', 30, 'discipline', 'small'),
('Overthinker Rogue', 'Brain Dump + Pick One', 'Write every thought cluttering your mind for 10 minutes. Pick one to act on.', 'mental', 30, 'focus', 'small'),
('Overthinker Rogue', 'Action Override', 'Take one direct action on your main goal right now. Zero planning first.', 'discipline', 70, 'purpose', 'medium'),
('Overthinker Rogue', 'Observer Drill', '5 minutes of mindfulness: observe thoughts arising without reacting to any.', 'mental', 30, 'focus', 'small'),
('Overthinker Rogue', 'One Choice Rule', 'Make one major decision today and do not revisit or second-guess it.', 'discipline', 70, 'discipline', 'medium'),
('Overthinker Rogue', 'Minimum Viable Action', 'Write the smallest possible version of your goal. Execute that version only.', 'mental', 30, 'purpose', 'small'),
('Overthinker Rogue', 'Full Completion Rule', 'Finish one task completely before allowing yourself to start another.', 'discipline', 70, 'discipline', 'medium'),
('Overthinker Rogue', 'Ship Something Small', 'Produce and "ship" one small thing today. Done is the threshold.', 'discipline', 120, 'confidence', 'hard'),
('Overthinker Rogue', 'Completion Audit', 'At end of day: write what you actually completed vs what you planned.', 'mental', 30, 'purpose', 'small'),
('Overthinker Rogue', 'Clarity Statement', 'In one sentence: what is your main mission right now? Write it, post it.', 'mental', 30, 'purpose', 'small'),
('Overthinker Rogue', 'Momentum Day', 'Act on 5 things before analyzing any of them. Volume over perfection.', 'discipline', 150, 'discipline', 'elite'),

-- ── IRON GHOST ──────────────────────────────────────────────
('Iron Ghost', 'Low-Energy Override', 'Do a 20-minute workout at your lowest energy moment of the day.', 'physical', 70, 'energy', 'medium'),
('Iron Ghost', 'Sleep Tracking', 'Track your sleep tonight. Log your bedtime and total hours. Aim 7-8.', 'discipline', 30, 'energy', 'small'),
('Iron Ghost', 'Clean Fuel Intake', 'Eat one fully clean, high-energy meal today. Track how you feel after.', 'physical', 30, 'energy', 'small'),
('Iron Ghost', 'Morning Cold Shock', 'Cold shower first thing in the morning. 60 seconds minimum.', 'physical', 30, 'energy', 'small'),
('Iron Ghost', 'Caffeine Cutoff', 'No caffeine after 2 PM. Observe your natural energy curve tonight.', 'discipline', 30, 'energy', 'small'),
('Iron Ghost', 'Power Recovery', 'Take a 10-20 minute intentional rest at your lowest point today.', 'physical', 30, 'energy', 'small'),
('Iron Ghost', 'Afternoon Activation', '3 sets of any bodyweight exercise at 3 PM sharp.', 'physical', 70, 'strength', 'medium'),
('Iron Ghost', 'Afternoon Media Lock', 'Zero social media from 12 PM to 2 PM. Use that time physically.', 'discipline', 70, 'energy', 'medium'),
('Iron Ghost', 'Tomorrow Planning', 'Plan tomorrow''s top 3 priorities tonight. Write it before 10 PM.', 'mental', 30, 'purpose', 'small'),
('Iron Ghost', 'Midnight Rule', 'In bed with lights off before midnight. Non-negotiable tonight.', 'discipline', 30, 'energy', 'small'),
('Iron Ghost', 'Full Physical Day', 'Move for at least 45 total minutes across the day in any form.', 'physical', 70, 'strength', 'medium'),
('Iron Ghost', 'Energy Week', 'Sleep 7+ hours, eat clean, exercise, and cut stimulants — all in one day.', 'physical', 150, 'energy', 'elite');
