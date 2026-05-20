import { getUTCDateString } from '@/lib/date'

export async function checkAndAwardShield(userId: string, supabase: any) {
  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()

  if (!user) return { shieldAwarded: false }

  if (
    user.cycle_days_completed > 0 &&
    user.cycle_days_completed % 21 === 0 &&
    !user.streak_shield_active
  ) {
    await supabase
      .from('users')
      .update({
        streak_shield_active: true,
        last_shield_earned_date: getUTCDateString(),
      })
      .eq('id', userId)

    return { shieldAwarded: true }
  }

  return { shieldAwarded: false }
}

export async function consumeShield(userId: string, supabase: any) {
  await supabase
    .from('users')
    .update({
      streak_shield_active: false,
      streak_shield_used_date: getUTCDateString(),
    })
    .eq('id', userId)
}

export function getShieldState(user: any): 'active' | 'used' | 'not_earned' {
  if (user.streak_shield_active) return 'active'
  if (user.streak_shield_used_date) return 'used'
  return 'not_earned'
}

export function getDaysUntilShield(user: any): number {
  const daysCompleted = user.cycle_days_completed ?? 0
  const nextMilestone = Math.ceil((daysCompleted + 1) / 21) * 21
  return nextMilestone - daysCompleted
}

// Evaluates a completed day's performance and updates streak, shield, and cycle_days_completed.
// Call at day boundaries (cron midnight run, dashboard load checkDailyStreak).
// The cron independently manages consecutive_failures and penalty_tier.
export async function updateStreak(
  userId: string,
  completedCount: number,
  minimumRequired: number,
  supabase: any,
): Promise<{ shieldConsumed: boolean; shieldAwarded: boolean }> {
  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()

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
  // Weak day (0 < completedCount < minimumRequired): streak pauses, no changes to streak/shield

  await supabase.from('users').update(updates).eq('id', userId)

  return { shieldConsumed, shieldAwarded }
}
