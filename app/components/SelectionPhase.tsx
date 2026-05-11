'use client'

import { useState, useEffect } from 'react'
import { saveQuestSelections } from '@/app/actions/quests'
import { useRouter } from 'next/navigation'
import type { QuestPool, PoolCategory } from '@/lib/types'

const CATEGORY_CONFIG: {
  key: PoolCategory
  label: string
  description: string
  required: number
  color: string
}[] = [
  { key: 'lifestyle',  label: 'LIFESTYLE',  description: 'Daily habits & recovery',   required: 2, color: '#A78BFA' },
  { key: 'physical',   label: 'PHYSICAL',   description: 'Body & movement',            required: 2, color: '#6CCBFF' },
  { key: 'mental',     label: 'MENTAL',     description: 'Mind & learning',            required: 2, color: '#34D399' },
  { key: 'focus',      label: 'FOCUS',      description: 'Attention & deep work',      required: 2, color: '#8EF0FF' },
  { key: 'bad_habits', label: 'BAD HABITS', description: 'One habit to eliminate',     required: 1, color: '#F59E0B' },
]

const DIFFICULTY_LABEL: Record<string, string> = { small: 'EASY', medium: 'MED', hard: 'HARD', elite: 'ELITE' }
const DIFFICULTY_COLOR: Record<string, string> = {
  small: '#8D96B8', medium: '#6CCBFF', hard: '#F59E0B', elite: '#EC4899',
}

interface Props {
  cycleNumber: number
  questPoolsByCategory: Record<PoolCategory, QuestPool[]>
  previousSelectionIds: string[]
}

export default function SelectionPhase({ cycleNumber, questPoolsByCategory, previousSelectionIds }: Props) {
  const router = useRouter()
  const [categoryIndex, setCategoryIndex] = useState(0)
  const [selections, setSelections] = useState<Record<PoolCategory, string[]>>({
    lifestyle: [], physical: [], mental: [], focus: [], bad_habits: [], elite: [],
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // ── Bounds check — should never render with an out-of-range index ──
  if (categoryIndex >= CATEGORY_CONFIG.length) {
    handleComplete()
    return (
      <div className="fixed inset-0 z-[100] bg-bg-primary flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto border border-aura-primary/50 rounded-full flex items-center justify-center mb-4">
            <div className="w-2 h-2 rounded-full bg-highlight-1 animate-pulse" />
          </div>
          <p className="text-xs tracking-[0.4em] text-text-secondary">LOCKING IN CYCLE {cycleNumber}...</p>
        </div>
      </div>
    )
  }

  const currentCat = CATEGORY_CONFIG[categoryIndex]
  const currentPools = questPoolsByCategory[currentCat.key] ?? []
  const currentSelected = selections[currentCat.key] ?? []
  const isLastCategory = categoryIndex === CATEGORY_CONFIG.length - 1

  function toggleSelection(poolId: string) {
    const cat = currentCat.key
    const current = selections[cat] ?? []
    if (current.includes(poolId)) {
      setSelections((prev) => ({ ...prev, [cat]: current.filter((id) => id !== poolId) }))
    } else if (current.length < currentCat.required) {
      setSelections((prev) => ({ ...prev, [cat]: [...current, poolId] }))
    }
  }

  function canAdvance() {
    return currentSelected.length === currentCat.required
  }

  async function handleComplete() {
    if (submitting) return
    setSubmitting(true)
    setError('')

    const rows = CATEGORY_CONFIG.flatMap((c) =>
      (selections[c.key] ?? []).map((id) => ({ quest_pool_id: id, category: c.key }))
    )

    const result = await saveQuestSelections(rows)
    if (result?.error) {
      setError(result.error)
      setSubmitting(false)
      // Pull index back so user sees the UI instead of the loading screen
      setCategoryIndex(CATEGORY_CONFIG.length - 1)
      return
    }

    router.refresh()
  }

  function handleNext() {
    if (!canAdvance()) return
    if (isLastCategory) {
      handleComplete()
    } else {
      setCategoryIndex((i) => i + 1)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-bg-primary flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-4 pt-6 pb-4 border-b border-border">
        <p className="text-xs tracking-[0.5em] text-text-secondary mb-1">
          CYCLE {cycleNumber} — SELECTION PHASE
        </p>
        <h1
          className="text-2xl font-bold text-text-primary tracking-wide"
          style={{ fontFamily: 'var(--font-rajdhani)' }}
        >
          {currentCat.label}
        </h1>
        <p className="text-xs text-text-secondary/60 mt-0.5">
          {currentCat.description} · Pick {currentCat.required}
        </p>

        {/* Progress bar */}
        <div className="flex gap-1.5 mt-4">
          {CATEGORY_CONFIG.map((c, i) => {
            const done = (selections[c.key]?.length ?? 0) === c.required
            const active = i === categoryIndex
            return (
              <div
                key={c.key}
                className="h-1 flex-1 rounded-full transition-all duration-300"
                style={{ background: done ? c.color : active ? c.color + '66' : '#1A2035' }}
              />
            )
          })}
        </div>
      </div>

      {/* Quest list */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-2.5 max-w-lg mx-auto">
          {currentPools.map((pool) => {
            const selected = currentSelected.includes(pool.id)
            const maxReached = !selected && currentSelected.length >= currentCat.required
            const wasPrevious = previousSelectionIds.includes(pool.id)
            const isUpgrade =
              cycleNumber > 1 &&
              pool.upgrade_group &&
              pool.difficulty === 'medium' &&
              currentPools.some(
                (p) =>
                  p.upgrade_group === pool.upgrade_group &&
                  p.difficulty === 'small' &&
                  previousSelectionIds.includes(p.id)
              )

            return (
              <button
                key={pool.id}
                onClick={() => toggleSelection(pool.id)}
                disabled={maxReached}
                className={`w-full text-left p-4 border rounded-sm transition-all ${
                  maxReached ? 'border-border opacity-30 cursor-not-allowed' : 'border-border bg-card'
                }`}
                style={selected ? { borderColor: currentCat.color, background: currentCat.color + '15' } : {}}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm text-text-primary font-medium">{pool.title}</span>
                      {wasPrevious && !isUpgrade && (
                        <span className="text-xs px-1.5 py-0.5 rounded-sm bg-aura-primary/20 text-aura-primary/80 tracking-widest">
                          PREV
                        </span>
                      )}
                      {isUpgrade && (
                        <span className="text-xs px-1.5 py-0.5 rounded-sm bg-highlight-1/20 text-highlight-1 tracking-widest">
                          ↑ UPGRADE
                        </span>
                      )}
                    </div>
                    {pool.description && (
                      <p className="text-xs text-text-secondary/60 leading-relaxed">{pool.description}</p>
                    )}
                  </div>
                  <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                    <span
                      className="text-xs px-1.5 py-0.5 rounded-sm tracking-widest"
                      style={{
                        color: DIFFICULTY_COLOR[pool.difficulty],
                        background: DIFFICULTY_COLOR[pool.difficulty] + '22',
                      }}
                    >
                      {DIFFICULTY_LABEL[pool.difficulty]}
                    </span>
                    <span className="text-xs text-text-secondary/50">+{pool.xp_reward}</span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 px-4 pb-6 pt-3 border-t border-border">
        {error && (
          <p className="text-xs text-red-400 mb-3 px-3 py-2 border border-red-400/20 bg-red-400/5 rounded-sm max-w-lg mx-auto">
            {error}
          </p>
        )}
        <div className="max-w-lg mx-auto flex gap-3">
          {categoryIndex > 0 && (
            <button
              onClick={() => setCategoryIndex((i) => i - 1)}
              disabled={submitting}
              className="px-5 py-3 border border-border text-text-secondary hover:text-text-primary hover:border-text-secondary/40 rounded-sm text-xs tracking-widest transition-colors disabled:opacity-30"
            >
              BACK
            </button>
          )}

          <button
            onClick={handleNext}
            disabled={!canAdvance() || submitting}
            className="flex-1 py-3 font-semibold tracking-widest rounded-sm text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              fontFamily: 'var(--font-rajdhani)',
              background: canAdvance() ? currentCat.color + '22' : undefined,
              borderWidth: 1,
              borderStyle: 'solid',
              borderColor: canAdvance() ? currentCat.color : '#1A2035',
              color: canAdvance() ? currentCat.color : '#8D96B8',
            }}
          >
            {submitting
              ? 'LOCKING IN...'
              : `${currentSelected.length} / ${currentCat.required} — ${
                  canAdvance() ? (isLastCategory ? `LOCK CYCLE ${cycleNumber}` : 'NEXT') : 'SELECT ALL'
                }`}
          </button>
        </div>
      </div>
    </div>
  )
}
