'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { completePenaltyZone, failPenaltyZone, updatePenaltyActiveTime } from '@/app/actions/penalty'
import { sendLocalNotification } from '@/lib/notifications'

interface Props {
  startedAt: string
  initialActiveTime: number
}

const REQUIRED_SECONDS = 7200
const TWELVE_HOURS_MS = 12 * 3600 * 1000

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function PenaltyZone({ startedAt, initialActiveTime }: Props) {
  const router = useRouter()
  const deadline = new Date(startedAt).getTime() + TWELVE_HOURS_MS

  const [activeSeconds, setActiveSeconds] = useState(initialActiveTime)
  const [completed, setCompleted] = useState(false)
  const [failed, setFailed] = useState(false)
  const [failMsg, setFailMsg] = useState('')
  const [timerResetMsg, setTimerResetMsg] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const activeSecondsRef = useRef(activeSeconds)
  activeSecondsRef.current = activeSeconds

  const isRestTime = (() => {
    const h = new Date().getHours()
    return h >= 23 || h < 7
  })()

  useEffect(() => {
    if (completed || failed) return
    const id = setInterval(() => {
      const hour = new Date().getHours()
      if (hour >= 23 || hour < 7) return
      setActiveSeconds((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(id)
  }, [completed, failed])

  useEffect(() => {
    if (completed || failed) return
    const id = setInterval(() => { void updatePenaltyActiveTime(activeSecondsRef.current) }, 30000)
    return () => clearInterval(id)
  }, [completed, failed])

  useEffect(() => {
    if (activeSeconds >= REQUIRED_SECONDS && !completed && !failed) handleComplete()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSeconds])

  useEffect(() => {
    const check = () => {
      if (!completed && !failed && Date.now() >= deadline) handleFail('Penalty Zone timed out.')
    }
    check()
    const id = setInterval(check, 60000)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completed, failed])

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && !completed && !failed) {
        setActiveSeconds(0)
        void updatePenaltyActiveTime(0)
        setTimerResetMsg(true)
        sendLocalNotification('Timer reset. Return now.', 'You left the system. Focus broken.', 'penalty-zone')
        setTimeout(() => setTimerResetMsg(false), 3500)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [completed, failed])

  async function handleComplete() {
    if (isProcessing) return
    setIsProcessing(true)
    setCompleted(true)
    await completePenaltyZone()
    router.refresh()
  }

  async function handleFail(msg?: string) {
    if (isProcessing) return
    setIsProcessing(true)
    setFailed(true)
    const result = await failPenaltyZone()
    setFailMsg(msg ?? result?.message ?? 'Penalty Zone failed.')
    router.refresh()
  }

  const progressPct = Math.min(100, Math.round((activeSeconds / REQUIRED_SECONDS) * 100))
  const timeRemaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000))

  if (completed) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-container-lowest">
        <div className="text-center max-w-sm">
          <p className="font-mono text-system-label text-secondary mb-6">PENALTY CLEARED</p>
          <p className="font-display text-headline-lg text-on-surface mb-4">
            The system acknowledges<br />your endurance.
          </p>
          <p className="font-mono text-system-label text-outline">Resume your hunt.</p>
        </div>
      </div>
    )
  }

  if (failed) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-container-lowest">
        <div className="text-center max-w-sm">
          <p className="font-mono text-system-label text-error mb-6">PENALTY FAILED</p>
          <p className="font-mono text-system-label text-on-surface-variant leading-relaxed">
            {failMsg || 'Penalty Zone failed. Consequences applied.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-surface-container-lowest min-h-screen flex flex-col relative overflow-hidden fixed inset-0 z-50">
      {/* Scanning lines */}
      <div className="absolute inset-0 pointer-events-none scanlines z-0" />

      {/* HUD corners */}
      <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-error/20 z-0" />
      <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-error/20 z-0" />
      <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-error/20 z-0" />
      <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-error/20 z-0" />

      {/* Top HUD bar */}
      <div className="absolute top-10 left-4 right-4 flex justify-between items-start border-t border-error/50 pt-2 font-mono text-system-label text-error uppercase z-10 opacity-70">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined" style={{ fontSize: '14px', fontVariationSettings: "'FILL' 1" }}>warning</span>
          SEC-LEVEL: MAXIMUM
        </div>
        <span>ID: 884-X9-PRTCL</span>
      </div>

      {/* Timer reset alert */}
      {timerResetMsg && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-error-container/20 border border-error px-4 py-2 z-20">
          <p className="font-mono text-system-label text-error">Focus broken. Timer reset.</p>
        </div>
      )}

      <main className="flex-1 flex flex-col items-center justify-center p-4 z-10 w-full">
        <div className="flex flex-col items-center text-center space-y-10 w-full max-w-md">

          {/* Header */}
          <div className="flex flex-col items-center space-y-4">
            <div className="relative inline-block border border-error bg-error/10 px-8 py-3 shadow-[0_0_15px_rgba(255,180,171,0.15)]">
              <div className="absolute inset-0 border border-error opacity-60 blur-[3px]" />
              <h1 className="font-display text-headline-lg text-error uppercase relative z-10 tracking-[0.15em]">
                PENALTY ZONE
              </h1>
            </div>
            <div className="flex items-center gap-3 bg-surface-container-high/80 px-4 py-1.5 border border-outline-variant backdrop-blur-md">
              <span className="w-2 h-2 bg-error shadow-[0_0_8px_rgba(255,180,171,0.8)]" />
              <span className="font-mono text-system-label text-error uppercase tracking-[0.3em]">ACTIVE STATUS LOGGING</span>
            </div>
          </div>

          {/* Timer */}
          <div className="flex flex-col items-center w-full">
            <div className="font-display text-[64px] leading-none text-error tracking-tighter py-6 drop-shadow-[0_0_12px_rgba(255,180,171,0.3)]">
              {formatTime(activeSeconds)}
            </div>

            <div className="w-full flex flex-col space-y-3 mt-2 px-4">
              <div className="w-full h-1 bg-surface-variant relative">
                <div
                  className="absolute top-0 left-0 h-full bg-error"
                  style={{ width: `${progressPct}%`, transition: 'width 1s linear' }}
                >
                  <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-r from-transparent to-white/90" />
                </div>
              </div>
              <div className="flex justify-between font-mono text-system-label text-outline uppercase">
                <span>00:00:00</span>
                <span className="text-error">02:00:00 GOAL</span>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="relative border border-outline-variant/50 p-6 bg-surface-container-low/80 backdrop-blur-md w-full">
            <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-error" />
            <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-error" />
            <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-error" />
            <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-error" />

            <div className="flex flex-col items-center space-y-3 font-mono text-system-label uppercase text-center">
              <span className="text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-error" style={{ fontSize: '18px' }}>timer</span>
                Stay active for 2 continuous hours.
              </span>
              <span className="text-error font-bold tracking-widest bg-error/10 px-3 py-1 w-full border border-error/20">
                LEAVE APP = TIMER RESETS
              </span>
              {isRestTime && (
                <span className="text-primary-container">Rest period active. Timer paused until 7am.</span>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Deadline footer */}
      <div className="absolute bottom-4 left-4 right-4 flex justify-center border-b border-error/30 pb-2 z-10">
        <span className="font-mono text-system-label text-error uppercase tracking-[0.2em] opacity-80">
          DEADLINE EXPIRES: {formatTime(timeRemaining)}
        </span>
      </div>
    </div>
  )
}
