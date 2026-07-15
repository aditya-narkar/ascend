import { getUTCDateString } from '@/lib/date'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { QuestPool } from '@/lib/types'

type SelectionWithPool = {
  quest_pool_id: string
  quest_pools: QuestPool | null
}

// Per-user module-level guards — survive within one server worker process.
// The DB unique constraint on (user_id, quest_pool_id, date_assigned) is the
// authoritative idempotency mechanism when requests hit different workers.
const generating = new Set<string>()
const generatedOn = new Map<string, string>()  // userId → date

export async function ensureTodayQuests(userId: string, supabase: SupabaseClient): Promise<void> {
  const today = getUTCDateString()

  if (generatedOn.get(userId) === today) return
  if (generating.has(userId)) return

  generating.add(userId)
  try {
    const { count } = await supabase
      .from('quests')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('date_assigned', today)

    if (count && count > 0) {
      generatedOn.set(userId, today)
      return
    }

    // Clean up stale incomplete quests from prior days
    await supabase
      .from('quests')
      .delete()
      .eq('user_id', userId)
      .neq('date_assigned', today)
      .eq('is_completed', false)

    const { data: selections } = await supabase
      .from('quest_selections')
      .select('*, quest_pools(*)')
      .eq('user_id', userId)
      .eq('is_active', true)

    const activeSelections = (selections ?? []) as SelectionWithPool[]
    if (activeSelections.length === 0) return

    const questsToInsert = activeSelections
      .filter((sel) => sel.quest_pools && sel.quest_pools.category !== 'elite')
      .map((sel) => ({
        user_id: userId,
        quest_pool_id: sel.quest_pool_id,
        title: sel.quest_pools!.title,
        description: sel.quest_pools!.description,
        category: sel.quest_pools!.category,
        quest_type: 'side',
        xp_reward: sel.quest_pools!.xp_reward,
        stat_target: sel.quest_pools!.stat_target,
        stat_reward: sel.quest_pools!.stat_reward ?? 1,
        is_completed: false,
        date_assigned: today,
        date_completed: null,
      }))

    if (questsToInsert.length > 0) {
      // upsert + ignoreDuplicates means a concurrent insert hitting the DB unique
      // constraint (user_id, quest_pool_id, date_assigned) will silently no-op.
      await supabase
        .from('quests')
        .upsert(questsToInsert, {
          onConflict: 'user_id,quest_pool_id,date_assigned',
          ignoreDuplicates: true,
        })
    }

    generatedOn.set(userId, today)
  } finally {
    generating.delete(userId)
  }
}
