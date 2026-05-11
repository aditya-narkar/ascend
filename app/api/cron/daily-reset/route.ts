import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getKaizenThreshold } from '@/lib/utils'

// Vercel Cron calls this at midnight every day.
// Requires CRON_SECRET and SUPABASE_SERVICE_ROLE_KEY env vars.
export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

  // 1. Get all users who have (or had) active selections
  const { data: users } = await supabase
    .from('users')
    .select('id, current_streak, best_streak, last_active_date')

  if (!users) return NextResponse.json({ ok: true, processed: 0 })

  let processed = 0

  for (const user of users) {
    // 2. Expire stale selections and mark cycles complete
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

      const cycleNums = [...new Set(expiredSels.map((s) => s.cycle_number))]
      for (const cn of cycleNums) {
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

    // 3. Streak boundary check for yesterday
    if (user.last_active_date === today) {
      processed++
      continue // already handled today
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

    let newStreak = user.current_streak
    let newBest = user.best_streak
    let streakMaintained = false
    let weakDay = false

    if (completed === 0) {
      newStreak = 0
    } else if (completed >= threshold) {
      newStreak = user.last_active_date === yesterday ? user.current_streak + 1 : 1
      if (newStreak > newBest) newBest = newStreak
      streakMaintained = true
    } else {
      weakDay = true
    }

    await supabase
      .from('users')
      .update({ current_streak: newStreak, best_streak: newBest, last_active_date: today })
      .eq('id', user.id)

    await supabase.from('daily_summary').upsert(
      {
        user_id: user.id,
        date: yesterday,
        quests_completed: completed,
        total_xp_earned: 0,
        streak_maintained: streakMaintained,
        weak_day: weakDay,
        penalty_triggered: false,
      },
      { onConflict: 'user_id,date' },
    )

    // 4. Generate today's quests from active selections
    const { data: activeSelections } = await supabase
      .from('quest_selections')
      .select('*, quest_pools(*)')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .gte('expires_date', today)

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

  return NextResponse.json({ ok: true, processed })
}
