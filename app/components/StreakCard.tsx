import Card from '@/components/ui/Card'
import { getShieldState, getDaysUntilShield } from '@/lib/streakShield'
import type { UserProfile } from '@/lib/types'

type ShieldUser = Pick<UserProfile, 'cycle_days_completed' | 'streak_shield_active' | 'streak_shield_used_date'>

interface StreakCardProps {
  currentStreak: number
  bestStreak: number
  cycleDaysCompleted: number
  user: ShieldUser
  shieldMessage?: string
}

export default function StreakCard({
  currentStreak,
  bestStreak,
  cycleDaysCompleted,
  user,
  shieldMessage,
}: StreakCardProps) {
  const shieldState = getShieldState(user)
  const daysUntilShield = getDaysUntilShield(user)

  const shield = {
    active: { icon: 'shield', label: 'SHIELD READY', tone: 'text-secondary border-secondary/50 bg-secondary/10' },
    used: { icon: 'shield', label: 'SHIELD USED', tone: 'text-outline border-outline-variant' },
    not_earned: {
      icon: 'lock',
      label: `SHIELD IN ${daysUntilShield} ${daysUntilShield === 1 ? 'DAY' : 'DAYS'}`,
      tone: 'text-outline border-outline-variant',
    },
  }[shieldState]

  return (
    <Card as="section" aria-label="Streak" className="p-4">
      {shieldMessage && (
        <p
          role="status"
          className="mb-3 border-l-2 border-secondary bg-secondary/10 px-3 py-2 font-mono text-xs tracking-wider text-secondary"
        >
          {shieldMessage}
        </p>
      )}

      <div className="flex items-start justify-between gap-3">
        <h3 className="font-mono text-system-label text-on-surface-variant">CURRENT STREAK</h3>
        <span className={`flex items-center gap-1.5 border px-2 py-1 font-mono text-xs ${shield.tone}`}>
          <span aria-hidden="true" className="material-symbols-outlined" style={{ fontSize: '16px', fontVariationSettings: "'FILL' 1" }}>
            {shield.icon}
          </span>
          {shield.label}
        </span>
      </div>

      <p className="mt-2 flex items-baseline gap-2">
        <span className="font-display text-[40px] font-bold leading-none text-tertiary">{currentStreak}</span>
        <span className="font-mono text-xs text-on-surface-variant">{currentStreak === 1 ? 'DAY' : 'DAYS'}</span>
      </p>

      <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-outline-variant/40 pt-3">
        <div>
          <dt className="font-mono text-xs text-on-surface-variant">BEST</dt>
          <dd className="font-display text-lg font-bold text-on-surface">{bestStreak}</dd>
        </div>
        <div>
          <dt className="font-mono text-xs text-on-surface-variant">THIS CYCLE</dt>
          <dd className="font-display text-lg font-bold text-on-surface">{cycleDaysCompleted}</dd>
        </div>
      </dl>
    </Card>
  )
}
