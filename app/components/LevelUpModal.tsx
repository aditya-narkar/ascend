'use client'

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

const OVERLAY: React.CSSProperties = { background: 'rgba(2,3,5,0.95)' }
const CARD: React.CSSProperties = { background: '#0D1526', border: '1px solid rgba(75,45,189,0.5)' }
const MONO = { fontFamily: 'var(--font-share-tech-mono)' }
const RAJD = { fontFamily: 'var(--font-rajdhani)' }

export default function LevelUpModal({
  isOpen, oldLevel, newLevel, oldRank, newRank,
  rankChanged, eliteUnlocked, statsGained, onDismiss,
}: Props) {
  if (!isOpen) return null

  // ── STATE 3: Elite unlock ─────────────────────────────────────
  if (eliteUnlocked) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6 flicker-in" style={OVERLAY}>
        <div className="max-w-sm w-full rounded-sm p-8 text-center" style={CARD}>
          <p
            className="mb-2 tracking-[0.4em]"
            style={{ ...MONO, fontSize: '10px', color: '#6CCBFF', letterSpacing: '4px' }}
          >
            E-RANK ACHIEVED
          </p>

          <p className="font-bold mb-8" style={{ ...RAJD, fontSize: '64px', fontWeight: 700, color: '#E7ECFF', lineHeight: 1 }}>
            {newLevel}
          </p>

          <div className="space-y-3 mb-8">
            <p style={{ ...MONO, color: '#8D96B8', fontSize: '13px' }}>
              The system recognizes your growth.
            </p>
            <p style={{ ...MONO, color: '#8D96B8', fontSize: '13px' }}>
              Elite quests are now active.
            </p>
            <p style={{ ...MONO, color: '#8D96B8', fontSize: '13px', opacity: 0.55 }}>
              Your first elite quest awaits.
            </p>
          </div>

          {statsGained.length > 0 && (
            <div className="mb-8 space-y-1.5">
              {statsGained.map((s) => (
                <p key={s.stat} style={{ ...MONO, color: '#34d399', fontSize: '13px' }}>
                  {s.stat.toUpperCase()} +{s.value}
                </p>
              ))}
            </div>
          )}

          <button
            onClick={onDismiss}
            className="w-full rounded-sm py-3 tracking-[0.2em] transition-opacity hover:opacity-75"
            style={{ ...MONO, color: '#ffc432', border: '1px solid #ffc432', background: 'transparent', fontSize: '13px' }}
          >
            ENTER ELITE HUNT
          </button>
        </div>
      </div>
    )
  }

  // ── STATE 2: Rank increased ───────────────────────────────────
  if (rankChanged) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6 flicker-in" style={OVERLAY}>
        <div className="max-w-sm w-full rounded-sm p-8 text-center" style={CARD}>
          <p style={{ ...MONO, color: '#4B2DBD', fontSize: '10px', letterSpacing: '4px' }} className="mb-6">
            LEVEL UP
          </p>

          <p className="font-bold mb-1" style={{ ...RAJD, fontSize: '72px', fontWeight: 700, color: '#E7ECFF', lineHeight: 1 }}>
            {newLevel}
          </p>

          <p className="mb-6" style={{ ...MONO, color: '#8D96B8', fontSize: '12px' }}>
            Level {oldLevel} → {newLevel}
          </p>

          <div className="flex items-center justify-center gap-3 mb-1">
            <span
              className="line-through"
              style={{ ...RAJD, color: '#8D96B8', opacity: 0.35, fontSize: '14px', fontWeight: 700 }}
            >
              RANK {oldRank}
            </span>
            <span style={{ color: '#8D96B8', opacity: 0.45, fontSize: '13px' }}>→</span>
            <span
              style={{
                ...RAJD, color: '#6CCBFF', fontSize: '15px', fontWeight: 700,
                textShadow: '0 0 12px rgba(108,203,255,0.7)',
              }}
            >
              RANK {newRank}
            </span>
          </div>
          <p className="mb-8" style={{ ...MONO, color: '#8D96B8', fontSize: '10px', letterSpacing: '3px' }}>
            RANK INCREASED
          </p>

          {statsGained.length > 0 && (
            <div className="mb-8 space-y-1.5">
              {statsGained.map((s) => (
                <p key={s.stat} style={{ ...MONO, color: '#34d399', fontSize: '13px' }}>
                  {s.stat.toUpperCase()} +{s.value}
                </p>
              ))}
            </div>
          )}

          <button
            onClick={onDismiss}
            className="rounded-sm tracking-widest transition-opacity hover:opacity-70"
            style={{
              ...MONO, color: '#6CCBFF', border: '1px solid #4B2DBD',
              background: 'transparent', padding: '12px 32px', fontSize: '13px',
            }}
          >
            CONTINUE
          </button>
        </div>
      </div>
    )
  }

  // ── STATE 1: Regular level up ─────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 flicker-in" style={OVERLAY}>
      <div className="max-w-sm w-full rounded-sm p-8 text-center" style={CARD}>
        <p style={{ ...MONO, color: '#4B2DBD', fontSize: '10px', letterSpacing: '4px' }} className="mb-6">
          LEVEL UP
        </p>

        <p className="font-bold mb-1" style={{ ...RAJD, fontSize: '72px', fontWeight: 700, color: '#E7ECFF', lineHeight: 1 }}>
          {newLevel}
        </p>

        <p className="mb-8" style={{ ...MONO, color: '#8D96B8', fontSize: '12px' }}>
          Level {oldLevel} → {newLevel}
        </p>

        {statsGained.length > 0 && (
          <div className="mb-8 space-y-1.5">
            {statsGained.map((s) => (
              <p key={s.stat} style={{ ...MONO, color: '#34d399', fontSize: '13px' }}>
                {s.stat.toUpperCase()} +{s.value}
              </p>
            ))}
          </div>
        )}

        <button
          onClick={onDismiss}
          className="rounded-sm tracking-widest transition-opacity hover:opacity-70"
          style={{
            ...MONO, color: '#6CCBFF', border: '1px solid #4B2DBD',
            background: 'transparent', padding: '12px 32px', fontSize: '13px',
          }}
        >
          CONTINUE
        </button>
      </div>
    </div>
  )
}
