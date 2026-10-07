'use client'

import { useState } from 'react'
import { saveQuestSelections } from '@/app/actions/quests'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import { FormMessage } from '@/components/ui/Field'
import type { QuestPool, PoolCategory } from '@/lib/types'

// Accent colours are theme tokens passed as CSS values; tint() derives translucent fills from them.
const CATEGORY_CONFIG: {
  key: PoolCategory
  label: string
  description: string
  required: number
  color: string
}[] = [
  { key: 'lifestyle',  label: 'LIFESTYLE',  description: 'Daily habits & recovery',   required: 2, color: 'var(--color-primary)' },
  { key: 'physical',   label: 'PHYSICAL',   description: 'Body & movement',            required: 2, color: 'var(--color-secondary)' },
  { key: 'mental',     label: 'MENTAL',     description: 'Mind & learning',            required: 2, color: 'var(--color-success)' },
  { key: 'focus',      label: 'FOCUS',      description: 'Attention & deep work',      required: 2, color: 'var(--color-secondary-container)' },
  { key: 'bad_habits', label: 'BAD HABITS', description: 'One habit to eliminate',     required: 1, color: 'var(--color-tertiary)' },
]

const DIFFICULTY_LABEL: Record<string, string> = { small: 'EASY', medium: 'MED', hard: 'HARD', elite: 'ELITE' }
const DIFFICULTY_COLOR: Record<string, string> = {
  small: 'var(--color-on-surface-variant)',
  medium: 'var(--color-secondary)',
  hard: 'var(--color-tertiary)',
  elite: 'var(--color-primary)',
}

const tint = (color: string, percent: number) => `color-mix(in srgb, ${color} ${percent}%, transparent)`

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
    <main className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-outline-variant px-4 pb-4 pt-6">
        <p className="mb-1 font-mono text-xs tracking-[0.5em] text-on-surface-variant">
          CYCLE {cycleNumber} — SELECTION PHASE
        </p>
        <h1 className="font-display text-2xl font-bold tracking-wide text-on-surface">{currentCat.label}</h1>
        <p className="mt-0.5 font-mono text-xs text-on-surface-variant">
          {currentCat.description} · Pick {currentCat.required}
        </p>

        {/* Progress segments */}
        <div className="mt-4 flex gap-1.5" role="img" aria-label={`Category ${categoryIndex + 1} of ${CATEGORY_CONFIG.length}`}>
          {CATEGORY_CONFIG.map((c, i) => {
            const done = (selections[c.key]?.length ?? 0) === c.required
            const active = i === categoryIndex
            return (
              <div
                key={c.key}
                className="h-1 flex-1 rounded-full transition-all duration-300"
                style={{ background: done ? c.color : active ? tint(c.color, 40) : 'var(--color-outline-variant)' }}
              />
            )
          })}
        </div>
      </div>

      {/* Quest list */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-lg space-y-2.5">
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
                aria-pressed={selected}
                className={`card-gradient w-full border border-outline-variant p-4 text-left transition-all ${
                  maxReached ? 'cursor-not-allowed opacity-40' : ''
                }`}
                style={selected ? { borderColor: currentCat.color, background: tint(currentCat.color, 8) } : {}}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="font-body text-sm font-medium text-on-surface">{pool.title}</span>
                      {wasPrevious && !isUpgrade && (
                        <span className="bg-primary-container/30 px-1.5 py-0.5 font-mono text-xs tracking-widest text-primary">PREV</span>
                      )}
                      {isUpgrade && (
                        <span className="bg-secondary/20 px-1.5 py-0.5 font-mono text-xs tracking-widest text-secondary">↑ UPGRADE</span>
                      )}
                    </div>
                    {pool.description && (
                      <p className="font-body text-xs leading-relaxed text-on-surface-variant">{pool.description}</p>
                    )}
                  </div>
                  <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
                    <span
                      className="px-1.5 py-0.5 font-mono text-xs tracking-widest"
                      style={{ color: DIFFICULTY_COLOR[pool.difficulty], background: tint(DIFFICULTY_COLOR[pool.difficulty], 13) }}
                    >
                      {DIFFICULTY_LABEL[pool.difficulty]}
                    </span>
                    <span className="font-mono text-xs text-on-surface-variant">+{pool.xp_reward}</span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 border-t border-outline-variant px-4 pb-6 pt-3">
        {error && (
          <div className="mx-auto mb-3 max-w-lg">
            <FormMessage tone="error">{error}</FormMessage>
          </div>
        )}
        <div className="mx-auto flex max-w-lg gap-3">
          {categoryIndex > 0 && (
            <Button variant="outline" size="lg" onClick={() => setCategoryIndex((i) => i - 1)} disabled={submitting}>
              BACK
            </Button>
          )}

          <button
            onClick={handleNext}
            disabled={!canAdvance() || submitting}
            className="min-h-14 flex-1 border font-mono text-system-label tracking-widest transition-all disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              background: canAdvance() ? tint(currentCat.color, 13) : undefined,
              borderColor: canAdvance() ? currentCat.color : 'var(--color-outline-variant)',
              color: canAdvance() ? currentCat.color : 'var(--color-on-surface-variant)',
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
    </main>
  )
}
