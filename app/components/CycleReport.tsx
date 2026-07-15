'use client'

import type { CycleReportData } from '@/lib/types'

interface Props {
  report: CycleReportData
  onContinue: () => void
}

export default function CycleReport({ report, onContinue }: Props) {
  const { cycle, totalCompletions, totalDaysActive, bestStreak, newCycleNumber } = report
  const possible = 21 * 9 // 9 quests × 21 days theoretical max
  const completionRate = Math.round((totalCompletions / possible) * 100)

  const performanceLabel =
    completionRate >= 80
      ? { text: 'EXCEPTIONAL', color: '#8EF0FF' }
      : completionRate >= 60
      ? { text: 'SOLID', color: '#6CCBFF' }
      : completionRate >= 40
      ? { text: 'DEVELOPING', color: '#A78BFA' }
      : { text: 'NEEDS WORK', color: '#F59E0B' }

  return (
    <div className="fixed inset-0 z-[100] bg-bg-primary flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-md py-8">
        {/* Header */}
        <div className="text-center mb-10 fade-in-up">
          <p className="text-xs tracking-[0.5em] text-text-secondary mb-3">CYCLE {cycle.cycle_number} COMPLETE</p>
          <h1
            className="text-4xl font-bold tracking-widest"
            style={{ fontFamily: 'var(--font-rajdhani)', color: performanceLabel.color }}
          >
            {performanceLabel.text}
          </h1>
          <div className="mt-3 h-px bg-gradient-to-r from-transparent via-aura-primary to-transparent" />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-5 fade-in-up" style={{ animationDelay: '0.1s' }}>
          <MetricCard
            label="QUESTS COMPLETED"
            value={totalCompletions.toString()}
            sub={`of ~${possible} possible`}
            color="#6CCBFF"
          />
          <MetricCard
            label="DAYS ACTIVE"
            value={totalDaysActive.toString()}
            sub="of 21 days"
            color="#A78BFA"
          />
          <MetricCard
            label="BEST STREAK"
            value={bestStreak.toString()}
            sub="days"
            color="#8EF0FF"
          />
          <MetricCard
            label="COMPLETION RATE"
            value={`${completionRate}%`}
            sub="of theoretical max"
            color={performanceLabel.color}
          />
        </div>

        {/* Cycle progress bar */}
        <div className="bg-card border border-border rounded-sm p-4 mb-5 fade-in-up" style={{ animationDelay: '0.2s' }}>
          <div className="flex justify-between text-xs text-text-secondary mb-2 tracking-widest">
            <span>CYCLE PERFORMANCE</span>
            <span style={{ color: performanceLabel.color }}>{completionRate}%</span>
          </div>
          <div className="h-2 bg-bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{
                width: `${completionRate}%`,
                background: `linear-gradient(90deg, #4B2DBD, ${performanceLabel.color})`,
                boxShadow: `0 0 10px ${performanceLabel.color}44`,
              }}
            />
          </div>
        </div>

        {/* Next cycle info */}
        <div className="bg-card border border-border/60 rounded-sm p-4 mb-6 fade-in-up" style={{ animationDelay: '0.3s' }}>
          <p className="text-xs tracking-[0.3em] text-text-secondary mb-2">CYCLE {newCycleNumber} INCOMING</p>
          <p className="text-text-secondary text-xs leading-relaxed">
            Select your next 21-day quest loadout. Harder quests are available — upgrade your selections to increase the challenge and unlock greater rewards.
          </p>
          {newCycleNumber >= 2 && (
            <div className="mt-3 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-highlight-1" />
              <p className="text-xs text-highlight-1">
                Streak threshold raised to {newCycleNumber === 2 ? 5 : newCycleNumber === 3 ? 6 : 7} completions/day
              </p>
            </div>
          )}
        </div>

        <button
          onClick={onContinue}
          className="w-full bg-aura-primary hover:bg-aura-primary/80 text-text-primary font-bold tracking-widest py-4 rounded-sm transition-all aura-glow-sm fade-in-up"
          style={{ fontFamily: 'var(--font-rajdhani)', fontSize: '1rem', animationDelay: '0.4s' }}
        >
          BEGIN CYCLE {newCycleNumber}
        </button>
      </div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: string
  sub: string
  color: string
}) {
  return (
    <div className="bg-card border border-border rounded-sm p-4">
      <p className="text-xs tracking-widest text-text-secondary mb-2">{label}</p>
      <p className="text-3xl font-bold" style={{ fontFamily: 'var(--font-rajdhani)', color }}>
        {value}
      </p>
      <p className="text-xs text-text-secondary/40 mt-1">{sub}</p>
    </div>
  )
}
