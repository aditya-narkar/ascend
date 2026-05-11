'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { assignArchetype, getBaselineStats, getRankFromLevel, getXPToNextLevel } from '@/lib/utils'

export async function completeOnboarding(data: {
  struggle: string
  killer: string
  winning: string
  hunterName: string
  commitmentText: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const archetype = assignArchetype(data.struggle, data.killer)
  const baseStats = getBaselineStats(archetype)
  const rank = getRankFromLevel(1)
  const xpToNext = getXPToNextLevel(1)

  const { error: profileError } = await supabase
    .from('users')
    .upsert(
      {
        id: user.id,
        email: user.email ?? '',
        hunter_name: data.hunterName.trim(),
        archetype,
        rank,
        level: 1,
        total_xp: 0,
        current_xp: 0,
        xp_to_next_level: xpToNext,
        commitment_text: data.commitmentText.trim(),
        current_streak: 0,
        best_streak: 0,
        last_active_date: null,
      },
      { onConflict: 'id' }
    )

  if (profileError) return { error: profileError.message }

  const { error: statsError } = await supabase
    .from('stats')
    .upsert(
      {
        user_id: user.id,
        ...baseStats,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

  if (statsError) return { error: statsError.message }

  redirect('/dashboard')
}
