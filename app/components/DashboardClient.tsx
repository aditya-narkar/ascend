'use client'

import { useState, useEffect, useRef, useCallback, useReducer, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { completeQuest, uncompleteQuest, ensureTodayQuests } from '@/app/actions/quests'
import { completePenaltyQuest } from '@/app/actions/penalty'
import { createClient as createBrowserClient } from '@/lib/supabase/client'
import { gameDate, msUntilGameDayEnds } from '@/lib/date'
import { useNotifications } from '@/lib/useNotifications'
import CycleReport from './CycleReport'
import SelectionPhase from './SelectionPhase'
import LevelUpModal from './LevelUpModal'
import DailyCompletionSummary from './DailyCompletionSummary'
import PenaltyZone from './PenaltyZone'
import CompletionRing from './CompletionRing'
import StreakCard from './StreakCard'
import type { UserProfile, Stats, Quest, QuestPool, CycleReportData, PoolCategory, PenaltyQuest } from '@/lib/types'

const STAT_LABELS: Record<string, string> = {
  strength: 'STR', focus: 'FOC', discipline: 'DIS', confidence: 'CON',
}
const STAT_COLORS: Record<string, string> = {
  strength: '#6CCBFF', focus: '#8EF0FF', discipline: '#A78BFA', confidence: '#F59E0B',
}

// Filter chips are built from the categories actually present today.
const HUNT_TABS = [
  ['all', 'ALL'], ['physical', 'PHYSICAL'], ['mental', 'MENTAL'],
  ['focus', 'FOCUS'], ['lifestyle', 'LIFESTYLE'], ['bad_habits', 'HABITS'],
] as const

const CATEGORY_ICONS: Record<string, string> = {
  physical: 'directions_run',
  mental: 'menu_book',
  focus: 'my_location',
  discipline: 'gavel',
  lifestyle: 'home',
  bad_habits: 'block',
  elite: 'star',
}

const NUDGE_KEY = 'ascendAlertsNudgeDismissed'

function formatHuntDate(): string {
  return gameDate().replaceAll('-', '.')
}

interface Props {
  profile: UserProfile
  stats: Stats | null
  quests: Quest[]
  penaltyQuests: PenaltyQuest[]
  dayCount: number
  needsSelectionPhase: boolean
  isFirstCycle: boolean
  cycleReport: CycleReportData | null
  questPoolsByCategory: Record<PoolCategory, QuestPool[]>
  previousSelectionIds: string[]
  currentCycleNumber: number
  kaizenThreshold: number
  cycleExpiresDate: string | null
  shieldMessage?: string | null
}

export default function DashboardClient({
  profile, stats, quests, penaltyQuests, dayCount,
  needsSelectionPhase, isFirstCycle, cycleReport, questPoolsByCategory,
  previousSelectionIds, currentCycleNumber, kaizenThreshold, cycleExpiresDate,
  shieldMessage,
}: Props) {
  const router = useRouter()
  const push = useNotifications()
  const [questList, setQuestList] = useState<Quest[]>(quests)
  const [showLevelUpModal, setShowLevelUpModal] = useState(false)
  const [levelUpData, setLevelUpData] = useState<{
    oldLevel: number; newLevel: number
    oldRank: string; newRank: string
    rankChanged: boolean; eliteUnlocked: boolean
    statsGained: { stat: string; value: number }[]
  } | null>(null)
  const [timeUntilReset, setTimeUntilReset] = useState('')
  const [currentTimeMs, setCurrentTimeMs] = useState(() => new Date().getTime())
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())
  const [reportDismissed, setReportDismissed] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const summaryTriggeredRef = useRef(false)
  const [penaltyQuestList, setPenaltyQuestList] = useState<PenaltyQuest[]>(penaltyQuests)
  const [penaltyProcessingId, setPenaltyProcessingId] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isInitializing, setIsInitializing] = useState(quests.length === 0 && !needsSelectionPhase)
  const [activeTab, setActiveTab] = useState<string>('all')

  // ── Per-quest processing lock helpers ───────────────────────
  const addProcessing = useCallback((id: string) => {
    setProcessingIds((prev) => new Set([...prev, id]))
  }, [])
  const removeProcessing = useCallback((id: string) => {
    setProcessingIds((prev) => { const n = new Set(prev); n.delete(id); return n })
  }, [])

  // ── Realtime subscription for multi-device sync ──────────────
  useEffect(() => {
    const supabase = createBrowserClient()
    const channel = supabase
      .channel(`quests-sync-${profile.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'quests', filter: `user_id=eq.${profile.id}` },
        (payload) => {
          const updated = payload.new as unknown as Quest
          setQuestList((prev) =>
            prev.map((q) => (q.id === updated.id ? { ...q, ...updated } : q)),
          )
        },
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [profile.id])

  // Completion animation state
  const [flashQuestId, setFlashQuestId] = useState<string | null>(null)
  const [systemMessage, setSystemMessage] = useState<string | null>(null)
  const [statDelta, setStatDelta] = useState<{ stat: string; amount: number; key: number } | null>(null)
  const [eliteUnlockBanner, setEliteUnlockBanner] = useState(false)
  const statAnimKey = useRef(0)
  const msgTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync from server — but never wipe a non-empty local list with an empty response
  // (empty can occur during router.refresh() if the server had a generation race)
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuestList((prev) => quests.length > 0 ? quests : prev)
    }, 0)
    return () => clearTimeout(timer)
  }, [quests])

  // Auto-recover: if dashboard loaded with 0 quests and user has active selections,
  // trigger generation client-side and refresh — handles server-side timing races
  useEffect(() => {
    let cancelled = false
    const deferInitializing = (value: boolean) => {
      setTimeout(() => {
        if (!cancelled) setIsInitializing(value)
      }, 0)
    }

    if (quests.length > 0 || needsSelectionPhase) {
      deferInitializing(false)
      return () => { cancelled = true }
    }
    deferInitializing(true)
    ensureTodayQuests(profile.id)
      .then((result) => {
        if (cancelled) return
        if (result.quests.length > 0) setQuestList(result.quests)
        router.refresh()
      })
      .finally(() => deferInitializing(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // mount only — intentional

  useEffect(() => {
    function tick() {
      const now = new Date()
      const diff = msUntilGameDayEnds(now.getTime())
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setTimeUntilReset(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`)
      setCurrentTimeMs(now.getTime())
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  const showMessage = useCallback((message: string) => {
    if (msgTimer.current) clearTimeout(msgTimer.current)
    setSystemMessage(message)
    msgTimer.current = setTimeout(() => {
      setSystemMessage(null)
      setStatDelta(null)
    }, 3200)
  }, [])

  const handleToggleQuest = useCallback((quest: Quest) => {
    if (processingIds.has(quest.id)) return
    addProcessing(quest.id)

    if (!quest.is_completed) {
      const capturedOldLevel = profile.level

      // ── 1. Instant UI updates — no awaiting, no blocking ──
      setQuestList((prev) => prev.map((q) => q.id === quest.id ? { ...q, is_completed: true } : q))
      setFlashQuestId(quest.id)
      setTimeout(() => setFlashQuestId(null), 900)

      // Stat delta animation
      if (quest.stat_target && quest.stat_reward) {
        statAnimKey.current += 1
        setStatDelta({ stat: quest.stat_target, amount: quest.stat_reward, key: statAnimKey.current })
      }

      // System message
      const statPart = quest.stat_target && quest.stat_reward
        ? `${quest.stat_target} +${quest.stat_reward}. `
        : ''
      showMessage(`Quest complete. ${statPart}System has recorded your progress.`)

      // Daily summary auto-show when threshold first hit
      const newCompleted = questList.filter((q) => q.id === quest.id ? true : q.is_completed).length
      if (newCompleted >= kaizenThreshold && !summaryTriggeredRef.current) {
        summaryTriggeredRef.current = true
        setTimeout(() => setShowSummary(true), 1400)
      }

      // ── 2. Background server sync — user is never blocked by this ──
      completeQuest(quest.id)
        .then((result) => {
          removeProcessing(quest.id)
          if (!result.success) {
            setQuestList((prev) => prev.map((q) => q.id === quest.id ? { ...q, is_completed: false } : q))
          } else {
            if (result.leveledUp && result.newLevel && result.newRank) {
              setTimeout(() => {
                setLevelUpData({
                  oldLevel: capturedOldLevel,
                  newLevel: result.newLevel!,
                  oldRank: result.previousRank ?? 'F',
                  newRank: result.newRank!,
                  rankChanged: result.rankChanged ?? false,
                  eliteUnlocked: result.eliteUnlocked ?? false,
                  statsGained: result.statTarget && result.statReward != null
                    ? [{ stat: result.statTarget, value: result.statReward + 2 }]
                    : [],
                })
                setShowLevelUpModal(true)
              }, 600)
            }
            router.refresh()
          }
        })
        .catch(() => {
          removeProcessing(quest.id)
          setQuestList((prev) => prev.map((q) => q.id === quest.id ? { ...q, is_completed: false } : q))
        })
    } else {
      // Uncomplete: instant rollback, background sync
      setQuestList((prev) => prev.map((q) => q.id === quest.id ? { ...q, is_completed: false } : q))

      const rollback = (message?: string) => {
        removeProcessing(quest.id)
        setQuestList((prev) => prev.map((q) => q.id === quest.id ? { ...q, is_completed: true } : q))
        if (message) showMessage(message)
      }

      uncompleteQuest(quest.id)
        .then((result) => {
          if (!result.success) return rollback(result.error)
          removeProcessing(quest.id)
          router.refresh()
        })
        .catch(() => rollback())
    }
  }, [processingIds, questList, kaizenThreshold, addProcessing, removeProcessing, showMessage, profile, router])

  async function handleCompletePenaltyQuest(pq: PenaltyQuest) {
    if (penaltyProcessingId) return
    setPenaltyProcessingId(pq.id)
    setPenaltyQuestList((prev) => prev.map((q) => q.id === pq.id ? { ...q, is_completed: true } : q))
    await completePenaltyQuest(pq.id)
    setPenaltyProcessingId(null)
    router.refresh()
  }

  async function handleRefresh() {
    if (isRefreshing) return
    setIsRefreshing(true)
    try {
      const result = await ensureTodayQuests(profile.id)
      if (result.quests.length > 0) setQuestList(result.quests)
      router.refresh()
    } finally {
      setIsRefreshing(false)
    }
  }

  // ── Selection phase overlay ──────────────────────────────────
  const showCycleReport = needsSelectionPhase && cycleReport && !reportDismissed
  const showSelectionPhase = needsSelectionPhase && (isFirstCycle || reportDismissed || !cycleReport)

  if (showCycleReport) {
    return <CycleReport report={cycleReport!} onContinue={() => setReportDismissed(true)} />
  }

  if (showSelectionPhase) {
    return (
      <SelectionPhase
        cycleNumber={currentCycleNumber}
        questPoolsByCategory={questPoolsByCategory}
        previousSelectionIds={previousSelectionIds}
      />
    )
  }

  // Penalty zone full-screen overlay (cannot dismiss)
  if (profile.penalty_zone_active && profile.penalty_zone_started_at) {
    return (
      <PenaltyZone
        startedAt={profile.penalty_zone_started_at}
        initialActiveTime={profile.penalty_zone_active_time ?? 0}
      />
    )
  }

  // ── Normal dashboard ─────────────────────────────────────────
  const xpPercent = Math.min(100, Math.round((profile.current_xp / profile.xp_to_next_level) * 100))
  const completedQuests = questList.filter((q) => q.is_completed)
  const completedCount = completedQuests.length
  const xpEarnedToday = completedQuests.reduce((sum, q) => sum + q.xp_reward, 0)
  const statsGainedToday = Object.values(
    completedQuests.reduce<Record<string, { stat: string; amount: number }>>((acc, q) => {
      if (q.stat_target && q.stat_reward) {
        if (!acc[q.stat_target]) acc[q.stat_target] = { stat: q.stat_target, amount: 0 }
        acc[q.stat_target].amount += q.stat_reward
      }
      return acc
    }, {})
  )

  const cycleExpiresDays = cycleExpiresDate
    ? Math.max(0, Math.ceil((new Date(cycleExpiresDate).getTime() - currentTimeMs) / (1000 * 60 * 60 * 24)))
    : null

  const allRegularQuests = questList.filter((q) => q.quest_type !== 'elite')
  const presentCategories = new Set<string>(allRegularQuests.map((q) => q.category))
  const tabs = HUNT_TABS.filter(([key]) => key === 'all' || presentCategories.has(key))
  const tab = tabs.some(([key]) => key === activeTab) ? activeTab : 'all'
  const regularQuests = tab === 'all' ? allRegularQuests : allRegularQuests.filter((q) => q.category === tab)
  const eliteQuest = questList.find((q) => q.quest_type === 'elite')
  const isEliteLocked = profile.level < 6

  const pendingPenaltyQuest = penaltyQuestList.find((pq) => !pq.is_completed)
  const questsLocked = profile.penalty_tier === 2 && !!pendingPenaltyQuest

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="sr-only">Today</h1>

      {/* Penalty + cycle banners */}
      {profile.penalty_tier === 1 && (
        <div className="px-4 py-2 text-center bg-error-container/10 border-b border-error/30">
          <p className="font-mono text-system-label text-error">STAT PENALTY ACTIVE — Push harder today</p>
        </div>
      )}
      {profile.penalty_tier === 2 && pendingPenaltyQuest && (
        <div className="px-4 py-2 text-center bg-error-container/15 border-b border-error/40">
          <p className="font-mono text-system-label text-error">DEBT UNRESOLVED — Clear the penalty quest to continue</p>
        </div>
      )}
      {cycleExpiresDays !== null && cycleExpiresDays > 0 && cycleExpiresDays <= 3 && (
        <div className="px-4 py-2 text-center border-b border-tertiary/20">
          <p className="font-mono text-system-label text-tertiary">
            Cycle ends in {cycleExpiresDays} day{cycleExpiresDays !== 1 ? 's' : ''}. Prepare for new selection.
          </p>
        </div>
      )}

      {/* Sticky header */}
      <header className="bg-surface border-b border-outline-variant sticky top-0 z-40">
        <div className="flex justify-between items-center w-full px-4 py-2 h-14">
          <div className="flex items-center gap-3">
            <div aria-hidden="true" className="w-8 h-8 bg-primary-container flex items-center justify-center font-mono text-system-label text-on-primary-container">
              {(profile.hunter_name?.[0] ?? '?').toUpperCase()}
            </div>
            <span className="font-mono text-system-label text-secondary tracking-widest">SYSTEM ACTIVE</span>
          </div>
          <span className="font-mono text-system-label text-on-surface-variant">DAY {dayCount}</span>
        </div>
      </header>

      <div className="space-y-4 pb-20">

        <NotificationNudge show={push.availability === 'ok' && push.permission === 'default'} />

        {/* DEV: penalty zone trigger */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mx-4 flex gap-2 flex-wrap">
            <button
              onClick={async () => {
                const supabase = createBrowserClient()
                await supabase
                  .from('users')
                  .update({
                    consecutive_failures: 3,
                    penalty_tier: 3,
                    penalty_zone_active: true,
                    penalty_zone_started_at: new Date().toISOString(),
                  })
                  .eq('id', profile.id)
                window.location.reload()
              }}
              className="font-mono text-xs text-error border border-error/40 px-3 py-1"
            >
              TEST PENALTY ZONE
            </button>
          </div>
        )}

        {/* Today: progress ring + level in one compact card */}
        <section aria-label="Today's progress" className="card-gradient border border-outline-variant p-4 relative overflow-hidden mx-4 mt-4">
          <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-primary opacity-50" />
          <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-primary opacity-50" />

          {eliteUnlockBanner && (
            <div className="mb-4 p-3 bg-tertiary/10 border border-tertiary/40 flex items-center justify-between gap-2">
              <div>
                <p className="font-mono text-system-label text-tertiary">ELITE RANK REACHED</p>
                <p className="font-mono text-xs text-tertiary mt-0.5">Elite quests are now active.</p>
              </div>
              <button
                onClick={() => setEliteUnlockBanner(false)}
                aria-label="Dismiss"
                className="min-h-11 min-w-11 text-tertiary hover:text-on-surface"
              >
                <span aria-hidden="true">✕</span>
              </button>
            </div>
          )}

          <div className="flex items-center gap-4">
            <CompletionRing completed={completedCount} total={questList.length} minimum={kaizenThreshold} />
            <div className="flex-1 min-w-0">
              <p className="font-mono text-xs text-on-surface-variant">
                {profile.archetype} · {profile.rank} RANK
              </p>
              <p className="font-display text-[32px] leading-tight text-primary level-glow font-bold">
                LEVEL {profile.level}
              </p>
              <div className="mt-2 flex justify-between font-mono text-xs text-on-surface">
                <span>XP {profile.current_xp} / {profile.xp_to_next_level}</span>
                <span className="text-secondary">{xpPercent}%</span>
              </div>
              <div
                role="progressbar"
                aria-label="Experience to next level"
                aria-valuemin={0}
                aria-valuemax={profile.xp_to_next_level}
                aria-valuenow={profile.current_xp}
                className="mt-1 h-1 bg-surface-container-high w-full"
              >
                <div className="h-full bg-secondary" style={{ width: `${xpPercent}%` }} />
              </div>
              {timeUntilReset && (
                <p className="mt-2 font-mono text-xs text-outline">Day resets in {timeUntilReset}</p>
              )}
            </div>
          </div>
        </section>

        {/* Daily Hunt */}
        <section id="quests" aria-labelledby="hunt-heading" className="px-4">
          <div className="mb-4">
            <div className="flex justify-between items-start">
              <div>
                <h2 id="hunt-heading" className="font-display text-headline-md text-on-surface uppercase tracking-wider">DAILY HUNT</h2>
                <p className="font-mono text-system-label text-outline mt-0.5">
                  {formatHuntDate()} {'//'} CYCLE {String(currentCycleNumber).padStart(3, '0')}
                </p>
              </div>
              <div className="flex items-center">
                {completedCount > 0 && (
                  <button
                    onClick={() => setShowSummary(true)}
                    className="min-h-11 px-3 font-mono text-system-label text-outline hover:text-secondary transition-colors"
                  >
                    REPORT
                  </button>
                )}
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  aria-label="Refresh quests"
                  className="min-h-11 min-w-11 font-mono text-system-label text-outline hover:text-secondary transition-colors disabled:cursor-not-allowed"
                >
                  {isRefreshing
                    ? <span aria-hidden="true" className="inline-block w-2 h-2 rounded-full bg-current animate-pulse align-middle" />
                    : <span aria-hidden="true" className="material-symbols-outlined" style={{ fontSize: '20px' }}>refresh</span>}
                </button>
              </div>
            </div>

            <p className="mt-1 font-mono text-xs text-on-surface-variant">
              Complete <span className="text-secondary">{kaizenThreshold}</span> quests today to keep your streak.
              {cycleExpiresDays !== null && ` ${cycleExpiresDays}d left in this cycle.`}
            </p>

            {/* Category filter */}
            <div role="group" aria-label="Filter quests by category" className="flex gap-2 mt-3 overflow-x-auto [scrollbar-width:none]">
              {tabs.map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  aria-pressed={tab === key}
                  className={`min-h-11 shrink-0 font-mono text-system-label tracking-widest px-3 border transition-colors ${
                    tab === key
                      ? 'bg-primary-container border-primary-container text-on-primary-container'
                      : 'border-outline-variant text-on-surface-variant hover:border-outline hover:text-on-surface'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Penalty quests at top */}
          {penaltyQuestList.map((pq) => (
            <PenaltyQuestCard
              key={pq.id}
              quest={pq}
              processing={penaltyProcessingId === pq.id}
              onComplete={() => handleCompletePenaltyQuest(pq)}
            />
          ))}

          {isInitializing ? (
            <QuestListSkeleton />
          ) : (
            <div inert={questsLocked} className={`flex flex-col gap-3 ${questsLocked ? 'opacity-60' : ''}`}>
              {regularQuests.length === 0 ? (
                <p className="text-center py-4 font-mono text-system-label text-outline">
                  {tab === 'all' ? 'No quests yet today. Tap Refresh to load them.' : 'No quests in this category today.'}
                </p>
              ) : regularQuests.map((quest) => (
                <QuestCard
                  key={quest.id}
                  quest={quest}
                  onToggle={() => handleToggleQuest(quest)}
                  processing={processingIds.has(quest.id)}
                  isFlashing={flashQuestId === quest.id}
                />
              ))}
            </div>
          )}
        </section>

        {/* Elite Quest */}
        <div className="px-4">
          <EliteQuestCard
            quest={eliteQuest ?? null}
            isLocked={isEliteLocked}
            processingIds={processingIds}
            flashQuestId={flashQuestId}
            onToggle={handleToggleQuest}
          />
        </div>

        {/* Streak */}
        <div className="px-4">
          <StreakCard
            currentStreak={profile.current_streak}
            bestStreak={profile.best_streak}
            cycleDaysCompleted={profile.cycle_days_completed ?? 0}
            user={profile}
            shieldMessage={shieldMessage ?? undefined}
          />
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-4 gap-2 px-4">
          {Object.entries(STAT_LABELS).map(([key, label]) => {
            const val = stats ? (stats as unknown as Record<string, number>)[key] : 0
            const isTargeted = statDelta && statDelta.stat === key
            return (
              <div key={key} className="relative card-gradient border border-outline-variant p-3 text-center">
                {isTargeted && (
                  <span key={`stat-float-${statDelta.key}`} aria-hidden="true" className="absolute -top-5 left-1/2 -translate-x-1/2 font-mono text-xs text-secondary font-bold float-up-fade">
                    +{statDelta.amount}
                  </span>
                )}
                <p className="font-mono text-xs mb-1" style={{ color: STAT_COLORS[key] }}>
                  <span aria-hidden="true">{label}</span>
                  <span className="sr-only">{key}</span>
                </p>
                <p className="font-display text-stat-value text-on-surface">{val}</p>
              </div>
            )
          })}
        </div>

        {/* Level-up modal */}
        <LevelUpModal
          isOpen={showLevelUpModal}
          oldLevel={levelUpData?.oldLevel ?? 0}
          newLevel={levelUpData?.newLevel ?? 0}
          oldRank={levelUpData?.oldRank ?? 'F'}
          newRank={levelUpData?.newRank ?? 'F'}
          rankChanged={levelUpData?.rankChanged ?? false}
          eliteUnlocked={levelUpData?.eliteUnlocked ?? false}
          statsGained={levelUpData?.statsGained ?? []}
          onDismiss={() => {
            if (levelUpData?.eliteUnlocked) setEliteUnlockBanner(true)
            setShowLevelUpModal(false)
          }}
        />

        {/* System message */}
        <div role="status" aria-live="polite">
          {systemMessage && (
            <div className="fixed bottom-20 left-0 right-0 z-40 flex justify-center px-4 pointer-events-none">
              <div className="slide-up bg-surface-container border border-outline-variant px-4 py-3 max-w-sm w-full">
                <p className="font-mono text-system-label text-on-surface-variant leading-relaxed">
                  &gt; {systemMessage}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Daily completion summary overlay */}
        <DailyCompletionSummary
          isOpen={showSummary}
          dayNumber={dayCount}
          xpEarned={xpEarnedToday}
          statsGained={statsGainedToday}
          completedCount={completedCount}
          totalQuests={questList.length}
          kaizenThreshold={kaizenThreshold}
          currentStreak={profile.current_streak}
          onDismiss={() => setShowSummary(false)}
        />
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────

// Slim prompt to turn on reminders; the full controls live on the Profile page.
function NotificationNudge({ show }: { show: boolean }) {
  const [, rerender] = useReducer((n: number) => n + 1, 0)
  const dismissed = useSyncExternalStore(
    () => () => {},
    () => { try { return localStorage.getItem(NUDGE_KEY) === '1' } catch { return true } },
    () => true,
  )
  if (!show || dismissed) return null

  return (
    <div className="mx-4 mt-4 flex items-center border border-secondary/40 bg-secondary/5 pl-3">
      <Link href="/profile#alerts" className="flex-1 py-3 font-mono text-xs text-secondary">
        Turn on quest reminders →
      </Link>
      <button
        onClick={() => {
          try { localStorage.setItem(NUDGE_KEY, '1') } catch {}
          rerender()
        }}
        aria-label="Dismiss reminder prompt"
        className="min-h-11 min-w-11 text-outline hover:text-on-surface"
      >
        <span aria-hidden="true">✕</span>
      </button>
    </div>
  )
}

function QuestCard({
  quest, onToggle, processing, isFlashing,
}: {
  quest: Quest; onToggle: () => void; processing: boolean; isFlashing?: boolean
}) {
  const difficultyLabel =
    quest.quest_type === 'elite' ? 'ELITE'
    : quest.xp_reward >= 100 ? 'HARD'
    : quest.xp_reward >= 60  ? 'MEDIUM'
    : 'EASY'

  const badgeClass =
    quest.quest_type === 'elite'
      ? 'text-tertiary border-tertiary/50 bg-tertiary/5'
      : quest.xp_reward >= 100
        ? 'text-error border-error/50 bg-error/5'
        : quest.xp_reward >= 60
          ? 'text-tertiary border-tertiary/40 bg-tertiary/5'
          : 'text-secondary border-secondary/50 bg-secondary/5'

  const categoryIcon = CATEGORY_ICONS[quest.category] ?? 'radio_button_checked'

  return (
    <article
      aria-busy={processing}
      className={`card-gradient border relative overflow-hidden p-4 flex flex-col gap-3 transition-all ${
        isFlashing
          ? 'quest-complete-flash'
          : quest.is_completed
            ? 'border-outline-variant'
            : quest.quest_type === 'elite'
              ? 'border-tertiary/40 hover:border-tertiary/70'
              : 'border-outline-variant hover:border-primary-container'
      }`}
    >
      {/* Top row: difficulty badge + icon */}
      <div className="flex justify-between items-center">
        <span className={`font-mono text-system-label border px-2 py-0.5 ${badgeClass}`}>
          {difficultyLabel}
        </span>
        <span aria-hidden="true" className="material-symbols-outlined text-outline" style={{ fontSize: '22px', fontVariationSettings: "'FILL' 1" }}>
          {categoryIcon}
        </span>
      </div>

      {/* Title + description */}
      <div className="flex flex-col gap-1 min-w-0">
        <h3 className={`font-display text-stat-value uppercase ${quest.is_completed ? 'line-through text-on-surface-variant' : 'text-on-surface'}`}>
          {quest.title}
        </h3>
        {quest.description && (
          <p className="font-body text-body-sm text-on-surface-variant leading-relaxed">{quest.description}</p>
        )}
      </div>

      {/* Bottom row: XP earned + undo, or complete button */}
      {quest.is_completed ? (
        <div className="flex items-center justify-between">
          <p className="font-mono text-system-label text-secondary">
            <span aria-hidden="true" className="material-symbols-outlined align-middle mr-1" style={{ fontSize: '16px' }}>check_circle</span>
            +{quest.xp_reward} XP EARNED
          </p>
          <button
            onClick={onToggle}
            disabled={processing}
            aria-label={`Undo: ${quest.title}`}
            className="min-h-11 px-3 border border-outline-variant font-mono text-system-label text-on-surface-variant hover:border-outline hover:text-on-surface transition-colors disabled:opacity-60"
          >
            UNDO
          </button>
        </div>
      ) : (
        <button
          onClick={onToggle}
          disabled={processing}
          aria-label={`Mark done: ${quest.title}`}
          className="w-full min-h-11 border border-outline hover:border-secondary font-mono text-system-label text-on-surface hover:text-secondary transition-all flex items-center justify-center gap-2"
        >
          {processing
            ? <span aria-hidden="true" className="w-3 h-3 rounded-full bg-primary-container animate-pulse" />
            : 'MARK DONE'
          }
        </button>
      )}

      {isFlashing && <span key={quest.id} aria-hidden="true" className="xp-float">+{quest.xp_reward}</span>}
    </article>
  )
}

function QuestListSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading quests">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-20 card-gradient border border-outline-variant animate-pulse" style={{ animationDelay: `${i * 0.1}s` }} />
      ))}
    </div>
  )
}

function EliteQuestCard({
  quest, isLocked, processingIds, flashQuestId, onToggle,
}: {
  quest: Quest | null; isLocked: boolean; processingIds: Set<string>
  flashQuestId: string | null; onToggle: (q: Quest) => void
}) {
  if (isLocked) {
    return (
      <div className="card-gradient border border-dashed border-outline-variant p-4">
        <div className="flex items-center gap-3 mb-1">
          <span aria-hidden="true" className="material-symbols-outlined text-outline" style={{ fontSize: '16px' }}>lock</span>
          <h3 className="font-mono text-system-label text-on-surface-variant">ELITE QUEST</h3>
          <span className="font-mono text-xs text-outline border border-outline-variant px-2 py-0.5 tracking-widest ml-auto">LOCKED</span>
        </div>
        <p className="font-mono text-xs text-outline">Unlocks at level 6 (E-Rank). Keep going.</p>
      </div>
    )
  }

  if (!quest) {
    return (
      <div className="card-gradient border border-dashed border-outline-variant p-4">
        <p className="font-mono text-xs text-outline">No elite quest assigned yet. It appears with your next daily hunt.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-2 px-1">
        <span aria-hidden="true" className="material-symbols-outlined text-tertiary" style={{ fontSize: '14px', fontVariationSettings: "'FILL' 1" }}>star</span>
        <h3 className="font-mono text-system-label text-tertiary">ELITE QUEST</h3>
        <span className="font-mono text-xs text-tertiary border border-tertiary/30 px-1.5 py-0.5 tracking-widest ml-auto">WEEKLY</span>
      </div>
      <QuestCard
        quest={quest}
        onToggle={() => onToggle(quest)}
        processing={processingIds.has(quest.id)}
        isFlashing={flashQuestId === quest.id}
      />
    </div>
  )
}

function PenaltyQuestCard({
  quest,
  processing,
  onComplete,
}: {
  quest: PenaltyQuest
  processing: boolean
  onComplete: () => void
}) {
  return (
    <article className="mb-4 card-gradient border border-error/40 relative overflow-hidden p-4 flex flex-col gap-3">
      {/* Critical penalty badge */}
      <div className="flex justify-between items-center">
        <span className="font-mono text-system-label text-error border border-error/50 bg-error/5 px-2 py-0.5">
          CRITICAL PENALTY
        </span>
        <span aria-hidden="true" className="material-symbols-outlined text-error" style={{ fontSize: '22px', fontVariationSettings: "'FILL' 1" }}>
          warning
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <h3 className={`font-display text-stat-value text-error uppercase ${quest.is_completed ? 'line-through' : ''}`}>
          SITREP: {quest.title}
        </h3>
        {quest.description && (
          <p className="font-body text-body-sm text-on-surface-variant leading-relaxed">{quest.description}</p>
        )}
      </div>

      {quest.is_completed ? (
        <p className="font-mono text-system-label text-secondary">PENALTY CLEARED — +{quest.xp_reward} XP</p>
      ) : (
        <button
          onClick={onComplete}
          disabled={processing}
          aria-label={`Complete penalty: ${quest.title}`}
          className="w-full min-h-11 border border-error/60 hover:border-error bg-error/5 hover:bg-error/10 font-mono text-system-label text-error tracking-widest transition-all flex items-center justify-center gap-2"
        >
          {processing
            ? <span aria-hidden="true" className="w-3 h-3 rounded-full bg-error animate-pulse" />
            : 'COMPLETE PENALTY'
          }
        </button>
      )}
    </article>
  )
}
