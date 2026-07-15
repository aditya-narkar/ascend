import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ensureTodayQuests, checkDailyStreak, checkAndExpireCycles } from '@/app/actions/quests'
import { getMonarchProgress, formatTodayDate, getKaizenThreshold } from '@/lib/utils'
import DashboardClient from '@/app/components/DashboardClient'
import type { UserProfile, Stats, Quest, QuestPool, QuestSelection, CycleReportData, PoolCategory, PenaltyQuest } from '@/lib/types'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const today = formatTodayDate()

  // Fetch all independent data in one parallel round-trip
  const [profileRes, statsRes, activeSelsRes, lastCycleRes] = await Promise.all([
    supabase.from('users').select('*').eq('id', user.id).single(),
    supabase.from('stats').select('*').eq('user_id', user.id).single(),
    supabase
      .from('quest_selections')
      .select('*, quest_pools(*)')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .gte('expires_date', today),
    supabase
      .from('cycles')
      .select('*')
      .eq('user_id', user.id)
      .order('cycle_number', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const profile = profileRes.data as UserProfile | null
  const stats = statsRes.data as Stats | null
  if (!profile?.hunter_name) redirect('/onboarding')

  const activeSelections = activeSelsRes.data
  const lastCycle = lastCycleRes.data

  const needsSelectionPhase =
    (profile.needs_selection === true) || !activeSelections || activeSelections.length === 0
  const isFirstCycle = !lastCycle

  let cycleReport: CycleReportData | null = null
  const questPoolsByCategory: Record<string, QuestPool[]> = {}
  let previousSelectionIds: string[] = []

  // Selection-phase data — all three fetched in parallel when needed
  if (needsSelectionPhase) {
    const [completionsRes, poolsRes, prevSelsRes] = await Promise.all([
      lastCycle
        ? supabase
            .from('quests')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('is_completed', true)
            .gte('date_assigned', lastCycle.started_date)
        : Promise.resolve({ count: null as number | null }),
      supabase
        .from('quest_pools')
        .select('*')
        .neq('category', 'elite')
        .order('difficulty', { ascending: true }),
      lastCycle
        ? supabase
            .from('quest_selections')
            .select('quest_pool_id, quest_pools(upgrade_group)')
            .eq('user_id', user.id)
            .eq('cycle_number', lastCycle.cycle_number)
        : Promise.resolve({ data: null }),
    ])

    if (lastCycle) {
      cycleReport = {
        cycle: lastCycle,
        totalCompletions: completionsRes.count ?? 0,
        totalDaysActive: lastCycle.total_days_active,
        bestStreak: profile.best_streak,
        newCycleNumber: lastCycle.cycle_number + 1,
      }
    }

    const pools = poolsRes.data
    if (pools) {
      for (const pool of pools) {
        const cat = pool.category as string
        if (!questPoolsByCategory[cat]) questPoolsByCategory[cat] = []
        questPoolsByCategory[cat].push(pool as QuestPool)
      }
    }

    previousSelectionIds = (
      (prevSelsRes.data ?? []) as { quest_pool_id: string }[]
    ).map((s) => s.quest_pool_id)
  }

  // Expire stale cycles first (writes quest_selections), then run the rest in parallel
  await checkAndExpireCycles(user.id)

  // Quest generation + streak check + penalty fetch all in parallel
  const [ensureResult, penaltyQuestsRes] = await Promise.all([
    needsSelectionPhase
      ? Promise.resolve({ needsSelection: true as boolean, quests: [] as Quest[] })
      : ensureTodayQuests(user.id),
    supabase
      .from('penalty_quests')
      .select('*')
      .eq('user_id', user.id)
      .eq('date_assigned', today),
    needsSelectionPhase ? Promise.resolve() : checkDailyStreak(user.id),
  ])

  const quests = ensureResult.quests
  const penaltyQuests = (penaltyQuestsRes.data ?? []) as PenaltyQuest[]

  // ── Shield message — read once and clear immediately ──────────
  let shieldMessage: string | null = null
  if (profile.pending_system_message) {
    shieldMessage = profile.pending_system_message
    await supabase.from('users').update({ pending_system_message: null }).eq('id', user.id)
  }

  // ── Cycle metadata ────────────────────────────────────────────
  const currentCycleNumber = needsSelectionPhase
    ? (lastCycle?.cycle_number ?? 0) + 1
    : (activeSelections?.[0] as QuestSelection)?.cycle_number ?? 1

  const kaizenThreshold = getKaizenThreshold(currentCycleNumber)

  const cycleExpiresDate =
    !needsSelectionPhase && activeSelections?.[0]
      ? (activeSelections[0] as QuestSelection).expires_date
      : null

  const daysSinceJoin =
    Math.floor((new Date().getTime() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24)) + 1

  return (
    <DashboardClient
      profile={profile}
      stats={stats}
      quests={(quests ?? []) as Quest[]}
      penaltyQuests={penaltyQuests}
      dayCount={daysSinceJoin}
      monarchProgress={getMonarchProgress(profile.level)}
      needsSelectionPhase={needsSelectionPhase}
      isFirstCycle={isFirstCycle}
      cycleReport={cycleReport}
      questPoolsByCategory={questPoolsByCategory as Record<PoolCategory, QuestPool[]>}
      previousSelectionIds={previousSelectionIds}
      currentCycleNumber={currentCycleNumber}
      kaizenThreshold={kaizenThreshold}
      cycleExpiresDate={cycleExpiresDate}
      shieldMessage={shieldMessage}
    />
  )
}
