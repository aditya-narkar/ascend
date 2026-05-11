-- Track which week's elite quest has been assigned per user.
-- Prevents re-assigning the same weekly quest across daily resets.
alter table users add column if not exists elite_quest_assigned_week integer;
