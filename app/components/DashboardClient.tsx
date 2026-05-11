'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { completeQuest, uncompleteQuest } from '@/app/actions/quests'
import { logout } from '@/app/actions/auth'
import CycleReport from './CycleReport'
import SelectionPhase from './SelectionPhase'
import LevelUpModal from './LevelUpModal'
import DailyCompletionSummary from './DailyCompletionSummary'
import type { UserProfile, Stats, Quest, QuestPool, CycleReportData, PoolCategory } from '@/lib/types'

const STAT_LABELS: Record<string, string> = {
  strength: 'STR', focus: 'FOC', discipline: 'DIS', confidence: 'CON',
}
const STAT_COLORS: Record<string, string> = {
  strength: '#6CCBFF', focus: '#8EF0FF', discipline: '#A78BFA', confidence: '#F59E0B',
}
const CATEGORY_COLORS: Record<string, string> = {
  physical: '#6CCBFF', mental: '#34D399', discipline: '#A78BFA', elite: '#F59E0B',
  lifestyle: '#A78BFA', focus: '#8EF0FF', bad_habits: '#F59E0B',
}

interface Props {
  profile: UserProfile
  stats: Stats | null
  quests: Quest[]
  dayCount: number
  monarchProgress: number
  rankColor: string
  needsSelectionPhase: boolean
  isFirstCycle: boolean
  cycleReport: CycleReportData | null
  questPoolsByCategory: Record<PoolCategory, QuestPool[]>
  previousSelectionIds: string[]
  currentCycleNumber: number
  kaizenThreshold: number
  cycleExpiresDate: string | null
}

export default function DashboardClient({
  profile, stats, quests, dayCount, monarchProgress, rankColor,
  needsSelectionPhase, isFirstCycle, cycleReport, questPoolsByCategory,
  previousSelectionIds, currentCycleNumber, kaizenThreshold, cycleExpiresDate,
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
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [reportDismissed, setReportDismissed] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const summaryTriggeredRef = useRef(false)

  // Completion animation state
  const [flashQuestId, setFlashQuestId] = useState<string | null>(null)
  const [systemMessage, setSystemMessage] = useState<string | null>(null)
  const [statDelta, setStatDelta] = useState<{ stat: string; amount: number; key: number } | null>(null)
  const [xpDelta, setXpDelta] = useState<{ amount: number; key: number } | null>(null)
  const [localTotalXP, setLocalTotalXP] = useState(profile.total_xp)
  const [eliteUnlockBanner, setEliteUnlockBanner] = useState(false)
  const xpAnimKey = useRef(0)
  const statAnimKey = useRef(0)
  const msgTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { setQuestList(quests) }, [quests])
  useEffect(() => { setLocalTotalXP(profile.total_xp) }, [profile.total_xp])

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
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  async function handleToggleQuest(quest: Quest) {
    if (processingId) return
    setProcessingId(quest.id)
    const capturedOldLevel = profile.level

    if (!quest.is_completed) {
      // Optimistic complete + flash
      setQuestList((prev) => prev.map((q) => q.id === quest.id ? { ...q, is_completed: true } : q))
      setFlashQuestId(quest.id)
      setLocalTotalXP((prev) => prev + quest.xp_reward)

      const result = await completeQuest(quest.id)

      if (result.success) {
        // Clear flash after animation
        setTimeout(() => setFlashQuestId(null), 900)

        // XP floating delta
        xpAnimKey.current += 1
        setXpDelta({ amount: result.xpEarned!, key: xpAnimKey.current })

        // Stat floating delta
        if (result.statTarget && result.statReward) {
          statAnimKey.current += 1
          setStatDelta({ stat: result.statTarget, amount: result.statReward, key: statAnimKey.current })
        }

        // System message
        if (msgTimer.current) clearTimeout(msgTimer.current)
        const statPart = result.statTarget && result.statReward
          ? `${result.statTarget} +${result.statReward}. `
          : ''
        setSystemMessage(`Quest complete. ${statPart}System has recorded your progress.`)
        msgTimer.current = setTimeout(() => {
          setSystemMessage(null)
          setXpDelta(null)
          setStatDelta(null)
        }, 3200)

        // Auto-show daily summary when threshold first hit
        const newCompleted = questList.filter(q => q.id === quest.id ? true : q.is_completed).length
        if (newCompleted >= kaizenThreshold && !summaryTriggeredRef.current) {
          summaryTriggeredRef.current = true
          setTimeout(() => setShowSummary(true), 1400)
        }

        // Level-up modal (slight delay so flash finishes)
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
      } else {
        // Revert optimistic update
        setQuestList((prev) => prev.map((q) => q.id === quest.id ? { ...q, is_completed: false } : q))
        setLocalTotalXP((prev) => prev - quest.xp_reward)
        setFlashQuestId(null)
      }
    } else {
      setQuestList((prev) => prev.map((q) => q.id === quest.id ? { ...q, is_completed: false } : q))
      setLocalTotalXP((prev) => Math.max(0, prev - quest.xp_reward))
      await uncompleteQuest(quest.id)
    }

    setProcessingId(null)
    router.refresh()
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
    ? Math.max(0, Math.ceil((new Date(cycleExpiresDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null

  const regularQuests = questList.filter((q) => q.quest_type !== 'elite')
  const eliteQuest = questList.find((q) => q.quest_type === 'elite')
  const isEliteLocked = profile.level < 6

  return (
    <div className="max-w-lg mx-auto">
      {/* Cycle expiry warning banner */}
      {cycleExpiresDays !== null && cycleExpiresDays > 0 && cycleExpiresDays <= 3 && (
        <div
          className="px-4 py-2 text-center"
          style={{ borderBottom: '1px solid rgba(255,196,50,0.2)' }}
        >
          <p style={{ fontFamily: 'var(--font-share-tech-mono)', fontSize: '10px', color: '#ffc432' }}>
            Cycle ends in {cycleExpiresDays} day{cycleExpiresDays !== 1 ? 's' : ''}. Prepare for new selection.
          </p>
        </div>
      )}

    <div className="px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs tracking-[0.3em] text-text-secondary">DAY {dayCount}</p>
          <h1 className="text-2xl font-bold tracking-wide text-text-primary" style={{ fontFamily: 'var(--font-rajdhani)' }}>
            {profile.hunter_name}
          </h1>
        </div>
        <button onClick={() => logout()} className="text-text-secondary/40 hover:text-text-secondary p-2 transition-colors text-xs tracking-widest">
          EXIT
        </button>
      </div>

      {/* Elite unlock banner */}
      {eliteUnlockBanner && (
        <div className="elite-unlock-pulse bg-yellow-500/10 border border-yellow-500/40 rounded-sm p-3 flex items-center justify-between slide-up">
          <div>
            <p className="text-xs tracking-[0.3em] text-yellow-400 font-bold" style={{ fontFamily: 'var(--font-rajdhani)' }}>
              ELITE RANK REACHED
            </p>
            <p className="text-xs text-yellow-400/60 mt-0.5">ELITE QUESTS NOW ACTIVE</p>
          </div>
          <button onClick={() => setEliteUnlockBanner(false)} className="text-yellow-400/40 hover:text-yellow-400 text-xs px-2 py-1">
            ✕
          </button>
        </div>
      )}

      {/* Identity Card */}
      <div className="bg-card border border-border rounded-sm p-5 scan-line">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span
                className="rank-badge text-sm px-2 py-0.5 border rounded-sm"
                style={{ color: rankColor, borderColor: rankColor + '44', background: rankColor + '11' }}
              >
                RANK {profile.rank}
              </span>
              <span className="text-text-secondary text-xs tracking-widest">LVL {profile.level}</span>
            </div>
            <p className="text-text-secondary text-xs tracking-widest mt-1">{profile.archetype}</p>
          </div>
          <div className="text-right relative">
            <p className="text-xs text-text-secondary tracking-widest">TOTAL XP</p>
            <p
              className={`text-highlight-1 text-lg font-bold ${xpDelta ? 'xp-pop' : ''}`}
              key={xpDelta?.key}
              style={{ fontFamily: 'var(--font-rajdhani)' }}
            >
              {localTotalXP.toLocaleString()}
            </p>
            {xpDelta && (
              <span key={`xp-float-${xpDelta.key}`} className="absolute -top-5 right-0 text-xs text-green-400 font-bold float-up-fade">
                +{xpDelta.amount}
              </span>
            )}
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-text-secondary tracking-widest">
            <span>XP TO NEXT LEVEL</span>
            <span>{profile.current_xp} / {profile.xp_to_next_level}</span>
          </div>
          <div className="h-2 bg-bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full rounded-full xp-bar-fill transition-all duration-700"
              style={{ width: `${xpPercent}%`, background: 'linear-gradient(90deg, #4B2DBD, #6CCBFF)' }}
            />
          </div>
        </div>
      </div>

      {/* Monarch Bar */}
      <div className="bg-card border border-border rounded-sm p-4">
        <div className="flex justify-between items-center mb-2">
          <p className="text-xs tracking-[0.3em] text-text-secondary">MONARCH AWAKENING</p>
          <p className="text-xs text-highlight-2">{monarchProgress}%</p>
        </div>
        <div className="h-1 bg-bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${monarchProgress}%`,
              background: 'linear-gradient(90deg, #37207D, #8EF0FF)',
              boxShadow: monarchProgress > 0 ? '0 0 10px rgba(142,240,255,0.4)' : 'none',
            }}
          />
        </div>
        <p className="text-xs text-text-secondary/40 mt-1 text-right">{100 - profile.level} levels to Monarch</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-2">
        {Object.entries(STAT_LABELS).map(([key, label]) => {
          const val = stats ? (stats as unknown as Record<string, number>)[key] : 0
          const isTargeted = statDelta && statDelta.stat === key
          return (
            <div key={key} className="relative bg-card border border-border rounded-sm p-3 text-center">
              {isTargeted && (
                <span
                  key={`stat-float-${statDelta.key}`}
                  className="absolute -top-5 left-1/2 -translate-x-1/2 text-xs text-green-400 font-bold float-up-fade"
                >
                  +{statDelta.amount}
                </span>
              )}
              <p className="text-xs mb-1" style={{ color: STAT_COLORS[key] }}>{label}</p>
              <p className="text-lg font-bold text-text-primary" style={{ fontFamily: 'var(--font-rajdhani)' }}>{val}</p>
            </div>
          )
        })}
      </div>

      {/* Daily Hunt */}
      <div id="quests" className="bg-card border border-border rounded-sm p-5">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs tracking-[0.3em] text-text-secondary">DAILY HUNT</p>
          <div className="flex items-center gap-3">
            {completedCount > 0 && (
              <button
                onClick={() => setShowSummary(true)}
                className="text-xs tracking-widest hover:text-highlight-1 transition-colors"
                style={{ color: '#8D96B8', fontFamily: 'var(--font-share-tech-mono)' }}
              >
                VIEW REPORT
              </button>
            )}
            <p className="text-xs text-text-secondary">
              <span style={{ color: completedCount >= kaizenThreshold ? '#34D399' : '#6CCBFF' }}>
                {completedCount}
              </span>
              <span className="text-text-secondary/40"> / {questList.length}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-text-secondary/40">RESETS IN {timeUntilReset}</p>
          <p className="text-xs text-text-secondary/40">
            STREAK REQ: <span className="text-highlight-1">{kaizenThreshold}</span>
            {cycleExpiresDays !== null && (
              <span> · CYCLE ENDS: <span className="text-highlight-2">{cycleExpiresDays}d</span></span>
            )}
          </p>
        </div>

        <div className="space-y-2.5">
          {regularQuests.map((quest) => (
            <QuestCard
              key={quest.id}
              quest={quest}
              onToggle={() => handleToggleQuest(quest)}
              processing={processingId === quest.id}
              isFlashing={flashQuestId === quest.id}
            />
          ))}
        </div>
      </div>

      {/* Elite Quest */}
      <EliteQuestCard
        quest={eliteQuest ?? null}
        isLocked={isEliteLocked}
        processingId={processingId}
        flashQuestId={flashQuestId}
        onToggle={handleToggleQuest}
      />

      {/* Streak */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border border-border rounded-sm p-4">
          <p className="text-xs tracking-[0.3em] text-text-secondary mb-1">CURRENT STREAK</p>
          <p className="text-3xl font-bold text-highlight-1 text-glow" style={{ fontFamily: 'var(--font-rajdhani)' }}>
            {profile.current_streak}
          </p>
          <p className="text-xs text-text-secondary/40 mt-1">DAYS</p>
        </div>
        <div className="bg-card border border-border rounded-sm p-4">
          <p className="text-xs tracking-[0.3em] text-text-secondary mb-1">BEST STREAK</p>
          <p className="text-3xl font-bold text-text-primary" style={{ fontFamily: 'var(--font-rajdhani)' }}>
            {profile.best_streak}
          </p>
          <p className="text-xs text-text-secondary/40 mt-1">DAYS</p>
        </div>
      </div>

      {/* Cycle info */}
      <div className="bg-card border border-border rounded-sm p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs tracking-[0.3em] text-text-secondary mb-0.5">CYCLE {currentCycleNumber}</p>
            <p className="text-xs text-text-secondary/40">
              Kaizen threshold: complete <span className="text-highlight-1">{kaizenThreshold}</span> quests/day for streak
            </p>
          </div>
          {cycleExpiresDays !== null && (
            <p className="text-right">
              <span className="text-2xl font-bold text-text-primary" style={{ fontFamily: 'var(--font-rajdhani)' }}>
                {cycleExpiresDays}
              </span>
              <span className="text-xs text-text-secondary/40 block">DAYS LEFT</span>
            </p>
          )}
        </div>
      </div>

      {/* Weekly Boss placeholder */}
      <div className="bg-card border border-border rounded-sm p-5 opacity-60">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-2 h-2 rounded-full bg-text-secondary/20" />
          <p className="text-xs tracking-[0.3em] text-text-secondary">WEEKLY BOSS</p>
          <span className="text-xs text-text-secondary/40 border border-text-secondary/20 px-2 py-0.5 rounded-sm tracking-widest">
            LOCKED
          </span>
        </div>
        <p className="text-text-secondary/40 text-xs">Elite challenges unlock at rank E.</p>
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
          <div className="slide-up bg-bg-primary/95 border border-border/60 rounded-sm px-4 py-3 max-w-sm w-full">
            <p className="text-xs text-text-secondary/80 tracking-wide leading-relaxed" style={{ fontFamily: 'var(--font-share-tech-mono)' }}>
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
  )
}

// ── Sub-components ────────────────────────────────────────────

function QuestCard({
  quest, onToggle, processing, isFlashing,
}: {
  quest: Quest; onToggle: () => void; processing: boolean; isFlashing?: boolean
}) {
  const catColor = CATEGORY_COLORS[quest.category] ?? '#8D96B8'
  return (
    <div
      className={`flex items-center gap-3 p-3.5 border rounded-sm ${
        isFlashing
          ? 'quest-complete-flash'
          : quest.is_completed
            ? 'border-border/30 bg-bg-secondary/30 opacity-50'
            : 'border-border bg-bg-secondary hover:border-aura-primary/30 transition-all'
      }`}
    >
      <button
        onClick={onToggle}
        disabled={processing}
        className={`flex-shrink-0 w-5 h-5 rounded-sm border transition-all ${
          quest.is_completed ? 'bg-aura-primary border-aura-primary' : 'border-border hover:border-aura-primary'
        }`}
      >
        {quest.is_completed && !processing && (
          <svg viewBox="0 0 16 16" fill="none" className="w-full h-full p-0.5">
            <path d="M3 8l4 4 6-6" stroke="#E7ECFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        {processing && (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-aura-primary animate-pulse" />
          </div>
        )}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm text-text-primary truncate ${quest.is_completed ? 'line-through text-text-secondary' : ''}`}>
          {quest.title}
        </p>
        {quest.description && (
          <p className="text-xs text-text-secondary/60 truncate mt-0.5">{quest.description}</p>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="w-1.5 h-1.5 rounded-full" style={{ background: catColor }} />
        <span className="text-xs text-text-secondary/60">+{quest.xp_reward}</span>
      </div>
    </div>
  )
}

function EliteQuestCard({
  quest, isLocked, processingId, flashQuestId, onToggle,
}: {
  quest: Quest | null; isLocked: boolean; processingId: string | null
  flashQuestId: string | null; onToggle: (q: Quest) => void
}) {
  if (isLocked) {
    return (
      <div className="bg-card border border-border rounded-sm p-5 opacity-50">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-2 h-2 rounded-full bg-yellow-500/40" />
          <p className="text-xs tracking-[0.3em] text-text-secondary">ELITE QUEST</p>
          <span className="text-xs text-yellow-500/60 border border-yellow-500/20 px-2 py-0.5 rounded-sm tracking-widest">
            LOCKED
          </span>
        </div>
        <p className="text-text-secondary/40 text-xs">Elite quest unlocks at E-Rank. Keep pushing.</p>
      </div>
    )
  }

  if (!quest) {
    return (
      <div className="bg-card border border-border rounded-sm p-4 opacity-40">
        <p className="text-xs tracking-widest text-text-secondary/40">ELITE QUEST LOADING...</p>
      </div>
    )
  }

  return (
    <div className="bg-card border rounded-sm p-5" style={{ borderColor: '#F59E0B44' }}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
        <p className="text-xs tracking-[0.3em] text-yellow-500">ELITE QUEST</p>
        <span className="text-xs text-yellow-500/60 border border-yellow-500/20 px-1.5 py-0.5 rounded-sm tracking-widest ml-auto">
          WEEKLY
        </span>
      </div>
      <QuestCard
        quest={quest}
        onToggle={() => onToggle(quest)}
        processing={processingId === quest.id}
        isFlashing={flashQuestId === quest.id}
      />
    </div>
  )
}

