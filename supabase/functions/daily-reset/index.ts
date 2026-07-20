import { createClient } from 'npm:@supabase/supabase-js'

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const cronSecret = Deno.env.get('CRON_SECRET') ?? ''

const supabase = createClient(supabaseUrl, serviceRoleKey)

type UserRow = {
  id: string
  current_streak: number | null
  best_streak: number | null
  last_active_date: string | null
  consecutive_failures: number | null
  penalty_tier: number | null
  penalty_zone_active: boolean | null
  penalty_zone_started_at: string | null
  cycle_days_completed?: number | null
  streak_shield_active?: boolean | null
  streak_shield_used_date?: string | null
}

type StreakResult = {
  shieldConsumed: boolean
  shieldAwarded: boolean
}

function getUTCDateString(): string {
  const now = new Date()
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`
}

function getUTCYesterdayString(): string {
  const now = new Date()
  const yesterday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1))
  return `${yesterday.getUTCFullYear()}-${String(yesterday.getUTCMonth() + 1).padStart(2, '0')}-${String(yesterday.getUTCDate()).padStart(2, '0')}`
}

function getRankFromLevel(level: number): string {
  if (level >= 100) return 'Monarch'
  if (level >= 86) return 'S'
  if (level >= 71) return 'A'
  if (level >= 51) return 'B'
  if (level >= 31) return 'C'
  if (level >= 16) return 'D'
  if (level >= 6) return 'E'
  return 'F'
}

function getXPToNextLevel(level: number): number {
  return level * 500
}

function getKaizenThreshold(cycleNumber: number): number {
  if (cycleNumber >= 4) return 7
  if (cycleNumber === 3) return 6
  if (cycleNumber === 2) return 5
  return 4
}

async function updateStreak(
  userId: string,
  completedCount: number,
  minimumRequired: number,
): Promise<StreakResult> {
  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single<UserRow>()

  if (!user) return { shieldConsumed: false, shieldAwarded: false }

  const today = getUTCDateString()
  const updates: Record<string, unknown> = { last_active_date: today }
  let shieldConsumed = false
  let shieldAwarded = false

  if (completedCount >= minimumRequired) {
    const newStreak = (user.current_streak ?? 0) + 1
    const newCycleDays = (user.cycle_days_completed ?? 0) + 1

    updates.current_streak = newStreak
    updates.cycle_days_completed = newCycleDays

    if (newStreak > (user.best_streak ?? 0)) {
      updates.best_streak = newStreak
    }

    if (newCycleDays % 21 === 0 && !user.streak_shield_active) {
      updates.streak_shield_active = true
      updates.last_shield_earned_date = today
      shieldAwarded = true
    }
  } else if (completedCount === 0) {
    if (user.streak_shield_active) {
      updates.streak_shield_active = false
      updates.streak_shield_used_date = today
      shieldConsumed = true
    } else {
      updates.current_streak = 0
    }
  }

  await supabase.from('users').update(updates).eq('id', userId)

  return { shieldConsumed, shieldAwarded }
}

async function pushNotify(
  userId: string,
  title: string,
  body: string,
  tag: string,
  renotify = false,
) {
  if (!supabaseUrl || !serviceRoleKey) return

  try {
    await fetch(`${supabaseUrl}/functions/v1/send-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ user_id: userId, title, body, tag, renotify }),
    })
  } catch {
    // Notification failures should not block daily reset.
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return json({ error: 'Method Not Allowed' }, 405)
  }

  const authHeader = req.headers.get('Authorization')
  if (authHeader !== `Bearer ${cronSecret}` && authHeader !== `Bearer ${serviceRoleKey}`) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const today = getUTCDateString()
  const yesterday = getUTCYesterdayString()
  const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}

  const { data: users } = await supabase
    .from('users')
    .select('id, current_streak, best_streak, last_active_date, consecutive_failures, penalty_tier, penalty_zone_active, penalty_zone_started_at')

  if (!users) return json({ ok: true, processed: 0 })

  if (body?.dry_run === true) {
    return json({ ok: true, dry_run: true, users: users.length, today, yesterday })
  }

  let processed = 0

  for (const user of users as UserRow[]) {
    const { data: expiredSels } = await supabase
      .from('quest_selections')
      .select('cycle_number')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .lt('expires_date', today)

    if (expiredSels && expiredSels.length > 0) {
      await supabase
        .from('quest_selections')
        .update({ is_active: false })
        .eq('user_id', user.id)
        .eq('is_active', true)
        .lt('expires_date', today)

      const expiredCycleNums = [...new Set(expiredSels.map((s: { cycle_number: number }) => s.cycle_number))]
      for (const cn of expiredCycleNums) {
        await supabase
          .from('cycles')
          .update({ is_complete: true, ended_date: yesterday })
          .eq('user_id', user.id)
          .eq('cycle_number', cn)
          .eq('is_complete', false)
      }

      await supabase
        .from('users')
        .update({ needs_selection: true })
        .eq('id', user.id)
    }

    if (user.penalty_zone_active && user.penalty_zone_started_at) {
      const deadline = new Date(user.penalty_zone_started_at).getTime() + 12 * 3600 * 1000
      if (new Date().getTime() >= deadline) {
        const { data: pzProfile } = await supabase
          .from('users')
          .select('level, current_xp')
          .eq('id', user.id)
          .single()

        const pzLevel = pzProfile?.level ?? 1
        const pzCurrentXP = pzProfile?.current_xp ?? 0
        const newLevel = Math.max(1, pzLevel - 1)
        const newRank = getRankFromLevel(newLevel)
        const newXPToNext = getXPToNextLevel(newLevel)

        await supabase
          .from('users')
          .update({
            penalty_zone_active: false,
            penalty_zone_completed: false,
            penalty_tier: 0,
            consecutive_failures: 0,
            level: newLevel,
            rank: newRank,
            xp_to_next_level: newXPToNext,
            current_xp: 0,
          })
          .eq('id', user.id)

        await supabase.rpc('apply_all_stat_penalty', {
          p_user_id: user.id,
          p_amount: 10,
        })

        try {
          await supabase.from('penalty_history').insert({
            user_id: user.id,
            date: today,
            penalty_tier: 3,
            xp_lost: pzCurrentXP,
            level_before: pzLevel,
            level_after: newLevel,
            penalty_zone_triggered: true,
            penalty_zone_failed: true,
            penalty_zone_completed: false,
            notes: 'Penalty Zone timed out via Supabase daily-reset cron.',
          })
        } catch {
          // Best effort history logging.
        }

        await pushNotify(user.id, 'Penalty Zone Failed', 'Consequences applied. The weak remain weak.', 'penalty')
        processed++
        continue
      }
    }

    if (user.last_active_date === today) {
      processed++
      continue
    }

    const { count: yesterdayCount } = await supabase
      .from('quests')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('date_assigned', yesterday)
      .eq('is_completed', true)

    const completed = yesterdayCount ?? 0

    const { data: activeSel } = await supabase
      .from('quest_selections')
      .select('cycle_number')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .gte('expires_date', yesterday)
      .limit(1)
      .maybeSingle()

    const threshold = getKaizenThreshold(activeSel?.cycle_number ?? 1)

    const result = await updateStreak(user.id, completed, threshold)
    const shieldConsumed = result?.shieldConsumed ?? false
    const shieldAwarded = result?.shieldAwarded ?? false

    const streakMaintained = completed >= threshold || shieldConsumed
    const weakDay = completed > 0 && completed < threshold

    if (shieldConsumed) {
      await supabase
        .from('users')
        .update({ pending_system_message: 'STREAK SHIELD CONSUMED. FAILURE ABSORBED. ONE CHANCE GIVEN.' })
        .eq('id', user.id)
    } else if (shieldAwarded) {
      await supabase
        .from('users')
        .update({ pending_system_message: 'STREAK SHIELD EARNED. 21 DAYS OF CONSISTENCY ACKNOWLEDGED. SHIELD ACTIVE.' })
        .eq('id', user.id)
    }

    let penaltyTriggered = false
    let newPenaltyTier = user.penalty_tier ?? 0
    let newConsecutiveFailures = user.consecutive_failures ?? 0
    const isInPenaltyZone = user.penalty_tier === 3

    if (!isInPenaltyZone && !shieldConsumed) {
      if (completed === 0 || (completed > 0 && completed < 2)) {
        penaltyTriggered = true
        await supabase.rpc('apply_all_stat_penalty', {
          p_user_id: user.id,
          p_amount: 5,
        })

        newConsecutiveFailures = (user.consecutive_failures ?? 0) + 1

        if (newConsecutiveFailures >= 3) {
          newPenaltyTier = 3
          newConsecutiveFailures = 0
          await supabase
            .from('users')
            .update({
              penalty_tier: 3,
              consecutive_failures: 0,
              penalty_zone_active: true,
              penalty_zone_started_at: new Date().toISOString(),
              penalty_zone_active_time: 0,
            })
            .eq('id', user.id)

          try {
            await supabase.from('penalty_history').insert({
              user_id: user.id,
              date: today,
              penalty_tier: 3,
              consecutive_failures: newConsecutiveFailures + 1,
              penalty_zone_triggered: true,
              penalty_zone_completed: false,
              penalty_zone_failed: false,
            })
          } catch {
            // Best effort history logging.
          }

          await pushNotify(
            user.id,
            'PENALTY ZONE',
            '3 consecutive failures. Penalty Zone activated. 2 hours. Now.',
            'penalty-zone',
            true,
          )
        } else {
          newPenaltyTier = 2
          await supabase.from('penalty_quests').insert({
            user_id: user.id,
            title: 'Face the Debt',
            description: 'Complete a 90 minute focus session with phone in another room. No exceptions.',
            xp_reward: 120,
            date_assigned: today,
          })

          try {
            await supabase.from('penalty_history').insert({
              user_id: user.id,
              date: today,
              penalty_tier: 2,
              consecutive_failures: newConsecutiveFailures,
              stats_reduced: { all_stats: 5 },
              penalty_quest_assigned: true,
              penalty_quest_completed: false,
              penalty_zone_triggered: false,
            })
          } catch {
            // Best effort history logging.
          }

          await pushNotify(
            user.id,
            'Day Failed',
            'Penalty protocol active. Face it tomorrow. The debt is recorded.',
            'penalty',
          )
        }
      } else if (completed >= 2 && completed < threshold) {
        penaltyTriggered = true
        const { data: missedQuests } = await supabase
          .from('quests')
          .select('stat_target')
          .eq('user_id', user.id)
          .eq('date_assigned', yesterday)
          .eq('is_completed', false)
          .not('stat_target', 'is', null)

        const uniqueStats = [...new Set((missedQuests ?? []).map((q) => q.stat_target).filter(Boolean))]
        const statsReducedMap: Record<string, number> = {}
        for (const stat of uniqueStats) {
          await supabase.rpc('decrement_stat', {
            p_user_id: user.id,
            p_stat: stat,
            p_amount: 2,
          })
          if (stat) statsReducedMap[stat] = 2
        }
        newPenaltyTier = 1

        try {
          await supabase.from('penalty_history').insert({
            user_id: user.id,
            date: today,
            penalty_tier: 1,
            stats_reduced: Object.keys(statsReducedMap).length > 0 ? statsReducedMap : null,
            penalty_zone_triggered: false,
          })
        } catch {
          // Best effort history logging.
        }
      } else if (completed >= threshold) {
        if (user.penalty_tier === 1) {
          newPenaltyTier = 0
          newConsecutiveFailures = 0
        }
      }
    }

    const updatePayload: Record<string, unknown> = {
      consecutive_failures: newConsecutiveFailures,
    }
    if (newPenaltyTier !== user.penalty_tier && newPenaltyTier !== 3) {
      updatePayload.penalty_tier = newPenaltyTier
    }
    await supabase.from('users').update(updatePayload).eq('id', user.id)

    await supabase.from('daily_summary').upsert(
      {
        user_id: user.id,
        date: yesterday,
        quests_completed: completed,
        total_xp_earned: 0,
        streak_maintained: streakMaintained,
        weak_day: weakDay,
        penalty_triggered: penaltyTriggered,
      },
      { onConflict: 'user_id,date' },
    )

    const { data: activeSelections } = await supabase
      .from('quest_selections')
      .select('*, quest_pools(*)')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .gte('expires_date', today)

    const { count: existingCount } = await supabase
      .from('quests')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('date_assigned', today)

    if (existingCount !== null && existingCount > 0) {
      processed++
      continue
    }

    for (const sel of activeSelections ?? []) {
      const pool = sel.quest_pools
      if (!pool) continue

      const { count } = await supabase
        .from('quests')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('date_assigned', today)
        .eq('quest_pool_id', pool.id)

      if (count && count > 0) continue

      await supabase.from('quests').insert({
        user_id: user.id,
        title: pool.title,
        description: pool.description,
        category: pool.category,
        quest_type: 'side',
        xp_reward: pool.xp_reward,
        stat_target: pool.stat_target,
        stat_reward: pool.stat_reward ?? 1,
        is_completed: false,
        date_assigned: today,
        date_completed: null,
        quest_pool_id: pool.id,
      })
    }

    processed++
  }

  return json({ ok: true, processed, today, yesterday })
})
