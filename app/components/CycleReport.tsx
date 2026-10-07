'use client'

import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import ProgressBar from '@/components/ui/ProgressBar'
import type { CycleReportData } from '@/lib/types'

interface Props {
  report: CycleReportData
  onContinue: () => void
}

// Tier colours are theme tokens passed as CSS values (they also feed a gradient fill).
const TIERS = [
  { min: 80, text: 'EXCEPTIONAL', color: 'var(--color-secondary)' },
  { min: 60, text: 'SOLID', color: 'var(--color-glow-cyan)' },
  { min: 40, text: 'DEVELOPING', color: 'var(--color-primary)' },
  { min: 0, text: 'NEEDS WORK', color: 'var(--color-tertiary)' },
]

export default function CycleReport({ report, onContinue }: Props) {
  const { cycle, totalCompletions, totalDaysActive, bestStreak, newCycleNumber } = report
  const possible = 21 * 9 // 9 quests × 21 days theoretical max
  const completionRate = Math.round((totalCompletions / possible) * 100)
  const tier = TIERS.find((t) => completionRate >= t.min)!

  return (
    <main className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-background p-4">
      <div className="w-full max-w-md py-8">
        <div className="fade-in-up mb-10 text-center">
          <p className="mb-3 font-mono text-xs tracking-[0.5em] text-on-surface-variant">CYCLE {cycle.cycle_number} COMPLETE</p>
          <h1 className="font-display text-4xl font-bold tracking-widest" style={{ color: tier.color }}>
            {tier.text}
          </h1>
          <div className="mt-3 h-px bg-gradient-to-r from-transparent via-primary-container to-transparent" />
        </div>

        <div className="fade-in-up mb-5 grid grid-cols-2 gap-3" style={{ animationDelay: '0.1s' }}>
          <Metric label="QUESTS COMPLETED" value={totalCompletions.toString()} sub={`of ~${possible} possible`} color="var(--color-glow-cyan)" />
          <Metric label="DAYS ACTIVE" value={totalDaysActive.toString()} sub="of 21 days" color="var(--color-primary)" />
          <Metric label="BEST STREAK" value={bestStreak.toString()} sub="days" color="var(--color-secondary)" />
          <Metric label="COMPLETION RATE" value={`${completionRate}%`} sub="of theoretical max" color={tier.color} />
        </div>

        <Card className="fade-in-up mb-5 p-4" style={{ animationDelay: '0.2s' }}>
          <div className="mb-2 flex justify-between font-mono text-xs tracking-widest text-on-surface-variant">
            <span>CYCLE PERFORMANCE</span>
            <span style={{ color: tier.color }}>{completionRate}%</span>
          </div>
          <ProgressBar
            label="Cycle performance"
            value={completionRate}
            fill={`linear-gradient(90deg, var(--color-primary-container), ${tier.color})`}
            className="h-2"
          />
        </Card>

        <Card className="fade-in-up mb-6 p-4" style={{ animationDelay: '0.3s' }}>
          <p className="mb-2 font-mono text-xs tracking-[0.3em] text-on-surface-variant">CYCLE {newCycleNumber} INCOMING</p>
          <p className="font-body text-sm leading-relaxed text-on-surface-variant">
            Select your next 21-day quest loadout. Harder quests are available — upgrade your selections to increase the challenge and unlock greater rewards.
          </p>
          {newCycleNumber >= 2 && (
            <p className="mt-3 flex items-center gap-2 font-mono text-xs text-secondary">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-secondary" />
              Streak threshold raised to {newCycleNumber === 2 ? 5 : newCycleNumber === 3 ? 6 : 7} quests per day
            </p>
          )}
        </Card>

        <div className="fade-in-up" style={{ animationDelay: '0.4s' }}>
          <Button size="lg" block onClick={onContinue}>
            BEGIN CYCLE {newCycleNumber}
          </Button>
        </div>
      </div>
    </main>
  )
}

function Metric({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <Card className="p-4">
      <p className="mb-2 font-mono text-xs tracking-widest text-on-surface-variant">{label}</p>
      <p className="font-display text-3xl font-bold" style={{ color }}>
        {value}
      </p>
      <p className="mt-1 font-mono text-xs text-on-surface-variant">{sub}</p>
    </Card>
  )
}
