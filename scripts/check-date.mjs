// Run: node --experimental-strip-types scripts/check-date.mjs
// Guards the IST game-day boundary that quests, streaks and the daily-reset cron depend on.
import assert from 'node:assert/strict'
import { gameDate, msUntilGameDayEnds } from '../lib/date.ts'

const at = (h, m = 0, s = 0, day = 5) => Date.UTC(2026, 9, day, h, m, s) // Oct 2026, UTC

assert.equal(gameDate(0, at(18, 29, 59)), '2026-10-05') // 23:59:59 IST — still Oct 5
assert.equal(gameDate(0, at(18, 30)), '2026-10-06')     // 00:00:00 IST — rolled over
assert.equal(gameDate(0, at(0, 0)), '2026-10-05')       // 05:30 IST (old UTC cron time) — same day
assert.equal(gameDate(-1, at(18, 30)), '2026-10-05')
assert.equal(gameDate(21, at(12, 0, 0, 20)), '2026-11-10') // month rollover for 21-day cycles
assert.equal(msUntilGameDayEnds(at(18, 0)), 30 * 60 * 1000) // 23:30 IST -> 30 min left
assert.equal(msUntilGameDayEnds(at(18, 30)), 24 * 60 * 60 * 1000) // exactly at rollover -> full day

console.log('date checks passed')
