'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { completeQuest, uncompleteQuest, ensureTodayQuests } from '@/app/actions/quests'
import { logout } from '@/app/actions/auth'
import { completePenaltyQuest } from '@/app/actions/penalty'
import { saveNotificationSubscription, sendTestPushNotification } from '@/app/actions/notifications'
import { registerServiceWorker, subscribeUserToPush } from '@/lib/notifications'
import { createClient as createBrowserClient } from '@/lib/supabase/client'
import CycleReport from './CycleReport'
import SelectionPhase from './SelectionPhase'
import LevelUpModal from './LevelUpModal'
import DailyCompletionSummary from './DailyCompletionSummary'
import PenaltyZone from './PenaltyZone'
import CompletionRing from './CompletionRing'
import StreakCard from './StreakCard'
import { getUTCDateString, getUTCYesterdayString } from '@/lib/date'
import type { UserProfile, Stats, Quest, QuestPool, CycleReportData, PoolCategory, PenaltyQuest } from '@/lib/types'

const STAT_LABELS: Record<string, string> = {
  strength: 'STR', focus: 'FOC', discipline: 'DIS', confidence: 'CON',
}
const STAT_COLORS: Record<string, string> = {
  strength: '#6CCBFF', focus: '#8EF0FF', discipline: '#A78BFA', confidence: '#F59E0B',
}

type HuntTab = 'all' | 'physical' | 'mental' | 'focus'

const CATEGORY_ICONS: Record<string, string> = {
  physical: 'directions_run',
  mental: 'menu_book',
  focus: 'my_location',
  discipline: 'gavel',
  lifestyle: 'home',
  bad_habits: 'block',
  elite: 'star',
}

function formatHuntDate(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}.${m}.${day}`
}

interface Props {
  profile: UserProfile
  stats: Stats | null
  quests: Quest[]
  penaltyQuests: PenaltyQuest[]
  dayCount: number
  monarchProgress: number
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
  profile, stats, quests, penaltyQuests, dayCount, monarchProgress,
  needsSelectionPhase, isFirstCycle, cycleReport, questPoolsByCategory,
  previousSelectionIds, currentCycleNumber, kaizenThreshold, cycleExpiresDate,
  shieldMessage,
}: Props) {
  const router = useRouter()
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
  const [activeTab, setActiveTab] = useState<HuntTab>('all')
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
  const [showNotificationBanner, setShowNotificationBanner] = useState(false)
  const [notificationStatus, setNotificationStatus] = useState('')
  const [isTestingNotification, setIsTestingNotification] = useState(false)
  const penaltyCheckRan = useRef(false)

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

  // ── Notification permission + SW setup ──────────────────────
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return

    // Debug: log SW and subscription status
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then((reg) => {
          console.log('[ASCEND] SW registered:', reg)
          console.log('[ASCEND] SW scope:', reg.scope)
          reg.pushManager.getSubscription().then((sub) => {
            console.log('[ASCEND] Push subscription:', sub ? 'EXISTS' : 'NONE')
            if (sub) console.log('[ASCEND] Subscription endpoint:', sub.endpoint)
          })
        })
        .catch((err) => console.error('[ASCEND] SW error:', err))
    }
    console.log('[ASCEND] Notification permission:', Notification.permission)

    if (Notification.permission === 'granted') {
      const timer = setTimeout(() => setNotificationsEnabled(true), 0)
      // Silently re-subscribe (handles reinstalls / new push keys)
      async function setup() {
        try {
          await registerServiceWorker()
          const sub = await subscribeUserToPush()
          if (sub) {
            const saved = await saveNotificationSubscription(sub.toJSON() as Record<string, unknown>)
            if (!saved.success) setNotificationStatus(saved.error ?? 'Subscription save failed.')
          }
        } catch {
          setNotificationStatus('Push setup failed. Use TEST PUSH to retry.')
        }
      }
      setup()
      return () => clearTimeout(timer)
    } else if (Notification.permission === 'default') {
      const timer = setTimeout(() => setShowNotificationBanner(true), 0)
      return () => clearTimeout(timer)
    }
  }, [])

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
      const midnight = new Date(now)
      midnight.setHours(24, 0, 0, 0)
      const diff = midnight.getTime() - now.getTime()
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

  const handleToggleQuest = useCallback((quest: Quest) => {
    if (processingIds.has(quest.id)) return
    addProcessing(quest.id)

    if (!quest.is_completed) {
      const capturedOldLevel = profile.level

      // ── 1. Instant UI updates — no awaiting, no blocking ──
      setQuestList((prev) => prev.map((q) => q.id === quest.id ? { ...q, is_completed: true } : q))
      setFlashQuestId(quest.id)
      setTimeout(() => setFlashQuestId(null), 900)

      // XP delta animation on identity card

      // Stat delta animation
      if (quest.stat_target && quest.stat_reward) {
        statAnimKey.current += 1
        setStatDelta({ stat: quest.stat_target, amount: quest.stat_reward, key: statAnimKey.current })
      }

      // System message
      if (msgTimer.current) clearTimeout(msgTimer.current)
      const statPart = quest.stat_target && quest.stat_reward
        ? `${quest.stat_target} +${quest.stat_reward}. `
        : ''
      setSystemMessage(`Quest complete. ${statPart}System has recorded your progress.`)
      msgTimer.current = setTimeout(() => {
        setSystemMessage(null)
        setStatDelta(null)
      }, 3200)

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

      uncompleteQuest(quest.id)
        .then(() => { removeProcessing(quest.id); router.refresh() })
        .catch(() => {
          removeProcessing(quest.id)
          setQuestList((prev) => prev.map((q) => q.id === quest.id ? { ...q, is_completed: true } : q))
        })
    }
  }, [processingIds, questList, kaizenThreshold, addProcessing, removeProcessing, profile, router])

  async function setupPushNotifications({
    requestPermission,
    refreshSubscription = false,
  }: {
    requestPermission: boolean
    refreshSubscription?: boolean
  }) {
    if (typeof window === 'undefined') throw new Error('Notifications unavailable.')
    if (!('Notification' in window)) throw new Error('Notifications are not supported on this browser.')
    if (!('serviceWorker' in navigator)) throw new Error('Service workers are not supported on this browser.')
    if (!('PushManager' in window)) throw new Error('Push notifications are not supported on this browser.')

    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      throw new Error('Push notifications require HTTPS.')
    }

    let permission = Notification.permission
    if (permission === 'default' && requestPermission) {
      permission = await Notification.requestPermission()
    }
    if (permission !== 'granted') {
      throw new Error(`Notification permission is ${permission}.`)
    }

    const registration = await registerServiceWorker()
    if (!registration) throw new Error('Service worker registration failed.')

    const sub = await subscribeUserToPush({ refresh: refreshSubscription })
    if (!sub) throw new Error('Push subscription failed. Check the VAPID public key.')

    const saved = await saveNotificationSubscription(sub.toJSON() as Record<string, unknown>)
    if (!saved.success) throw new Error(saved.error ?? 'Subscription save failed.')

    setNotificationsEnabled(true)
    setShowNotificationBanner(false)
    return sub
  }

  // ── Enable notifications from user gesture ──────────────────
  async function handleEnableNotifications() {
    try {
      setNotificationStatus('Preparing push channel...')
      console.log('[ASCEND] VAPID public key exists:', !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)
      console.log('[ASCEND] VAPID key starts with:', process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.substring(0, 20))

      const sub = await setupPushNotifications({ requestPermission: true })
      console.log('[ASCEND] Subscription ready:', sub.endpoint)
      setNotificationStatus('Push channel ready.')
    } catch (error) {
      console.error('[ASCEND] Notification setup error:', error)
      setNotificationStatus(error instanceof Error ? error.message : 'Notification setup failed.')
    }
  }

  async function handleTestPushNotification() {
    if (isTestingNotification) return
    setIsTestingNotification(true)
    setNotificationStatus('Refreshing phone push channel...')
    try {
      await setupPushNotifications({ requestPermission: true, refreshSubscription: true })
      setNotificationStatus('Sending test push...')
      const result = await sendTestPushNotification()
      if (!result.success) throw new Error(result.error ?? 'Test push failed.')
      setNotificationStatus('Test push sent. Lock the phone or watch for the banner.')
    } catch (error) {
      console.error('[ASCEND] Test push error:', error)
      setNotificationStatus(error instanceof Error ? error.message : 'Test push failed.')
    } finally {
      setIsTestingNotification(false)
    }
  }

  // ── Client-side daily penalty check (cron fallback) ─────────
  async function checkAndApplyDailyPenalty() {
    // Skip if already in penalty zone or in selection phase
    if (profile.penalty_zone_active || needsSelectionPhase) return
    // Skip brand-new accounts (< 2 days old) — nothing to penalise yet
    const daysSinceCreation = Math.floor(
      (Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24),
    )
    if (daysSinceCreation < 2) return
    const today = getUTCDateString()
    const yesterday = getUTCYesterdayString()
    // Skip if already active today (quests completed)
    if (profile.last_active_date === today) return

    const supabase = createBrowserClient()
    const { count } = await supabase
      .from('quests')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', profile.id)
      .eq('date_assigned', yesterday)
      .eq('is_completed', true)

    if (count === null) return // query failed — skip
    if (count > 0) return      // quests were completed yesterday — no penalty

    const newFailures = (profile.consecutive_failures ?? 0) + 1
    console.log('[ASCEND] Penalty check: consecutive_failures →', newFailures)

    const updates: Record<string, unknown> = { consecutive_failures: newFailures }

    if (newFailures >= 3) {
      updates.penalty_tier = 3
      updates.penalty_zone_active = true
      updates.penalty_zone_started_at = new Date().toISOString()
      console.log('[ASCEND] Penalty Zone activated')
    } else {
      updates.penalty_tier = newFailures >= 2 ? 2 : 1
    }

    await supabase.from('users').update(updates).eq('id', profile.id)
    router.refresh()
  }

  // Run penalty check once on mount
  useEffect(() => {
    if (penaltyCheckRan.current) return
    penaltyCheckRan.current = true
    checkAndApplyDailyPenalty()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
  const regularQuests = activeTab === 'all'
    ? allRegularQuests
    : activeTab === 'physical'
      ? allRegularQuests.filter((q) => q.category === 'physical')
      : activeTab === 'mental'
        ? allRegularQuests.filter((q) => ['mental', 'discipline', 'lifestyle', 'bad_habits'].includes(q.category))
        : allRegularQuests.filter((q) => q.category === 'focus')
  const eliteQuest = questList.find((q) => q.quest_type === 'elite')
  const isEliteLocked = profile.level < 6

  const pendingPenaltyQuest = penaltyQuestList.find((pq) => !pq.is_completed)
  const questsLocked = profile.penalty_tier === 2 && !!pendingPenaltyQuest

  // Penalty zone full-screen overlay (cannot dismiss)
  if (profile.penalty_zone_active && profile.penalty_zone_started_at) {
    return (
      <PenaltyZone
        startedAt={profile.penalty_zone_started_at}
        initialActiveTime={profile.penalty_zone_active_time ?? 0}
      />
    )
  }

  return (
    <div className="max-w-lg mx-auto">
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
            <div className="w-8 h-8 bg-primary-container flex items-center justify-center font-mono text-system-label text-on-primary-container">
              {(profile.hunter_name?.[0] ?? '?').toUpperCase()}
            </div>
            <span className="font-mono text-system-label text-secondary tracking-widest">SYSTEM ACTIVE</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-system-label text-on-surface-variant">DAY {dayCount}</span>
            <button onClick={() => logout()} className="font-mono text-system-label text-outline hover:text-on-surface transition-colors">
              EXIT
            </button>
          </div>
        </div>
      </header>

    <div className="space-y-4 pb-20">

      {/* Notification permission banner */}
      {showNotificationBanner && !notificationsEnabled && (
        <div className="mx-4 mt-4 card-gradient border border-primary-container p-4 flex items-center justify-between gap-4">
          <div>
            <div className="font-mono text-system-label text-secondary mb-1">ENABLE SYSTEM ALERTS</div>
            <p className="font-mono text-[10px] text-on-surface-variant">
              Allow notifications to receive quest reminders and penalty alerts.
            </p>
            {notificationStatus && (
              <p className="font-mono text-[10px] text-outline mt-2">{notificationStatus}</p>
            )}
          </div>
          <button
            onClick={handleEnableNotifications}
            className="px-4 py-2 bg-primary-container border border-[#6B3FD4] font-mono text-system-label text-on-primary-container uppercase tracking-widest whitespace-nowrap hover:shadow-[0_0_10px_#6CCBFF] transition-all text-[10px]"
          >
            ENABLE
          </button>
        </div>
      )}

      {notificationsEnabled && (
        <div className="mx-4 mt-4 card-gradient border border-secondary/30 p-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="font-mono text-system-label text-secondary mb-1">SYSTEM ALERTS ONLINE</div>
            <p className="font-mono text-[10px] text-outline truncate">
              {notificationStatus || 'Push channel ready.'}
            </p>
          </div>
          <button
            onClick={handleTestPushNotification}
            disabled={isTestingNotification}
            className="font-mono text-[10px] text-secondary border border-secondary/40 px-3 py-2 tracking-widest disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {isTestingNotification ? 'SENDING...' : 'TEST PUSH'}
          </button>
        </div>
      )}

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
            className="font-mono text-[10px] text-error border border-error/40 px-3 py-1"
          >
            TEST PENALTY ZONE
          </button>
        </div>
      )}

      {/* Identity card */}
      <section className="card-gradient border border-outline-variant p-6 relative overflow-hidden mx-4 mt-4">
        <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-primary opacity-50" />
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-primary opacity-50" />

        {/* Elite unlock banner inline */}
        {eliteUnlockBanner && (
          <div className="mb-4 p-3 bg-tertiary/10 border border-tertiary/40 flex items-center justify-between">
            <div>
              <p className="font-mono text-system-label text-tertiary">ELITE RANK REACHED</p>
              <p className="font-mono text-[10px] text-tertiary/60 mt-0.5 tracking-widest">ELITE QUESTS NOW ACTIVE</p>
            </div>
            <button onClick={() => setEliteUnlockBanner(false)} className="text-tertiary/40 hover:text-tertiary text-xs px-2 py-1">✕</button>
          </div>
        )}

        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-system-label text-secondary tracking-[0.3em]">CURRENT RANK</span>
            <div className="font-display text-[64px] leading-none text-primary level-glow font-bold">
              {profile.level}
            </div>
            <span className="font-mono text-system-label text-on-surface-variant">
              {profile.archetype} · {profile.rank} RANK
            </span>
          </div>
          <CompletionRing completed={completedCount} total={questList.length} minimum={kaizenThreshold} />
        </div>

        {/* XP bar */}
        <div className="mt-6">
          <div className="flex justify-between font-mono text-system-label mb-2 text-on-surface">
            <span>XP: {profile.current_xp} / {profile.xp_to_next_level}</span>
            <span className="text-secondary">{xpPercent}%</span>
          </div>
          <div className="h-1 bg-surface-container-high w-full relative">
            <div className="absolute top-0 left-0 h-full bg-secondary" style={{ width: `${xpPercent}%` }} />
          </div>
        </div>

        {/* Monarch bar */}
        <div className="mt-4 pt-4 border-t border-outline-variant/30">
          <div className="flex justify-between font-mono text-system-label mb-2">
            <span className="text-primary">MONARCH AWAKENING</span>
            <span className="text-primary">{monarchProgress}%</span>
          </div>
          <div className="h-1 bg-surface-container-high w-full">
            <div className="h-full bg-primary" style={{ width: `${Math.min(profile.level, 100)}%` }} />
          </div>
        </div>
      </section>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-2 px-4">
        {Object.entries(STAT_LABELS).map(([key, label]) => {
          const val = stats ? (stats as unknown as Record<string, number>)[key] : 0
          const isTargeted = statDelta && statDelta.stat === key
          return (
            <div key={key} className="relative card-gradient border border-outline-variant p-3 text-center">
              {isTargeted && (
                <span key={`stat-float-${statDelta.key}`} className="absolute -top-5 left-1/2 -translate-x-1/2 font-mono text-[11px] text-secondary font-bold float-up-fade">
                  +{statDelta.amount}
                </span>
              )}
              <p className="font-mono text-[9px] mb-1" style={{ color: STAT_COLORS[key] }}>{label}</p>
              <p className="font-display text-stat-value text-on-surface">{val}</p>
            </div>
          )
        })}
      </div>

      {/* Daily Hunt */}
      <section id="quests" className="px-4">
        {/* Header */}
        <div className="mb-4">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="font-display text-headline-md text-on-surface uppercase tracking-wider">DAILY HUNT</h2>
              <p className="font-mono text-system-label text-outline mt-0.5">
                {formatHuntDate()} {'//'} CYCLE {String(currentCycleNumber).padStart(3, '0')}
              </p>
            </div>
            <div className="flex items-center gap-3 mt-1">
              {completedCount > 0 && (
                <button onClick={() => setShowSummary(true)} className="font-mono text-system-label text-outline hover:text-secondary transition-colors">
                  REPORT
                </button>
              )}
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="font-mono text-system-label text-outline hover:text-secondary transition-colors disabled:cursor-not-allowed"
              >
                {isRefreshing ? <span className="inline-block w-2 h-2 rounded-full bg-current animate-pulse align-middle" /> : '↻'}
              </button>
            </div>
          </div>

          {/* Category tabs */}
          <div className="flex gap-2 mt-4">
            {(['all', 'physical', 'mental', 'focus'] as HuntTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`font-mono text-system-label tracking-widest uppercase px-3 py-1.5 border transition-colors ${
                  activeTab === tab
                    ? 'bg-primary-container border-primary-container text-on-primary-container'
                    : 'border-outline-variant text-outline hover:border-outline hover:text-on-surface'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="flex justify-between font-mono text-system-label mt-3">
            <span className="text-outline">RESETS IN {timeUntilReset}</span>
            <span className="text-outline">
              MIN: <span className="text-secondary">{kaizenThreshold}</span>
              {cycleExpiresDays !== null && <span> · {cycleExpiresDays}d LEFT</span>}
            </span>
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
          <div className={`flex flex-col gap-4 ${questsLocked ? 'opacity-40 pointer-events-none' : ''}`}>
            {regularQuests.length === 0 ? (
              <p className="text-center py-4 font-mono text-system-label text-outline tracking-widest">
                {activeTab === 'all' ? 'NO QUESTS — TAP ↻ TO SYNC' : `NO ${activeTab.toUpperCase()} QUESTS TODAY`}
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

      {/* Cycle info */}
      <div className="card-gradient border border-outline-variant p-4 mx-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-system-label text-on-surface-variant mb-1">CYCLE {currentCycleNumber}</p>
            <p className="font-mono text-[10px] text-outline">
              Kaizen: <span className="text-secondary">{kaizenThreshold}</span> quests/day for streak
            </p>
          </div>
          {cycleExpiresDays !== null && (
            <div className="text-right">
              <span className="font-display text-headline-md text-on-surface">{cycleExpiresDays}</span>
              <span className="font-mono text-system-label text-outline block">DAYS LEFT</span>
            </div>
          )}
        </div>
      </div>

      {/* Weekly Boss placeholder */}
      <div className="card-gradient border border-outline-variant p-5 mx-4 opacity-50">
        <div className="flex items-center gap-3 mb-2">
          <span className="material-symbols-outlined text-outline" style={{ fontSize: '16px' }}>lock</span>
          <p className="font-mono text-system-label text-on-surface-variant">WEEKLY BOSS</p>
          <span className="font-mono text-[10px] text-outline border border-outline-variant px-2 py-0.5 tracking-widest">LOCKED</span>
        </div>
        <p className="font-mono text-system-label text-outline">Elite challenges unlock at rank E.</p>
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
      {systemMessage && (
        <div className="fixed bottom-20 left-0 right-0 z-40 flex justify-center px-4 pointer-events-none">
          <div className="slide-up bg-surface-container border border-outline-variant px-4 py-3 max-w-sm w-full">
            <p className="font-mono text-system-label text-on-surface-variant leading-relaxed">
              &gt; {systemMessage}
            </p>
          </div>
        </div>
      )}
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
      className={`card-gradient border relative overflow-hidden p-4 flex flex-col gap-3 transition-all ${
        isFlashing
          ? 'quest-complete-flash'
          : quest.is_completed
            ? 'border-outline-variant opacity-60'
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
        <span className="material-symbols-outlined text-outline" style={{ fontSize: '22px', fontVariationSettings: "'FILL' 1" }}>
          {categoryIcon}
        </span>
      </div>

      {/* Title + description */}
      <div className="flex items-start gap-3">
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          <h3 className={`font-display text-stat-value text-on-surface uppercase ${quest.is_completed ? 'line-through text-on-surface-variant' : ''}`}>
            {quest.title}
          </h3>
          {quest.description && (
            <p className="font-body text-body-sm text-on-surface-variant leading-relaxed">{quest.description}</p>
          )}
        </div>
      </div>

      {/* Bottom row: XP earned or complete button */}
      {quest.is_completed ? (
        <div className="flex items-center justify-between">
          <div className="font-mono text-system-label text-secondary">+{quest.xp_reward} XP EARNED</div>
          <button
            onClick={onToggle}
            className="w-7 h-7 border bg-secondary/20 border-secondary flex items-center justify-center transition-all"
          >
            <span className="material-symbols-outlined text-secondary" style={{ fontSize: '14px' }}>check</span>
          </button>
        </div>
      ) : (
        <button
          onClick={onToggle}
          className="w-full border border-outline-variant/60 hover:border-secondary py-2 font-mono text-system-label text-outline hover:text-secondary transition-all flex items-center justify-center gap-2"
        >
          {processing
            ? <div className="w-3 h-3 rounded-full bg-primary-container animate-pulse" />
            : <>INITIATE</>
          }
        </button>
      )}

      {isFlashing && <span key={quest.id} className="xp-float">+{quest.xp_reward}</span>}
    </article>
  )
}

function QuestListSkeleton() {
  return (
    <div className="flex flex-col gap-4">
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
      <div className="card-gradient border border-outline-variant p-5 opacity-50">
        <div className="flex items-center gap-3 mb-2">
          <span className="material-symbols-outlined text-outline" style={{ fontSize: '16px' }}>lock</span>
          <p className="font-mono text-system-label text-on-surface-variant">ELITE QUEST</p>
          <span className="font-mono text-[10px] text-outline border border-outline-variant px-2 py-0.5 tracking-widest ml-auto">LOCKED</span>
        </div>
        <p className="font-mono text-system-label text-outline">Elite quest unlocks at E-Rank. Keep pushing.</p>
      </div>
    )
  }

  if (!quest) {
    return (
      <div className="card-gradient border border-outline-variant p-4 opacity-40">
        <p className="font-mono text-system-label text-outline tracking-widest">ELITE QUEST LOADING...</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-2 px-1">
        <span className="material-symbols-outlined text-tertiary" style={{ fontSize: '14px', fontVariationSettings: "'FILL' 1" }}>star</span>
        <p className="font-mono text-system-label text-tertiary">ELITE QUEST</p>
        <span className="font-mono text-[10px] text-tertiary/60 border border-tertiary/30 px-1.5 py-0.5 tracking-widest ml-auto">WEEKLY</span>
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
    <article className={`mb-4 card-gradient border border-error/40 relative overflow-hidden p-4 flex flex-col gap-3 ${quest.is_completed ? 'opacity-60' : ''}`}>
      {/* Critical penalty badge */}
      <div className="flex justify-between items-center">
        <span className="font-mono text-system-label text-error border border-error/50 bg-error/5 px-2 py-0.5">
          CRITICAL PENALTY
        </span>
        <span className="material-symbols-outlined text-error" style={{ fontSize: '22px', fontVariationSettings: "'FILL' 1" }}>
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
        <div className="font-mono text-system-label text-secondary">PENALTY CLEARED — +{quest.xp_reward} XP</div>
      ) : (
        <button
          onClick={onComplete}
          disabled={processing}
          className="w-full border border-error/60 hover:border-error bg-error/5 hover:bg-error/10 py-2 font-mono text-system-label text-error tracking-widest transition-all flex items-center justify-center gap-2"
        >
          {processing
            ? <div className="w-3 h-3 rounded-full bg-error animate-pulse" />
            : 'INITIATE'
          }
        </button>
      )}
    </article>
  )
}
