interface CompletionRingProps {
  completed: number
  total: number
  minimum: number
}

export default function CompletionRing({ completed, total, minimum }: CompletionRingProps) {
  const size = 80
  const strokeWidth = 7
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const progress = total > 0 ? completed / total : 0
  const minimumAngle = total > 0 ? (minimum / total) * 360 : 0

  const state =
    completed === 0
      ? 'empty'
      : completed >= total
        ? 'complete'
        : completed >= minimum
          ? 'threshold'
          : 'progress'

  const ringColor = {
    empty: 'rgba(255,255,255,0.06)',
    progress: '#4B2DBD',
    threshold: '#6CCBFF',
    complete: '#6CCBFF',
  }[state]

  const messageColor = {
    empty: '#4A5280',
    progress: '#8D96B8',
    threshold: '#6CCBFF',
    complete: '#34D399',
  }[state]

  const message = {
    empty: 'HUNT NOT STARTED',
    progress: 'BELOW THRESHOLD',
    threshold: 'THRESHOLD MET',
    complete: 'HUNT COMPLETE',
  }[state]

  const strokeDashoffset = circumference - progress * circumference

  const minAngle = (minimumAngle - 90) * (Math.PI / 180)
  const markerX = size / 2 + radius * Math.cos(minAngle)
  const markerY = size / 2 + radius * Math.sin(minAngle)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
      <div style={{ position: 'relative' }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={strokeWidth}
          />
          {completed > 0 && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={ringColor}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="butt"
              style={{ transition: 'stroke-dashoffset 0.4s ease' }}
            />
          )}
          {state === 'complete' && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius + strokeWidth}
              fill="none"
              stroke="rgba(108,203,255,0.15)"
              strokeWidth={1}
            />
          )}
        </svg>

        <div
          style={{
            position: 'absolute',
            width: '5px',
            height: '5px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.25)',
            left: markerX - 2.5,
            top: markerY - 2.5,
            transform: 'rotate(90deg)',
          }}
        />

        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '1px' }}>
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: '18px',
                fontWeight: 700,
                color: state === 'complete' ? '#34D399' : '#E7ECFF',
                lineHeight: 1,
              }}
            >
              {completed}
            </span>
            <span
              style={{ fontFamily: "var(--font-mono)", fontSize: '10px', color: '#8D96B8' }}
            >
              /{total}
            </span>
          </div>
        </div>
      </div>

      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: '7px',
          letterSpacing: '1px',
          color: messageColor,
          margin: 0,
          textAlign: 'center',
        }}
      >
        {message}
      </p>
    </div>
  )
}
