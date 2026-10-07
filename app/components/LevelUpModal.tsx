'use client'

import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'

interface StatsGained {
  stat: string
  value: number
}

interface Props {
  isOpen: boolean
  oldLevel: number
  newLevel: number
  oldRank: string
  newRank: string
  rankChanged: boolean
  eliteUnlocked: boolean
  statsGained: StatsGained[]
  onDismiss: () => void
}

export default function LevelUpModal({
  isOpen, oldLevel, newLevel, oldRank, newRank,
  rankChanged, eliteUnlocked, statsGained, onDismiss,
}: Props) {
  return (
    <Modal open={isOpen} label={eliteUnlocked ? 'Elite rank achieved' : 'Level up'} onClose={onDismiss} className="p-8 text-center">
      <p className="mb-6 font-mono text-xs tracking-[0.3em] text-primary">
        {eliteUnlocked ? 'E-RANK ACHIEVED' : 'LEVEL UP'}
      </p>

      <p className="font-display text-[72px] font-bold leading-none text-on-surface">{newLevel}</p>

      {eliteUnlocked ? (
        <div className="mb-8 mt-6 space-y-2 font-mono text-sm text-on-surface-variant">
          <p>The system recognizes your growth.</p>
          <p>Elite quests are now active.</p>
          <p>Your first elite quest awaits.</p>
        </div>
      ) : (
        <>
          <p className="mb-6 mt-1 font-mono text-xs text-on-surface-variant">
            Level {oldLevel} → {newLevel}
          </p>

          {rankChanged && (
            <div className="mb-8">
              <p className="mb-1 flex items-center justify-center gap-3 font-display font-bold">
                <span className="text-sm text-outline line-through">RANK {oldRank}</span>
                <span aria-hidden="true" className="text-outline">→</span>
                <span className="text-base text-secondary text-glow">RANK {newRank}</span>
              </p>
              <p className="font-mono text-xs tracking-[0.2em] text-on-surface-variant">RANK INCREASED</p>
            </div>
          )}
        </>
      )}

      {statsGained.length > 0 && (
        <div className="mb-8 space-y-1.5">
          {statsGained.map((s) => (
            <p key={s.stat} className="font-mono text-sm text-success">
              {s.stat.toUpperCase()} +{s.value}
            </p>
          ))}
        </div>
      )}

      <Button size="lg" variant={eliteUnlocked ? 'primary' : 'outline'} onClick={onDismiss}>
        {eliteUnlocked ? 'ENTER ELITE HUNT' : 'CONTINUE'}
      </Button>
    </Modal>
  )
}
