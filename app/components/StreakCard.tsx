import { getShieldState, getDaysUntilShield } from '@/lib/streakShield'

interface StreakCardProps {
  currentStreak: number
  bestStreak: number
  cycleDaysCompleted: number
  user: any
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

  return (
    <div
      style={{
        background: '#0B1120',
        border: '1px solid rgba(75,45,189,0.2)',
        borderRadius: '12px',
        padding: '14px',
      }}
    >
      {shieldMessage && (
        <div
          style={{
            background: 'rgba(108,203,255,0.06)',
            border: '1px solid rgba(108,203,255,0.2)',
            borderLeft: '2px solid #6CCBFF',
            borderRadius: '0 6px 6px 0',
            padding: '8px 12px',
            marginBottom: '10px',
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: '9px',
              letterSpacing: '1.5px',
              color: '#6CCBFF',
              margin: 0,
            }}
          >
            {shieldMessage}
          </p>
        </div>
      )}

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '8px',
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: '8px',
            letterSpacing: '2px',
            color: '#8D96B8',
            margin: 0,
          }}
        >
          CURRENT STREAK
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border:
                shieldState === 'active'
                  ? '1px solid rgba(108,203,255,0.4)'
                  : shieldState === 'used'
                    ? '1px solid rgba(74,82,128,0.3)'
                    : '1px solid rgba(42,48,96,0.3)',
              background:
                shieldState === 'active'
                  ? 'rgba(108,203,255,0.1)'
                  : shieldState === 'used'
                    ? 'rgba(74,82,128,0.06)'
                    : 'transparent',
              fontSize: '14px',
            }}
          >
            {shieldState === 'active' ? '🛡' : shieldState === 'used' ? '🪬' : '🔒'}
          </div>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: '7px',
              color:
                shieldState === 'active'
                  ? '#6CCBFF'
                  : shieldState === 'used'
                    ? '#4A5280'
                    : '#2A3060',
              margin: 0,
              letterSpacing: '0.5px',
            }}
          >
            {shieldState === 'active'
              ? 'SHIELD READY'
              : shieldState === 'used'
                ? 'SHIELD USED'
                : `DAY ${daysUntilShield}`}
          </p>
        </div>
      </div>

      <div
        style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '10px' }}
      >
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: '40px',
            fontWeight: 700,
            color: '#FF9F50',
            lineHeight: 1,
          }}
        >
          {currentStreak}
        </span>
        <span
          style={{ fontFamily: "var(--font-mono)", fontSize: '9px', color: '#8D96B8' }}
        >
          DAYS
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
          borderTop: '1px solid rgba(75,45,189,0.1)',
          paddingTop: '10px',
        }}
      >
        <div>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: '8px',
              color: '#8D96B8',
              margin: '0 0 2px',
            }}
          >
            BEST
          </p>
          <p
            style={{
              fontFamily: "var(--font-display)",
              fontSize: '18px',
              fontWeight: 700,
              color: '#E7ECFF',
              margin: 0,
            }}
          >
            {bestStreak}
          </p>
        </div>
        <div>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: '8px',
              color: '#8D96B8',
              margin: '0 0 2px',
            }}
          >
            THIS CYCLE
          </p>
          <p
            style={{
              fontFamily: "var(--font-display)",
              fontSize: '18px',
              fontWeight: 700,
              color: '#E7ECFF',
              margin: 0,
            }}
          >
            {cycleDaysCompleted}
          </p>
        </div>
      </div>
    </div>
  )
}
