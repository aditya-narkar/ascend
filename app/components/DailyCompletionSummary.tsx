'use client'

import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'

interface Props {
  isOpen: boolean
  dayNumber: number
  xpEarned: number
  statsGained: { stat: string; amount: number }[]
  completedCount: number
  totalQuests: number
  kaizenThreshold: number
  currentStreak: number
  onDismiss: () => void
}

export default function DailyCompletionSummary({
  isOpen, dayNumber, xpEarned, statsGained,
  completedCount, totalQuests, kaizenThreshold, currentStreak, onDismiss,
}: Props) {
  const allComplete = completedCount >= totalQuests
  const meetsThreshold = completedCount >= kaizenThreshold

  const systemMsg = allComplete
    ? 'Maximum output achieved.\nThe system has recorded your progress.'
    : 'Minimum threshold met.\nProgress recorded. Push harder tomorrow.'

  return (
    <Modal open={isOpen} label="Daily report" onClose={onDismiss} closeOnBackdrop align="end" className="p-6">
      <p className="mb-5 font-mono text-xs tracking-[0.2em] text-primary">DAY {dayNumber} COMPLETE</p>

      <div className="mb-5">
        <p className="mb-1 font-mono text-xs text-on-surface-variant">XP EARNED</p>
        <p className="font-display text-[40px] font-bold leading-none text-secondary">+{xpEarned}</p>
      </div>

      {statsGained.length > 0 && (
        <div className="mb-5">
          <p className="mb-2 font-mono text-xs text-on-surface-variant">STATS GAINED TODAY</p>
          <div className="space-y-1">
            {statsGained.map((s) => (
              <p key={s.stat} className="font-mono text-xs text-success">
                {s.stat.toUpperCase()} +{s.amount}
              </p>
            ))}
          </div>
        </div>
      )}

      <p className={`mb-5 font-mono text-xs ${meetsThreshold ? 'text-tertiary' : 'text-on-surface-variant'}`}>
        {meetsThreshold ? `${currentStreak} Day Streak` : 'Weak day. No streak progress.'}
      </p>

      <div className="mb-5 border border-primary-container/30 bg-primary-container/10 p-3">
        {systemMsg.split('\n').map((line, i) => (
          <p key={i} className="font-mono text-xs leading-relaxed text-on-surface-variant">
            {line}
          </p>
        ))}
      </div>

      <Button variant="outline" block onClick={onDismiss}>
        CLOSE REPORT
      </Button>
    </Modal>
  )
}
