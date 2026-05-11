-- ============================================================
-- ASCEND — Quest Selection System
-- Run in Supabase SQL Editor AFTER supabase-schema.sql
-- ============================================================

-- Quest pools: master list of selectable quests
create table if not exists public.quest_pools (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text not null, -- lifestyle / physical / mental / focus / bad_habits / elite
  xp_reward integer not null default 30,
  difficulty text not null default 'small', -- small / medium / hard / elite
  stat_target text,
  stat_reward integer default 1,
  upgrade_group text -- links small→medium variants for upgrade suggestions
);

-- User's 21-day cycle selections
create table if not exists public.quest_selections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  quest_pool_id uuid not null references public.quest_pools(id),
  category text not null,
  cycle_number integer not null default 1,
  selected_date date not null,
  expires_date date not null,
  is_active boolean default true
);

-- Add quest_pool_id to quests so we can link back to selections
alter table public.quests
  add column if not exists quest_pool_id uuid references public.quest_pools(id);

-- Cycle tracking
create table if not exists public.cycles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  cycle_number integer not null,
  started_date date not null,
  ended_date date,
  total_completions integer default 0,
  total_days_active integer default 0,
  is_complete boolean default false,
  unique (user_id, cycle_number)
);

-- ============================================================
-- RLS
-- ============================================================

alter table public.quest_pools enable row level security;
alter table public.quest_selections enable row level security;
alter table public.cycles enable row level security;

create policy "Authenticated can read quest pools" on public.quest_pools
  for select using (auth.role() = 'authenticated');

create policy "Users can manage own selections" on public.quest_selections
  for all using (auth.uid() = user_id);

create policy "Users can manage own cycles" on public.cycles
  for all using (auth.uid() = user_id);

-- ============================================================
-- SEED: quest_pools
-- ============================================================

insert into public.quest_pools (title, description, category, xp_reward, difficulty, stat_target, stat_reward, upgrade_group) values

-- ── LIFESTYLE ────────────────────────────────────────────────
('Sleep Before 11pm',         'In bed with lights off before 23:00. Recovery is training.',                          'lifestyle', 30,  'small',  'energy',      1, 'sleep'),
('8-Hour Sleep Protocol',     'Track your sleep. Aim for exactly 8 hours. Log bedtime and wake time.',               'lifestyle', 70,  'medium', 'energy',      2, 'sleep'),
('Hydration Protocol',        'Drink 8 glasses of water throughout the day. Track each one.',                        'lifestyle', 30,  'small',  'energy',      1, 'hydration'),
('Hydration + Nutrition Sync','8 glasses water + one fully clean, unprocessed meal. Both required.',                 'lifestyle', 70,  'medium', 'energy',      2, 'hydration'),
('Morning Sequence',          'Complete your full morning routine without skipping a single step.',                   'lifestyle', 30,  'small',  'discipline',  1, 'morning-routine'),
('Power Morning',             '60-minute morning ritual: no phone, journal, movement, cold water. All four.',        'lifestyle', 70,  'medium', 'discipline',  2, 'morning-routine'),
('Clean Fuel Day',            'No processed food, no fast food, no sugar. Eat clean all day.',                       'lifestyle', 30,  'small',  'energy',      1, 'meal-discipline'),
('Full Nutrition Day',        'Meal prep or track every meal. Protein, vegetables, water. Zero junk.',               'lifestyle', 70,  'medium', 'energy',      2, 'meal-discipline'),

-- ── PHYSICAL ─────────────────────────────────────────────────
('Morning Walk',              '10-minute walk before noon. Outside if possible.',                                    'physical',  30,  'small',  'energy',      1, 'cardio'),
('Morning Run',               '20-minute continuous run. No walking. No stopping.',                                  'physical',  70,  'medium', 'strength',    2, 'cardio'),
('50 Push-Ups',               '50 total push-ups distributed across the day. Any time, any split.',                 'physical',  30,  'small',  'strength',    1, 'push-ups'),
('100 Push-Ups',              '100 total push-ups in the day. Strict form. Distribute as needed.',                   'physical',  70,  'medium', 'strength',    2, 'push-ups'),
('Cold Shower',               'End your shower with 30 seconds of cold water. Do not skip.',                        'physical',  30,  'small',  'confidence',  1, 'cold-training'),
('Extended Cold Protocol',    '90 seconds cold exposure at end of shower. Full body. Stay still.',                   'physical',  70,  'medium', 'confidence',  2, 'cold-training'),
('30-Min Movement',           'Any exercise for 30 continuous minutes. Counts if you sweat.',                       'physical',  30,  'small',  'strength',    1, 'workout'),
('45-Min Full Workout',       'Structured workout session: warm-up, main sets, cool down. 45 minutes total.',        'physical',  70,  'medium', 'strength',    2, 'workout'),

-- ── MENTAL ───────────────────────────────────────────────────
('Journal Entry',             'Write 5+ sentences about today — what happened, how you felt, what you learned.',    'mental',    30,  'small',  'focus',       1, 'journal'),
('Deep Reflection',           'Write at minimum 500 words. No edits. Stream of consciousness. Be honest.',          'mental',    70,  'medium', 'intelligence',2, 'journal'),
('5-Min Breath Reset',        'Set a timer. 5 minutes of deliberate breathing. Nothing else.',                      'mental',    30,  'small',  'focus',       1, 'meditation'),
('15-Min Deep Meditation',    '15 minutes timed meditation: sit still, observe thoughts, do not react.',            'mental',    70,  'medium', 'focus',       2, 'meditation'),
('10-Page Reading',           'Read 10 pages of any non-fiction or domain-relevant book.',                          'mental',    30,  'small',  'intelligence',1, 'reading'),
('30-Min Reading Session',    '30 minutes of sustained reading. One book. No skimming.',                            'mental',    70,  'medium', 'intelligence',2, 'reading'),
('20-Min Skill Study',        'Spend 20 focused minutes studying or practicing a skill you are building.',          'mental',    30,  'small',  'intelligence',1, 'learning'),
('45-Min Skill Session',      '45 minutes of deliberate practice on your main skill. Take notes.',                  'mental',    70,  'medium', 'intelligence',2, 'learning'),

-- ── FOCUS ────────────────────────────────────────────────────
('30-Min Focus Block',        '30 minutes of single-task work. Phone away. Timer running.',                         'focus',     30,  'small',  'focus',       1, 'deep-work'),
('1-Hour Deep Work',          '60 minutes of zero-interruption focused work. Measure output at end.',               'focus',     70,  'medium', 'focus',       2, 'deep-work'),
('Phone-Free Hour',           'Phone in another room for 1 full hour while you work or rest intentionally.',        'focus',     30,  'small',  'discipline',  1, 'phone-free'),
('Phone-Free Morning',        'No phone from wake time until noon. Replace habit with action.',                     'focus',     70,  'medium', 'discipline',  2, 'phone-free'),
('Priority List',             'Write your 3 most important tasks before starting the day. Review at night.',        'focus',     30,  'small',  'purpose',     1, 'priority-system'),
('Priority + Time Blocking',  'Write top 3 tasks + assign time blocks to each. Execute the schedule.',              'focus',     70,  'medium', 'discipline',  2, 'priority-system'),
('One Task Rule',             'Finish one task completely before allowing yourself to start another.',              'focus',     30,  'small',  'discipline',  1, 'single-task'),
('Full Completion Day',       'No task left half-done. Everything started gets finished. Track compliance.',        'focus',     70,  'medium', 'discipline',  2, 'single-task'),

-- ── BAD HABITS ───────────────────────────────────────────────
('No Snooze Rule',            'Wake at your first alarm. Sit up immediately. Do not lie back down.',               'bad_habits',30,  'small',  'discipline',  1, 'no-snooze'),
('Wake at Alarm + No Phone',  'First alarm only. Sit up. No phone for 30 minutes after waking.',                   'bad_habits',70,  'medium', 'discipline',  2, 'no-snooze'),
('No Social Before Noon',     'Zero social media before 12:00 PM. Replace with one intentional action.',           'bad_habits',30,  'small',  'discipline',  1, 'social-media'),
('4-Hour Social Media Block', 'No social media for any 4-hour window you choose. Pick your peak hours.',           'bad_habits',70,  'medium', 'focus',       2, 'social-media'),
('No Fast Food Today',        'No fast food, no delivery junk. Cook or prepare everything you eat.',               'bad_habits',30,  'small',  'energy',      1, 'no-junk'),
('No Processed Food All Day', 'Zero ultra-processed food for 24 hours. Read every label. No exceptions.',          'bad_habits',70,  'medium', 'energy',      2, 'no-junk'),

-- ── ELITE (weekly rotation, E-rank+) ─────────────────────────
('24-Hour Digital Detox',     'No social media, no streaming, no gaming for a full 24-hour period.',               'elite',     150, 'elite',  'discipline',  3, null),
('The Iron Morning',          'Cold shower + full workout + journal entry + no phone until noon. All four.',        'elite',     150, 'elite',  'strength',    3, null),
('1000 Words Written',        'Write 1000 words on any topic relevant to your growth. Output only.',               'elite',     150, 'elite',  'intelligence',3, null),
('Full Physical Day',         '45-min workout + 8,000 steps + clean eating + 8-hour sleep. All in one day.',       'elite',     150, 'elite',  'strength',    3, null),
('Master Study Session',      '2 continuous hours of focused learning. Take structured notes. Produce output.',    'elite',     150, 'elite',  'intelligence',3, null),
('48-Hour Clean Slate',       'Two full days: clean food, no junk media, daily workout, journaling. Both days.',   'elite',     150, 'elite',  'discipline',  3, null),
('Zero Waste Week',           'Complete every one of your selected quests today without missing a single one.',     'elite',     150, 'elite',  'discipline',  3, null),
('The Hard Thing First',      'Identify your most avoided task. Do it as the very first thing today.',             'elite',     120, 'hard',   'confidence',  2, null);
