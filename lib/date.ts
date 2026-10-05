// The game day is an IST (UTC+5:30) calendar day, as 'YYYY-MM-DD'. Quests, streaks,
// cycles, the daily-reset cron (18:30 UTC = 00:00 IST) and the reminder slots all roll
// over at 00:00 IST. Never use local date methods — the server runs in UTC.
// ponytail: fixed offset; add a users.timezone column if anyone outside India joins.
// supabase/functions/daily-reset/index.ts keeps a copy of gameDate() — keep them in sync.
const GAME_TZ_OFFSET_MS = 5.5 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

export function gameDate(daysFromToday = 0, now = Date.now()): string {
  return new Date(now + GAME_TZ_OFFSET_MS + daysFromToday * DAY_MS).toISOString().slice(0, 10)
}

export function msUntilGameDayEnds(now = Date.now()): number {
  return DAY_MS - ((now + GAME_TZ_OFFSET_MS) % DAY_MS)
}
