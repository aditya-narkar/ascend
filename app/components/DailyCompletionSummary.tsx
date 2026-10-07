'use client'

import { useEffect } from 'react'

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

const MONO = { fontFamily: 'var(--font-share-tech-mono)' }
const RAJD = { fontFamily: 'var(--font-rajdhani)' }

export default function DailyCompletionSummary({
  isOpen, dayNumber, xpEarned, statsGained,
  completedCount, totalQuests, kaizenThreshold, currentStreak, onDismiss,
}: Props) {
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onDismiss() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onDismiss])

  if (!isOpen) return null

  const allComplete = completedCount >= totalQuests
  const meetsThreshold = completedCount >= kaizenThreshold

  const systemMsg = allComplete
    ? 'Maximum output achieved.\nThe system has recorded your progress.'
    : 'Minimum threshold met.\nProgress recorded. Push harder tomorrow.'

  return (
    <div
      role="dialog" aria-modal="true" aria-label="Daily report" className="fixed inset-0 z-40 flex items-end justify-center p-4 pb-24"
      style={{ background: 'rgba(2,3,5,0.88)' }}
      onClick={onDismiss}
    >
      <div
        className="max-w-sm w-full rounded-sm p-6 flicker-in"
        style={{ background: '#0D1526', border: '1px solid rgba(75,45,189,0.4)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Label */}
        <p style={{ ...MONO, fontSize: '12px', letterSpacing: '3px', color: '#4B2DBD' }} className="mb-5">
          DAY {dayNumber} COMPLETE
        </p>

        {/* XP earned */}
        <div className="mb-5">
          <p style={{ ...MONO, fontSize: '12px', color: '#8D96B8', marginBottom: 4 }}>
            XP EARNED
          </p>
          <p style={{ ...RAJD, fontSize: '40px', fontWeight: 700, color: '#6CCBFF', lineHeight: 1 }}>
            +{xpEarned}
          </p>
        </div>

        {/* Stats gained */}
        {statsGained.length > 0 && (
          <div className="mb-5">
            <p style={{ ...MONO, fontSize: '12px', color: '#8D96B8', marginBottom: 8 }}>
              STATS GAINED TODAY
            </p>
            <div className="space-y-1">
              {statsGained.map((s) => (
                <p key={s.stat} style={{ ...MONO, fontSize: '12px', color: '#34d399' }}>
                  {s.stat.toUpperCase()} +{s.amount}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Streak status */}
        <div className="mb-5">
          {meetsThreshold ? (
            <p style={{ ...MONO, fontSize: '12px', color: '#ff9f50' }}>
              {currentStreak} Day Streak
            </p>
          ) : (
            <p style={{ ...MONO, fontSize: '12px', color: '#8D96B8' }}>
              Weak day. No streak progress.
            </p>
          )}
        </div>

        {/* System message */}
        <div
          className="rounded-sm p-3 mb-5"
          style={{ background: 'rgba(75,45,189,0.06)', border: '1px solid rgba(75,45,189,0.15)' }}
        >
          {systemMsg.split('\n').map((line, i) => (
            <p key={i} style={{ ...MONO, fontSize: '12px', color: '#8D96B8', lineHeight: 1.6 }}>
              {line}
            </p>
          ))}
        </div>

        {/* Dismiss */}
        <button
          autoFocus
          onClick={onDismiss}
          className="w-full rounded-sm py-3 tracking-[0.2em] transition-opacity hover:opacity-75"
          style={{ ...MONO, color: '#8D96B8', border: '1px solid rgba(75,45,189,0.3)', background: 'transparent', fontSize: '12px' }}
        >
          CLOSE REPORT
        </button>
      </div>
    </div>
  )
}
