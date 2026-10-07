# ASCEND Project Memory

## Purpose

ASCEND is a gamified personal evolution system built as a mobile-first Next.js app with Supabase. The product frames self-improvement as a "hunter system" with ranks, levels, stats, daily quests, 21-day cycles, penalties for weak days, and web push notifications.

This file is the persistent handoff for future AI contributors. Update it whenever the app's behavior, architecture, schema, workflow, or deployment assumptions change.

## Stack

- Framework: Next.js `16.2.6` with App Router
- React: `19.2.4`
- Language: TypeScript, strict mode
- Styling: Tailwind CSS v4 via `@import "tailwindcss"` and `@theme` tokens in [`app/globals.css`](/C:/Users/Aditya/project/ascend/app/globals.css)
- Auth/data/backend: Supabase
- Notifications: Web Push via service worker + Supabase Edge Functions
- Deployment target: Vercel for the web app; scheduled backend work runs on Supabase Cron + Edge Functions

## Important repo rules

- Read Next docs under `node_modules/next/dist/docs/` before making framework-level changes. The local `AGENTS.md` explicitly warns that this project is on a newer/breaking version of Next.
- Keep this `memory.md` updated whenever meaningful changes are made.
- The worktree may be dirty. Do not revert unrelated user changes.

## Product model

The user is a "hunter" progressing through a themed self-improvement system.

Core concepts:

- Onboarding assigns an archetype based on self-reported struggle + failure pattern.
- A user gets baseline stats from that archetype.
- The user selects a 21-day quest loadout from quest pools.
- Daily quests are generated from the active selections.
- Completing quests grants XP and stat increases.
- Levels determine rank. Rank E starts at level 6.
- Elite quests unlock at level 6+.
- A streak is only maintained if the user hits a cycle-specific Kaizen threshold.
- Weak days and failed days trigger escalating penalties.

## Web-only architecture

The repo is now web-only again.

- The product is the Next.js web/PWA app in the repo root.
- The Expo native app, its `native/` workspace, and root Expo/EAS build configs have been removed.
- Keep future mobile work out of this repo unless the native app is intentionally reintroduced.
- Do not add native build commands, Expo env vars, or EAS config back as part of ordinary website work.

## Main user flow

### 1. Authentication

- `/auth/login`, `/auth/signup`, and `/auth/forgot-password` are client pages that call server actions in [`app/actions/auth.ts`](/C:/Users/Aditya/project/ascend/app/actions/auth.ts).
- Supabase auth is used for sign-in/sign-up/sign-out and password recovery.
- `/auth/reset-password` handles Supabase recovery links, exchanges the recovery code/session in the browser, and lets the user set a new password.
- A DB trigger auto-creates a `users` row on auth signup; onboarding later fills in the rest.

### 2. Root routing

- All access rules live in [`proxy.ts`](/C:/Users/Aditya/project/ascend/proxy.ts), which fetches `users.hunter_name` at most once per request:
  - signed out: `/dashboard`, `/stats`, `/profile`, `/onboarding` -> `/auth/login`; everything else passes through
  - signed in, not onboarded: protected routes -> `/onboarding`; auth pages -> `/onboarding`
  - signed in, onboarded: `/onboarding` and auth pages -> `/dashboard`
  - `/auth/reset-password` is exempt (it needs a recovery session)
- `/` has no logic: [`app/page.tsx`](/C:/Users/Aditya/project/ascend/app/page.tsx) just redirects to `/dashboard`, and the proxy then applies the rules above (the protected pages also re-check the profile themselves).

### 3. Onboarding

File: [`app/onboarding/page.tsx`](/C:/Users/Aditya/project/ascend/app/onboarding/page.tsx)

Steps:

- splash intro
- choose biggest struggle
- choose 6-month winning vision
- choose what kills progress
- 3-second archetype processing screen
- archetype reveal
- choose hunter name + write commitment/oath
- request notification permission
- reveal baseline stats
- submit to `completeOnboarding`

Server action: [`app/actions/onboarding.ts`](/C:/Users/Aditya/project/ascend/app/actions/onboarding.ts)

On completion it:

- derives archetype with `assignArchetype`
- derives baseline stats with `getBaselineStats`
- upserts `users`
- upserts `stats`
- redirects to `/dashboard`

### 4. Protected app shell

Protected pages live under [`app/(protected)`](/C:/Users/Aditya/project/ascend/app/(protected)).

Routes:

- `/dashboard`
- `/stats`
- `/profile`

Bottom nav has three tabs: TODAY (`/dashboard`), STATS, PROFILE. Logout is only on `/profile`.

Protected layout: [`app/(protected)/layout.tsx`](/C:/Users/Aditya/project/ascend/app/(protected)/layout.tsx)

- wraps content
- adds fixed bottom nav via [`app/components/BottomNav.tsx`](/C:/Users/Aditya/project/ascend/app/components/BottomNav.tsx)

## Dashboard behavior

Primary server route: [`app/(protected)/dashboard/page.tsx`](/C:/Users/Aditya/project/ascend/app/(protected)/dashboard/page.tsx)

Primary client UI: [`app/components/DashboardClient.tsx`](/C:/Users/Aditya/project/ascend/app/components/DashboardClient.tsx)

### Dashboard server responsibilities

- fetch profile, stats, active quest selections, and latest cycle in parallel
- detect whether the user needs quest selection
- build cycle report data if the previous cycle ended
- fetch quest pool choices and previous selection IDs for selection phase
- expire stale cycles with `checkAndExpireCycles`
- ensure today's quests exist with `ensureTodayQuests`
- run `checkDailyStreak`
- fetch today's penalty quests
- compute:
  - cycle number
  - Kaizen threshold
  - cycle expiry
  - day count
  - rank color / monarch progress

### Dashboard client responsibilities

- CompletionRing in the compact "Today" card updates instantly from optimistic quest state
- StreakCard replaces the old two-column streak grid; shows shield state and cycle days
- pending_system_message is read and cleared server-side before render, passed as `shieldMessage` prop
- optimistic quest completion/uncompletion
- auto-refresh if quests are missing due to generation race
- show cycle report overlay
- show selection-phase overlay
- show penalty-zone overlay
- layout order (top to bottom): penalty/cycle banners, sticky header, reminder nudge (only when alerts were never asked), compact Today card (ring + level + XP + day-reset countdown), Daily Hunt (filter chips built from present categories, penalty quests, quest list), Elite quest, Streak card, 4 stat tiles. The quest list is intentionally above the fold; do not push status chrome above it
- subscribe to Supabase realtime updates for `quests` table by `user_id`
- push/notification logic lives in [`lib/useNotifications.ts`](/C:/Users/Aditya/project/ascend/lib/useNotifications.ts) (availability + permission + silent re-subscribe when already granted + enable/test actions). The dashboard calls the hook only for the silent sync and the slim "Turn on quest reminders" nudge (dismissal stored in `localStorage` key `ascendAlertsNudgeDismissed`); the full controls are [`components/NotificationCard.tsx`](/C:/Users/Aditya/project/ascend/components/NotificationCard.tsx) on `/profile#alerts`
- show level-up and daily-summary overlays

### Daily hunt rules

- Normal cycle selection yields 9 regular quests total:
  - 2 lifestyle
  - 2 physical
  - 2 mental
  - 2 focus
  - 1 bad habits
- Elite quest is separate and weekly, not part of the 9 regular selections.
- Daily completion threshold for streaks is not "all quests"; it is Kaizen-based:
  - cycle 1 -> 4
  - cycle 2 -> 5
  - cycle 3 -> 6
  - cycle 4+ -> 7

### Quest generation notes

Primary logic is in [`app/actions/quests.ts`](/C:/Users/Aditya/project/ascend/app/actions/quests.ts).

Important behavior:

- old incomplete quests from previous days are deleted
- today's quests are generated from active `quest_selections`
- one daily quest is inserted per active non-elite selected quest pool
- elite quest is inserted separately for level 6+ users
- `ensureTodayQuests` is idempotent and stateless: it fetches today's quests first (the hot path, one query); only if there are none does it load selections, delete stale incomplete quests, and upsert today's rows (plus the elite quest) with `onConflict: 'user_id,quest_pool_id,date_assigned'` + `ignoreDuplicates`. The DB unique constraint is the only duplicate guard — do not add in-process locks or caches (they are useless on serverless and were removed)
- it re-fetches after the upsert because a concurrent insert can make the upsert response empty
- `fetchToday()` intentionally avoids ordering by `created_at`; the tracked `quests` schema in [`supabase-schema.sql`](/C:/Users/Aditya/project/ascend/supabase-schema.sql) does not define that column, and using it caused valid quest reads to fail and dashboards to show `0` quests
- dashboard client also calls `ensureTodayQuests` on mount if server rendered zero quests and no selection phase is needed

### Elite quest behavior

Elite quests are assigned only in `ensureTodayQuests`: for level 6+ users, the pool is picked by weeks since `users.created_at` (`elite_pools[weeksSinceCreated % pools.length]`). The old `generateDailyQuests` path (global week number + `users.elite_quest_assigned_week`) was deleted; the `elite_quest_assigned_week` column is now unused.

## Selection cycle system

UI: [`app/components/SelectionPhase.tsx`](/C:/Users/Aditya/project/ascend/app/components/SelectionPhase.tsx)

Server action: `saveQuestSelections` in [`app/actions/quests.ts`](/C:/Users/Aditya/project/ascend/app/actions/quests.ts)

Cycle flow:

- user selects a new 21-day quest loadout when onboarding finishes or a cycle expires
- current active selections are deactivated
- new rows are inserted into `quest_selections`
- a matching `cycles` row is created/upserted
- `users.needs_selection` is set to `false`

Selection rules:

- categories are chosen one at a time
- required counts:
  - lifestyle: 2
  - physical: 2
  - mental: 2
  - focus: 2
  - bad_habits: 1
- UI highlights prior selections with `PREV`
- UI highlights medium quests as `UPGRADE` when the prior cycle included the corresponding small quest in the same `upgrade_group`

Cycle expiry:

- cycles are treated as 21 days long
- `expires_date` is set with `gameDate(21)`
- stale active selections are expired both on dashboard load and in the daily cron route

## XP, levels, ranks, and stats

Source helpers: [`lib/utils.ts`](/C:/Users/Aditya/project/ascend/lib/utils.ts)

### Rank mapping

- F: levels 1-5
- E: 6-15
- D: 16-30
- C: 31-50
- B: 51-70
- A: 71-85
- S: 86-99
- Monarch: 100

### XP curve

- XP required for next level = `level * 500`

### Stat model

Stats stored in `stats`:

- strength
- focus
- discipline
- confidence
- intelligence
- purpose
- energy

Quest rewards usually increment one stat.

Level-up bonus:

- when a quest completion causes a level-up, the rewarded stat gets `quest.stat_reward + 2`

## Streak and penalty system

Core logic lives in:

- [`lib/streakShield.ts`](/C:/Users/Aditya/project/ascend/lib/streakShield.ts) — `updateStreak`, shield helpers (NEW)
- [`app/actions/quests.ts`](/C:/Users/Aditya/project/ascend/app/actions/quests.ts)
- [`app/actions/penalty.ts`](/C:/Users/Aditya/project/ascend/app/actions/penalty.ts)
- [`supabase/functions/daily-reset/index.ts`](/C:/Users/Aditya/project/ascend/supabase/functions/daily-reset/index.ts)
- [`app/components/PenaltyZone.tsx`](/C:/Users/Aditya/project/ascend/app/components/PenaltyZone.tsx)

### Daily result categories

- success: completed quests >= Kaizen threshold
- weak day: completed quests > 0 but below threshold
- failed day: very low or zero completion, with penalty escalation

### Streak Shield mechanic

- Awarded automatically every 21 `cycle_days_completed` (tracked in `users` table)
- Shield absorbs ONE full failure (0 completions) day — streak is NOT reset, penalty is skipped
- Only one shield can be held at a time
- `getShieldState(user)` → `'active' | 'used' | 'not_earned'`
- `getDaysUntilShield(user)` → days remaining to next milestone
- Shield state shown in `StreakCard` component
- When shield is consumed or awarded, `users.pending_system_message` is set and cleared on next dashboard load

### Streak ownership and quest undo rules

- `updateStreak()` (via `checkDailyStreak` on dashboard load and the `daily-reset` cron) is the **only** writer of `current_streak`, `best_streak`, `cycle_days_completed`, shield state and `last_active_date`. Both skip when `last_active_date === today`, so each day is processed once. `completeQuest` must not touch these (it used to, which double-counted every successful day). Consequence: today's progress shows in the streak only after the day rolls over.
- `completeQuest` / `uncompleteQuest` claim the quest with a conditional update (`.eq('is_completed', …).select('id')`) so concurrent calls can't double-award or double-refund. In `completeQuest` the completion counts are read *after* the quest is marked done, so they already include it (no `+1`).
- `uncompleteQuest` refunds XP and the base `stat_reward` (via `decrement_stat`), only for today's quests, and refuses (returns `{ success: false, error }`) when `current_xp < xp_reward` because a level-up already banked that XP. The +2 level-up stat bonus is not reversed. `cycles.total_completions` is not decremented (it is write-only; the cycle report counts from `quests`).

### Current streak processing implementation

- `checkDailyStreak()` in [`app/actions/quests.ts`](/C:/Users/Aditya/project/ascend/app/actions/quests.ts) now delegates streak resolution to `updateStreak()` in [`lib/streakShield.ts`](/C:/Users/Aditya/project/ascend/lib/streakShield.ts)
- On shield consumption, the app writes `pending_system_message = 'STREAK SHIELD CONSUMED. FAILURE ABSORBED. ONE CHANCE GIVEN.'`
- On shield award, the app writes `pending_system_message = 'STREAK SHIELD EARNED. 21 DAYS OF CONSISTENCY ACKNOWLEDGED. SHIELD ACTIVE.'`
- `daily_summary.streak_maintained` is treated as true both for normal threshold success and for shield-consumed failure absorption

### Penalty tiers

- Tier 0: none
- Tier 1: partial failure
  - triggered when completed quests are `>= 2` but `< threshold`
  - decrements each missed quest's `stat_target` by 2 via RPC
- Tier 2: hard failure
  - triggered when completed quests are `0` or `< 2`
  - applies flat `-5` all-stat penalty via RPC
  - creates a penalty quest for the next day
  - increments `consecutive_failures`
- Tier 3: Penalty Zone
  - triggered after 3 consecutive hard failures
  - activates a mandatory 2-hour active timer inside a 12-hour deadline window

### Penalty quest behavior

Penalty quests:

- are stored in `penalty_quests`
- appear above normal quests
- can block regular quest interaction when `penalty_tier === 2`
- grant XP when completed
- reset `penalty_tier` to 0 on completion

### Penalty Zone behavior

Penalty Zone UI rules:

- full-screen forced overlay
- user must accumulate 2 continuous active hours
- active time pauses between 11 PM and 7 AM local browser time
- leaving the tab resets timer to 0
- timer state is persisted every 30 seconds via `updatePenaltyActiveTime`
- if completed:
  - clears penalty state
- if failed or timed out:
  - loses 1 level, floor 1
  - rank/xp-to-next-level recalculated
  - current XP reset to 0
  - all stats reduced by 10

Important nuance:

- Penalty Zone timing is based on the browser's local time in the client component.
- Cron timeout checks use server time and `penalty_zone_started_at`.

## Notifications

Client helpers: [`lib/notifications.ts`](/C:/Users/Aditya/project/ascend/lib/notifications.ts)

Service worker: [`public/sw.js`](/C:/Users/Aditya/project/ascend/public/sw.js)

Service worker deployment notes:

- `/sw.js` is served with `Cache-Control: no-cache, no-store, must-revalidate` so Android Chrome/PWA installs do not keep a stale worker after deploys
- the worker calls `skipWaiting()` on install, handles `SKIP_WAITING` messages, and claims clients on activation so the latest push handler takes over after the app is reopened
- if Android push only appears while the app is open, reopen the deployed PWA once, press `TEST PUSH` to refresh the device subscription, then lock/close the app and test again

Server action bridge: [`app/actions/notifications.ts`](/C:/Users/Aditya/project/ascend/app/actions/notifications.ts)

Edge functions:

- [`supabase/functions/send-notification/index.ts`](/C:/Users/Aditya/project/ascend/supabase/functions/send-notification/index.ts)
- [`supabase/functions/notification-scheduler/index.ts`](/C:/Users/Aditya/project/ascend/supabase/functions/notification-scheduler/index.ts)
- [`supabase/functions/daily-reset/index.ts`](/C:/Users/Aditya/project/ascend/supabase/functions/daily-reset/index.ts)

Notification flow:

- browser requests permission
- service worker registers
- browser creates a Web Push subscription using `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- subscription is saved to `push_subscriptions` by a server action that verifies the signed-in user and writes with the service-role client
- server action or edge scheduler calls `send-notification`
- edge function loads the subscription and sends a Web Push payload
- dashboard shows a persistent notification status panel after browser detection; it displays enable/test controls when possible and blocked/unavailable diagnostics when Android/browser settings prevent Web Push
- the `TEST PUSH` control refreshes the current device subscription, saves it, then sends a real server push to every saved device endpoint for the logged-in user

Important configuration detail:

- browser subscription uses `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- edge functions accept `VAPID_PUBLIC_KEY` and also fall back to `NEXT_PUBLIC_VAPID_PUBLIC_KEY` if the server-only copy is missing
- `VAPID_EMAIL` may be stored either as `your@email.com` or `mailto:your@email.com`; the edge functions normalize it before calling `web-push`
- `push_subscriptions.subscription` is expected to be a browser Web Push subscription object for the PWA
- `push_subscriptions` supports multiple devices per user after applying [`supabase-push-subscriptions-multi-device.sql`](/C:/Users/Aditya/project/ascend/supabase-push-subscriptions-multi-device.sql); uniqueness is `(user_id, endpoint)`

Important `send-notification` edge-function behavior:

- requests authorized with either `CRON_SECRET` or the Supabase service-role key can send notifications to any user for cron and system flows
- the website server action prefers `CRON_SECRET` for test/manual sends to avoid Vercel/Supabase service-role secret drift
- VAPID config is required for Web Push sends
- stale or invalid browser subscriptions should be treated as best-effort failures and cleaned up when safe

Scheduled reminder behavior in `notification-scheduler`:

- reminder checks are IST-based, derived inside the edge function from UTC runtime time
- 09:00 IST: morning reminder if 0 quests done
- 14:00 IST: midday reminder if progress is behind
- 20:00 IST: evening reminder if below threshold
- 23:30 IST: final warning if the daily threshold is still incomplete
- every 2 hours during the IST active daytime window: Penalty Zone reminder

Important nuance:

- Supabase Cron invokes the scheduler in UTC, but notification copy and trigger slots are currently aligned to IST
- scheduled Web Push sends use high urgency and a 12-hour TTL to improve Android background delivery

## Pages summary

### `/dashboard`

- central game screen
- quest interaction
- elite quest
- streak/cycle info
- level-up modal
- daily summary modal
- cycle report / selection / penalty overlays

### `/stats`

File: [`app/(protected)/stats/page.tsx`](/C:/Users/Aditya/project/ascend/app/(protected)/stats/page.tsx)

Shows:

- all seven stats
- today's stat deltas from completed quests
- level/rank/XP progress
- rank ladder
- current/best streak
- total active days
- cycle days remaining
- cycle streak-rate approximation based on `daily_summary`

### `/profile`

File: [`app/(protected)/profile/page.tsx`](/C:/Users/Aditya/project/ascend/app/(protected)/profile/page.tsx)

Shows:

- hunter identity card
- alerts card (`NotificationCard`: enable / send test / blocked & unsupported diagnostics)
- archetype
- rank/day number
- commitment text
- four highlighted stats
- battle record
- achievements/titles
- logout action

## Supabase schema overview

Base schema files:

- [`supabase-schema.sql`](/C:/Users/Aditya/project/ascend/supabase-schema.sql)
- [`supabase-selections-schema.sql`](/C:/Users/Aditya/project/ascend/supabase-selections-schema.sql)
- [`supabase-daily-summary.sql`](/C:/Users/Aditya/project/ascend/supabase-daily-summary.sql)
- [`supabase-needs-selection.sql`](/C:/Users/Aditya/project/ascend/supabase-needs-selection.sql)
- [`supabase-rpc-cycle.sql`](/C:/Users/Aditya/project/ascend/supabase-rpc-cycle.sql)
- [`supabase-elite-week-migration.sql`](/C:/Users/Aditya/project/ascend/supabase-elite-week-migration.sql)
- [`supabase-penalty-system.sql`](/C:/Users/Aditya/project/ascend/supabase-penalty-system.sql)
- [`supabase-trigger.sql`](/C:/Users/Aditya/project/ascend/supabase-trigger.sql)
- [`supabase-push-subscriptions-multi-device.sql`](/C:/Users/Aditya/project/ascend/supabase-push-subscriptions-multi-device.sql)
- [`supabase-streak-shield.sql`](/C:/Users/Aditya/project/ascend/supabase-streak-shield.sql) — adds the shield / `cycle_days_completed` / `pending_system_message` columns to `users`. Required: `updateStreak()` writes them in one `update`, so if they are missing the whole streak update fails
- [`supabase-rpc-lockdown.sql`](/C:/Users/Aditya/project/ascend/supabase-rpc-lockdown.sql) — creates (if missing) and locks the stat/cycle RPCs to the service role
- [`supabase-game-day-ist.sql`](/C:/Users/Aditya/project/ascend/supabase-game-day-ist.sql) — moves the daily-reset cron to 00:00 IST
- [`supabase-diagnose.sql`](/C:/Users/Aditya/project/ascend/supabase-diagnose.sql) — read-only check of which tables, columns and functions exist; run it when something "silently does nothing" (Supabase errors from the JS client are mostly not surfaced in the UI)

### Main tables

`users`

- id, email, created_at
- hunter_name, archetype, commitment_text
- rank, level, total_xp, current_xp, xp_to_next_level
- current_streak, best_streak, last_active_date
- needs_selection
- elite_quest_assigned_week
- penalty_tier
- consecutive_failures
- penalty_zone_active
- penalty_zone_started_at
- penalty_zone_active_time
- penalty_zone_completed
- streak_shield_active (boolean) — shield is held and ready
- streak_shield_used_date (date) — when shield was last consumed
- last_shield_earned_date (date) — when shield was last earned
- cycle_days_completed (integer) — successful days in current streak cycle; increments on success days, triggers shield at multiples of 21
- pending_system_message (text) — one-time banner message shown on next dashboard load then cleared; used for shield events

`stats`

- one row per user
- seven main stats + updated_at

`quests`

- daily generated quest rows
- completion state, XP/stat rewards, assignment/completion dates
- linked back to quest pool via `quest_pool_id`

`quest_pools`

- selectable master quest catalog
- includes category, difficulty, reward values, `upgrade_group`

`quest_selections`

- active loadout rows for each cycle

`cycles`

- cycle metadata
- `total_completions` increments via RPC
- `total_days_active` exists in schema but I did not find code updating it yet

`daily_summary`

- analytics/streak result snapshot per user/date

`penalty_quests`

- separate from regular quests

`push_subscriptions`

- stores Web Push subscription JSON per user/device endpoint

`archetype_quests`

- older seed catalog from the first system design
- currently not used by active quest-generation flow, which now relies on `quest_pools`

### RLS posture

RLS is enabled on all major public tables.

General model:

- users can read/write only their own rows
- authenticated users can read shared catalogs like `quest_pools` and `archetype_quests`
- server-side admin work uses the service-role key

### RPC functions

- `increment_stat`
- `decrement_stat`
- `apply_all_stat_penalty`
- `increment_cycle_completions`

These are `SECURITY DEFINER` and take a caller-supplied `p_user_id`, so they are **service-role only**: [`supabase-rpc-lockdown.sql`](/C:/Users/Aditya/project/ascend/supabase-rpc-lockdown.sql) revokes `execute` from `public/anon/authenticated`. Server actions must call them via `createAdminClient()` (after verifying the user with `auth.getUser()`); edge functions already use the service role. Never call them with the user-session client. Deploy the app change before running the SQL.

## Date and time conventions

Very important:

- The "game day" is an **IST (UTC+5:30) calendar day** as a `YYYY-MM-DD` string. Quests (`date_assigned`), streaks, cycles, `daily_summary` and the daily-reset cron all roll over at 00:00 IST.
- Get dates only from `gameDate(daysFromToday = 0)` in [`lib/date.ts`](/C:/Users/Aditya/project/ascend/lib/date.ts); the dashboard countdown uses `msUntilGameDayEnds()`. Never use local or UTC date methods for game logic (the server runs in UTC). `supabase/functions/daily-reset/index.ts` has a copy of `gameDate()` — keep them in sync. The offset is a fixed constant; add a `users.timezone` column if anyone outside India joins.
- `node --experimental-strip-types scripts/check-date.mjs` asserts the boundary behavior.
- Still local-time by design: the Penalty Zone rest window (23:00-07:00 device time).
- Before the IST switch the game day was UTC (rollover at 05:30 IST). Existing dates stay valid if the switch is deployed between ~06:00 and ~23:30 IST (see `supabase-game-day-ist.sql`).

## Silent-failure logging

supabase-js resolves failed queries as `{ error }` instead of throwing, and most calls in this codebase do not check it, so a missing column, missing RPC or RLS denial used to fail silently (that is how the missing penalty functions and shield columns went unnoticed). Every server-side client (`lib/supabase/server.ts`, `lib/supabase/admin.ts`, `proxy.ts`, and `supabase/functions/daily-reset`) passes `global: { fetch: loggingFetch }` ([`lib/supabase/logFetch.ts`](/C:/Users/Aditya/project/ascend/lib/supabase/logFetch.ts)), which `console.error`s every failed PostgREST/RPC request as `[supabase] METHOD /rest/v1/<table> -> <status> <error body>` (path and PostgREST message only; never the query string or request body). Auth failures and 406 (`.single()` with no row) are intentionally not logged. Check the Vercel function logs and Supabase edge-function logs for lines starting with `[supabase]` when something silently does nothing; `supabase-diagnose.sql` then shows which migration is missing. Any new server-side Supabase client must use it. `node --experimental-strip-types scripts/check-logfetch.mjs` asserts the rules. The edge functions `send-notification` and `notification-scheduler` do not use it yet (planned with the shared edge code).

## Environment variables

Set these in `.env.local` and in the Vercel/Supabase environments (there is no committed example file; `.env*` is gitignored):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`
- `CRON_SECRET`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_EMAIL`

There is no native Expo env contract anymore; `EXPO_PUBLIC_*`, EAS project IDs, bundle IDs, and Android package settings were removed with the native app.

## Deployment and scheduled jobs

Vercel config: [`vercel.json`](/C:/Users/Aditya/project/ascend/vercel.json)

- build command: `npm run build`
- Next config is ESM-only in [`next.config.mjs`](/C:/Users/Aditya/project/ascend/next.config.mjs); avoid reintroducing duplicate `next.config.js` or `next.config.ts` files.
- icon generation script is [`scripts/generate-icons.mjs`](/C:/Users/Aditya/project/ascend/scripts/generate-icons.mjs)
- Vercel Cron and `/api/cron/*` bridge routes are not used; scheduled backend work runs through Supabase Cron and Edge Functions.
- daily reset has moved off Vercel Cron to Supabase Cron:
  - job name: `ascend-daily-reset`
  - schedule: `30 18 * * *` (00:00 IST; changed from `0 0 * * *` by [`supabase-game-day-ist.sql`](/C:/Users/Aditya/project/ascend/supabase-game-day-ist.sql))
  - target: `https://iaqutuhcdnsfavefhttc.supabase.co/functions/v1/daily-reset`
  - auth header is built from Supabase Vault secret `cron_secret`
  - function supports `{ "dry_run": true }` for safe verification
- notification scheduling has moved off Vercel Cron to Supabase Cron:
  - job name: `ascend-notification-scheduler`
  - schedule: `*/30 * * * *`
  - target: `https://iaqutuhcdnsfavefhttc.supabase.co/functions/v1/notification-scheduler`
  - auth headers are built from Supabase Vault secrets `project_url` and `anon_key`

The daily reset job:

- validates `Authorization: Bearer ${CRON_SECRET}`
- processes all users with service-role access
- expires stale cycles
- applies streak updates
- applies penalties
- handles Penalty Zone timeout
- saves `daily_summary`
- generates today's quests if missing

## Styling and UX language

The app has a strong "system / hunter / ascension" visual identity.

UI patterns:

- dark sci-fi palette
- Space Grotesk (`font-display`), JetBrains Mono (`font-mono`) and Inter (`font-body`) via `next/font` in `app/layout.tsx`
- one token set in `app/globals.css` (`@theme`): Material-style colours (`background`, `surface-*`, `on-surface*`, `primary*`, `secondary*`, `tertiary`, `error`, `outline*`) plus `success`, `primary-edge`, `shadow-glow`, `shadow-aura`. The old "legacy" tokens (`bg-primary`, `text-text-*`, `aura-*`, `highlight-*`, `border`, `card`) and the `font-rajdhani` / `font-share-tech-mono` aliases were deleted; do not reintroduce them. Prefer tokens over hex; when a colour must be passed as data (category/tier accents) pass a CSS variable such as `var(--color-secondary)` and derive tints with `color-mix`
- shared UI kit in [`components/ui/`](/C:/Users/Aditya/project/ascend/components/ui): `Button` (variants primary/outline/danger/ghost, sizes md/lg, `buttonClass()` for `<Link>`), `Card` (tones default/accent/danger/dashed, `corners`), `ProgressBar` (always needs an accessible `label`), `Modal` (dialog semantics, Escape, focus in/restore, Tab trap, `closeOnBackdrop`, `align`), `Field`/`FormMessage` (labelled inputs, alert/status messages), `AuthShell` (frame for login/signup/forgot/reset). Reuse these instead of pasting class strings; `LevelUpModal` and `DailyCompletionSummary` are built on `Modal`
- dense uppercase labels
- glow, flicker, scan-line, pulse animations
- mobile-first, card-heavy layout

Accessibility conventions (keep these when adding UI):

- no text under 12px (`text-xs` / `text-system-label` minimum); no inline `fontSize` below 12; no faded-opacity body text (use token colors, they already meet contrast)
- every interactive control is at least 44px tall (`min-h-11`); icon-only buttons need `aria-label`; decorative Material Symbols spans need `aria-hidden="true"`
- form inputs need `<label htmlFor>` + `id`; error text uses `role="alert"`, transient toasts use `role="status"`
- modals use `role="dialog" aria-modal`, close on Escape and autofocus their dismiss button
- a global `:focus-visible` outline and a `prefers-reduced-motion` block live in `app/globals.css`; do not add `focus:outline-none` without a replacement ring
- progress rings/bars expose `role="img"` / `role="progressbar"` with a text equivalent

Avoid flattening this into generic SaaS styling unless explicitly requested.

## Known implementation quirks and risks

- The Expo native app and root Expo/EAS configs were removed; the repo should remain focused on the Next.js website/PWA unless native is intentionally reintroduced.
- There are several visible mojibake characters in file output when viewed via PowerShell, likely from encoding/display mismatch rather than intended copy changes.
- `cycles.total_days_active` appears in the schema and UI report types, but I did not find active update logic for it.
- `archetype_quests` remains in schema/seed data but active daily generation comes from `quest_pools`.
- Parts of this document have been updated incrementally over time; when changing gameplay rules, verify that `memory.md` still matches both the latest code and schema, not just one of them.

## Maintenance note

- Do not keep stale point-in-time worktree snapshots in this file. Document enduring architecture and behavior here; use `git status` directly when you need the current local change state.

## How to update this file

When making future changes, update the sections affected by your work:

- routes or flows -> update "Main user flow" and "Pages summary"
- rules or game mechanics -> update "Dashboard behavior", "Selection cycle system", "XP, levels, ranks, and stats", or "Streak and penalty system"
- DB/schema changes -> update "Supabase schema overview"
- cron/notifications/time behavior -> update "Notifications", "Date and time conventions", and "Deployment and scheduled jobs"
- new risks or oddities -> append to "Known implementation quirks and risks"

Keep the file practical. It should help a future AI or engineer understand the project fast and avoid breaking hidden rules.
