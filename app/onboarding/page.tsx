'use client'

import { useState, useEffect } from 'react'
import { completeOnboarding } from '@/app/actions/onboarding'
import { saveNotificationSubscription } from '@/app/actions/notifications'
import { requestNotificationPermission, registerServiceWorker, subscribeUserToPush } from '@/lib/notifications'
import { assignArchetype, getBaselineStats, getArchetypeDescription } from '@/lib/utils'
import type { Archetype } from '@/lib/types'

const STRUGGLE_OPTIONS = [
  { value: 'consistency', label: "Can't stay consistent",          description: 'You start well but the momentum always dies.',       icon: 'repeat' },
  { value: 'direction',   label: 'No direction or purpose',        description: 'You feel lost with no clear mission to chase.',      icon: 'explore' },
  { value: 'distraction', label: 'Constant distraction',           description: 'Your attention is hijacked before the work begins.', icon: 'notifications_off' },
  { value: 'confidence',  label: 'Lack of confidence',             description: 'Self-doubt kills your momentum before it starts.',   icon: 'shield' },
  { value: 'energy',      label: 'Low energy or physical weakness', description: 'Your body fails you before your mind does.',        icon: 'bolt' },
  { value: 'scattered',   label: 'Scattered and overwhelmed mind',  description: 'Too much, too fast, no clarity on what matters.',   icon: 'blur_on' },
]

const WINNING_OPTIONS = [
  { value: 'body',       label: "A body I'm proud of",           description: 'Built through discipline, not shortcuts.',        icon: 'fitness_center' },
  { value: 'career',     label: 'Real career or skill progress', description: 'Competence that speaks before you do.',           icon: 'trending_up' },
  { value: 'mind',       label: 'Control over my mind and emotions', description: 'Unshakeable inner state under pressure.',     icon: 'psychology' },
  { value: 'respect',    label: 'Become someone people respect', description: 'A presence that commands the room.',              icon: 'emoji_events' },
  { value: 'discipline', label: 'Unbreakable daily discipline',  description: 'A system that runs even on your worst days.',    icon: 'gavel' },
]

const KILLER_OPTIONS = [
  { value: 'fade',      label: 'Start strong then fade',              description: 'Motivation burns bright then disappears.',         icon: 'local_fire_department' },
  { value: 'overthink', label: 'Overthink and never start',           description: 'Analysis paralyzes you into inaction.',            icon: 'troubleshoot' },
  { value: 'phone',     label: 'Phone and entertainment distraction', description: 'The dopamine trap resets your progress daily.',     icon: 'smartphone' },
  { value: 'badday',    label: 'One bad day ruins everything',        description: 'Fragile streaks that collapse under pressure.',     icon: 'warning' },
  { value: 'structure', label: 'No clear structure',                  description: 'Without a system, effort becomes chaos.',          icon: 'view_list' },
]

const STAT_LABELS: Record<string, string> = {
  strength: 'STR', focus: 'FOC', discipline: 'DIS',
  confidence: 'CON', intelligence: 'INT', purpose: 'PUR', energy: 'ENE',
}

const STAT_COLORS: Record<string, string> = {
  strength: '#ffb4ab', focus: '#7ed0ff', discipline: '#c9beff',
  confidence: '#ffb693', intelligence: '#7ed0ff', purpose: '#c9beff', energy: '#ffb693',
}

export default function OnboardingPage() {
  const [step, setStep] = useState(1)
  const [struggle, setStruggle] = useState('')
  const [winning, setWinning] = useState('')
  const [killer, setKiller] = useState('')
  const [archetype, setArchetype] = useState<Archetype | null>(null)
  const [hunterName, setHunterName] = useState('')
  const [commitmentText, setCommitmentText] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (step === 5) {
      const timer = setTimeout(() => {
        const result = assignArchetype(struggle, killer)
        setArchetype(result)
        setStep(6)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [step, struggle, killer])

  async function handleFinish() {
    if (!archetype || !hunterName.trim() || !commitmentText.trim()) {
      setError('Complete all fields to proceed.')
      return
    }
    setLoading(true)
    setError('')
    const result = await completeOnboarding({ struggle, killer, winning, hunterName, commitmentText })
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#070A12] text-on-surface overflow-hidden">
      {step === 1 && <SplashStep onEnter={() => setStep(2)} />}
      {step === 2 && (
        <QuestionStep
          question="What is your biggest struggle right now?"
          options={STRUGGLE_OPTIONS}
          selected={struggle}
          currentStep={1}
          onBack={() => {}}
          onNext={(v) => { setStruggle(v); setStep(3) }}
        />
      )}
      {step === 3 && (
        <QuestionStep
          question="What does winning look like in 6 months?"
          options={WINNING_OPTIONS}
          selected={winning}
          currentStep={2}
          onBack={() => setStep(2)}
          onNext={(v) => { setWinning(v); setStep(4) }}
        />
      )}
      {step === 4 && (
        <QuestionStep
          question="What always kills your progress?"
          options={KILLER_OPTIONS}
          selected={killer}
          currentStep={3}
          onBack={() => setStep(3)}
          onNext={(v) => { setKiller(v); setStep(5) }}
        />
      )}
      {step === 5 && <ProcessingStep />}
      {step === 6 && archetype && (
        <ArchetypeReveal archetype={archetype} onContinue={() => setStep(7)} />
      )}
      {step === 7 && (
        <CommitmentStep
          hunterName={hunterName}
          commitmentText={commitmentText}
          onHunterNameChange={setHunterName}
          onCommitmentChange={setCommitmentText}
          onContinue={() => setStep(8)}
          error={error}
        />
      )}
      {step === 8 && <NotificationStep onContinue={() => setStep(9)} />}
      {step === 9 && archetype && (
        <StatsReveal archetype={archetype} onBegin={handleFinish} loading={loading} error={error} />
      )}
    </div>
  )
}

/* ── Splash ── */
function SplashStep({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="bg-[#020305] min-h-screen text-on-surface overflow-hidden relative flex flex-col items-center justify-center p-4">
      {/* Aura rings */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
        <div className="absolute w-[600px] h-[600px] rounded-full bg-primary-container/5 blur-[100px]" />
        <div className="absolute w-[300px] h-[300px] rounded-full border border-primary-container/30 shadow-[0_0_20px_rgba(75,45,189,0.1)]" />
        <div className="absolute w-[400px] h-[400px] rounded-full border border-primary-container/30 shadow-[0_0_20px_rgba(75,45,189,0.1)] opacity-70" />
        <div className="absolute w-[500px] h-[500px] rounded-full border border-primary-container/30 shadow-[0_0_20px_rgba(75,45,189,0.1)] opacity-40" />
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-4 w-full">
        <div className="flex flex-col items-center mb-16">
          <h1 className="text-on-surface font-display text-display-lg tracking-[8px] uppercase mb-4">
            ASCEND
          </h1>
          <div className="w-[60px] h-[1px] bg-primary-container opacity-50 mb-4" />
          <p className="text-primary-container font-mono text-system-label tracking-[4px] uppercase">
            SHADOW SYSTEM
          </p>
        </div>

        <div className="mb-12">
          <button
            onClick={onEnter}
            className="relative px-8 py-3 border border-secondary bg-secondary/5 hover:bg-secondary/10 transition-all duration-300 group overflow-hidden"
          >
            <div className="absolute inset-0 bg-secondary/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            <span className="relative z-10 text-secondary font-mono tracking-[3px] uppercase text-[11px]">
              ENTER SYSTEM
            </span>
            <div className="absolute top-0 left-0 w-1 h-1 bg-secondary" />
            <div className="absolute bottom-0 right-0 w-1 h-1 bg-secondary" />
          </button>
        </div>

        <div className="absolute bottom-4 w-full text-center">
          <p className="text-surface-variant font-mono text-[10px] tracking-widest uppercase">
            v1.0 — ASCEND PROTOCOL
          </p>
        </div>
      </div>
    </div>
  )
}

/* ── Question step ── */
function QuestionStep({
  question,
  options,
  selected,
  currentStep,
  onBack,
  onNext,
}: {
  question: string
  options: { value: string; label: string; description: string; icon?: string }[]
  selected: string
  currentStep: number
  onBack: () => void
  onNext: (v: string) => void
}) {
  const [localSelected, setLocalSelected] = useState(selected)

  return (
    <div className="bg-[#070A12] min-h-screen text-on-surface flex flex-col">
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-1/4 -right-1/4 w-96 h-96 bg-primary-container/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 -left-1/4 w-96 h-96 bg-secondary/5 rounded-full blur-[100px]" />
        <div className="absolute top-4 left-4 w-4 h-4 border-t border-l border-outline-variant opacity-50" />
        <div className="absolute top-4 right-4 w-4 h-4 border-t border-r border-outline-variant opacity-50" />
      </div>

      <header className="w-full px-4 py-10 relative z-10">
        <div className="flex gap-2 w-full mb-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className={`h-1 flex-1 ${i <= currentStep ? 'bg-primary-container' : 'bg-surface-variant opacity-20'}`} />
          ))}
        </div>
        <div className="flex justify-between items-center border-b border-outline-variant/30 pb-4">
          <h2 className="font-mono text-system-label text-secondary tracking-widest uppercase">
            SYSTEM EVALUATION — 0{currentStep}/03
          </h2>
          <span className="material-symbols-outlined text-outline-variant" style={{ fontSize: '16px' }}>
            settings_ethernet
          </span>
        </div>
      </header>

      <main className="flex-1 w-full px-4 flex flex-col pt-4 pb-36 relative z-10">
        <div className="mb-8">
          <h1 className="font-display text-headline-lg text-[#E7ECFF] mb-3">{question}</h1>
          <p className="font-mono text-system-label text-outline uppercase">
            SELECT PARAMETERS TO INITIALIZE YOUR COMBAT VECTOR.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {options.map((option) => {
            const isSelected = localSelected === option.value
            return (
              <label key={option.value} className="cursor-pointer group relative">
                <input
                  type="radio"
                  name="option"
                  value={option.value}
                  checked={isSelected}
                  onChange={() => setLocalSelected(option.value)}
                  className="sr-only"
                />
                <div className={`w-full p-5 card-gradient border relative overflow-hidden transition-all duration-200 ${
                  isSelected
                    ? 'border-[#6CCBFF] shadow-[inset_0_0_0_1px_#6CCBFF,0_0_8px_rgba(108,203,255,0.4)]'
                    : 'border-border-card hover:border-outline'
                }`}>
                  <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${isSelected ? 'bg-[#6CCBFF]' : 'bg-primary-container'}`} />
                  <div className="flex items-start gap-3 pl-4">
                    {option.icon && (
                      <span className={`material-symbols-outlined mt-0.5 shrink-0 ${isSelected ? 'text-[#6CCBFF]' : 'text-outline-variant'}`}
                        style={{ fontSize: '20px', fontVariationSettings: "'FILL' 1" }}>
                        {option.icon}
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2 mb-1.5">
                        <h3 className="font-display text-headline-md text-on-surface">{option.label}</h3>
                        <div className={`w-4 h-4 border flex items-center justify-center shrink-0 mt-0.5 ${
                          isSelected ? 'border-[#6CCBFF] bg-[#6CCBFF]/20' : 'border-outline-variant'
                        }`}>
                          {isSelected && <div className="w-2 h-2 bg-[#6CCBFF]" />}
                        </div>
                      </div>
                      <p className="font-body text-body-sm text-outline">{option.description}</p>
                    </div>
                  </div>
                </div>
              </label>
            )
          })}
        </div>
      </main>

      <div className="fixed bottom-0 left-0 w-full p-4 bg-surface/90 backdrop-blur-md border-t border-outline-variant/30 z-50">
        <div className="w-full flex gap-4 items-center">
          {currentStep > 1 && (
            <button
              onClick={onBack}
              className="w-14 h-14 border border-outline-variant flex items-center justify-center text-outline hover:text-on-surface hover:border-outline transition-colors"
            >
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
          )}
          <button
            onClick={() => localSelected && onNext(localSelected)}
            disabled={!localSelected}
            className="flex-1 h-14 bg-primary-container border border-[#6B3FD4] font-mono text-system-label text-on-surface uppercase tracking-widest disabled:opacity-40 hover:shadow-[0_0_10px_#6CCBFF] transition-all"
          >
            CONFIRM EVALUATION →
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Processing ── */
function ProcessingStep() {
  return (
    <div className="min-h-screen bg-[#070A12] flex items-center justify-center p-4">
      <div className="text-center">
        <div className="relative mb-10">
          <div className="w-20 h-20 mx-auto border border-primary-container/50 rounded-full flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border border-secondary/40" style={{ animation: 'spin 3s linear infinite' }} />
            <div className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
          </div>
        </div>
        <p className="font-display text-headline-md text-on-surface tracking-[0.3em] mb-4">
          ANALYZING HUNTER PROFILE
        </p>
        <div className="flex flex-col items-center gap-2 text-outline font-mono text-system-label">
          {['Processing weakness matrix', 'Calibrating growth vector', 'Assigning archetype'].map((line, i) => (
            <span key={i} className="opacity-0" style={{ animation: `fadeInUp 0.4s ease-out ${i * 0.8}s forwards` }}>
              {line}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Archetype reveal ── */
function ArchetypeReveal({ archetype, onContinue }: { archetype: Archetype; onContinue: () => void }) {
  const info = getArchetypeDescription(archetype)

  return (
    <div className="bg-surface-container-lowest text-on-surface min-h-screen flex flex-col justify-center items-center overflow-hidden relative p-4">
      <div className="absolute inset-0 scanlines pointer-events-none opacity-20 z-0" />

      <main className="w-full max-w-[600px] flex flex-col items-center justify-center space-y-10 z-10 relative">
        <div className="text-center w-full">
          <span className="font-mono text-system-label text-primary-container uppercase tracking-widest opacity-80">
            SYSTEM HAS CLASSIFIED YOU AS
          </span>
        </div>

        <div className="flex flex-col items-center justify-center w-full">
          <div className="w-40 h-40 mb-6 relative flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border border-primary-container shadow-[0_0_4px_#4B2DBD] opacity-50 animate-pulse" />
            <div className="absolute inset-4 rotate-45 border border-primary-fixed-dim shadow-[0_0_4px_#4B2DBD] opacity-30" />
            <div className="absolute inset-8 -rotate-12 border border-secondary shadow-[0_0_4px_#4B2DBD] opacity-20" />
            <span className="material-symbols-outlined text-primary-fixed-dim text-glow" style={{ fontSize: '80px', fontVariationSettings: "'FILL' 1" }}>
              shield_lock
            </span>
          </div>

          <h1 className="font-display text-display-lg text-on-surface mb-4 text-center tracking-tight text-glow">
            {archetype}
          </h1>
          <p className="font-mono text-system-label text-on-surface-variant text-center max-w-sm leading-relaxed opacity-70">
            {info.description}
          </p>
        </div>

        <div className="w-full grid grid-cols-2 gap-4">
          <div className="card-gradient border border-border-card p-4 flex flex-col">
            <span className="font-mono text-system-label text-error mb-2 tracking-widest uppercase">PRIMARY WEAKNESS</span>
            <span className="font-display text-stat-value text-on-surface">{info.weakness}</span>
          </div>
          <div className="card-gradient border border-border-card p-4 flex flex-col">
            <span className="font-mono text-system-label text-secondary mb-2 tracking-widest uppercase">GROWTH VECTOR</span>
            <span className="font-display text-stat-value text-on-surface">{info.growth}</span>
          </div>
        </div>

        <div className="w-full">
          <button
            onClick={onContinue}
            className="w-full bg-primary-container border border-[#6B3FD4] py-4 px-6 flex items-center justify-center gap-2 font-mono text-system-label text-on-primary-container tracking-[0.3em] uppercase hover:shadow-[0_0_10px_#6CCBFF] transition-all duration-300"
          >
            ACCEPT CLASSIFICATION
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_forward</span>
          </button>
        </div>
      </main>
    </div>
  )
}

/* ── Commitment ── */
function CommitmentStep({
  hunterName, commitmentText, onHunterNameChange, onCommitmentChange, onContinue, error,
}: {
  hunterName: string; commitmentText: string
  onHunterNameChange: (v: string) => void; onCommitmentChange: (v: string) => void
  onContinue: () => void; error: string
}) {
  return (
    <div className="min-h-screen bg-[#070A12] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <p className="font-mono text-system-label text-outline tracking-widest mb-2">OATH_PROTOCOL</p>
        <h2 className="font-display text-headline-lg text-on-surface mb-8">Before you begin — make it real.</h2>

        <div className="space-y-5">
          <div>
            <label className="block font-mono text-system-label text-on-surface-variant mb-2">CHOOSE YOUR DESIGNATION</label>
            <input
              value={hunterName}
              onChange={(e) => onHunterNameChange(e.target.value)}
              maxLength={20}
              className="w-full bg-surface-container border border-outline-variant px-4 py-3 font-body text-on-surface placeholder-outline focus:outline-none focus:border-secondary transition-colors"
              placeholder="Your hunter name..."
            />
          </div>

          <div>
            <label className="block font-mono text-system-label text-on-surface-variant mb-2">WHY DOES THIS ACTUALLY MATTER TO YOU?</label>
            <textarea
              value={commitmentText}
              onChange={(e) => onCommitmentChange(e.target.value)}
              rows={4}
              className="w-full bg-surface-container border border-outline-variant px-4 py-3 font-body text-on-surface placeholder-outline focus:outline-none focus:border-secondary transition-colors resize-none leading-relaxed"
              placeholder="Write your oath. Be specific. Be honest. The system records everything."
            />
          </div>

          {error && (
            <p className="font-mono text-system-label text-error border border-error-container bg-error-container/20 px-3 py-2">
              {error}
            </p>
          )}

          <button
            onClick={onContinue}
            disabled={!hunterName.trim() || !commitmentText.trim()}
            className="w-full bg-primary-container border border-[#6B3FD4] font-mono text-system-label text-on-primary-container tracking-widest py-4 uppercase disabled:opacity-40 hover:shadow-[0_0_10px_#6CCBFF] transition-all"
          >
            SEAL THE OATH
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Notifications ── */
function NotificationStep({ onContinue }: { onContinue: () => void }) {
  const [status, setStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle')

  async function handleAllow() {
    setStatus('requesting')
    try {
      const granted = await requestNotificationPermission()
      if (granted) {
        await registerServiceWorker()
        try {
          const sub = await subscribeUserToPush()
          if (sub) await saveNotificationSubscription(sub.toJSON() as Record<string, unknown>)
        } catch {}
        setStatus('granted')
        setTimeout(onContinue, 1500)
      } else {
        setStatus('denied')
      }
    } catch {
      setStatus('denied')
    }
  }

  return (
    <div className="min-h-screen bg-[#070A12] flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <p className="font-mono text-system-label text-outline tracking-widest mb-2">SYSTEM_NOTIFICATIONS</p>
        <h2 className="font-display text-headline-lg text-on-surface mb-6">The system requires access.</h2>

        <div className="card-gradient border border-border-card p-6 mb-6 text-left">
          <p className="font-body text-body-sm text-on-surface-variant leading-relaxed mb-4">
            The system requires permission to send you reminders and alerts. This is how it holds you accountable.
          </p>
          <div className="space-y-2 font-mono text-system-label text-outline">
            <p>· Daily hunt reminders at 9am, 2pm, 8pm</p>
            <p>· Streak at risk alerts</p>
            <p>· Penalty zone warnings and level-up notifications</p>
          </div>
        </div>

        {status === 'idle' && (
          <button onClick={handleAllow} className="w-full bg-primary-container border border-[#6B3FD4] font-mono text-system-label text-on-primary-container tracking-widest py-4 uppercase mb-3 hover:shadow-[0_0_10px_#6CCBFF] transition-all">
            ALLOW NOTIFICATIONS
          </button>
        )}
        {status === 'requesting' && <p className="font-mono text-system-label text-on-surface-variant mb-3">REQUESTING PERMISSION...</p>}
        {status === 'granted'    && <p className="font-mono text-system-label text-secondary mb-3">NOTIFICATIONS ENABLED. PROCEEDING...</p>}
        {status === 'denied' && (
          <p className="font-mono text-system-label text-outline mb-4 leading-relaxed">
            Notifications disabled. You will receive no reminders.<br />The system will still record your failures.
          </p>
        )}

        {(status === 'denied' || status === 'idle') && (
          <button onClick={onContinue} className="font-mono text-system-label text-outline hover:text-on-surface transition-colors">
            {status === 'denied' ? 'CONTINUE →' : 'SKIP'}
          </button>
        )}
      </div>
    </div>
  )
}

/* ── Stats reveal ── */
function StatsReveal({
  archetype, onBegin, loading, error,
}: {
  archetype: Archetype; onBegin: () => void; loading: boolean; error: string
}) {
  const stats = getBaselineStats(archetype)

  return (
    <div className="min-h-screen bg-[#070A12] flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <p className="font-mono text-system-label text-outline tracking-widest mb-2">BASELINE CALIBRATION</p>
        <h2 className="font-display text-headline-lg text-on-surface mb-2">Your Starting Stats</h2>
        <p className="font-mono text-system-label text-on-surface-variant mb-8">
          These are your baseline attributes as a {archetype}.
        </p>

        <div className="card-gradient border border-border-card p-6 mb-6 space-y-3">
          {Object.entries(stats).map(([key, value]) => (
            <div key={key} className="flex items-center gap-3">
              <span className="font-mono text-system-label w-8 text-right" style={{ color: STAT_COLORS[key] }}>
                {STAT_LABELS[key]}
              </span>
              <div className="flex-1 h-1 bg-surface-container overflow-hidden">
                <div
                  className="h-full transition-all duration-1000"
                  style={{ width: `${value}%`, background: STAT_COLORS[key] }}
                />
              </div>
              <span className="font-mono text-system-label text-on-surface-variant w-6 text-left">{value}</span>
            </div>
          ))}
        </div>

        {error && (
          <p className="font-mono text-system-label text-error border border-error-container bg-error-container/20 px-3 py-2 mb-4">
            {error}
          </p>
        )}

        <button
          onClick={onBegin}
          disabled={loading}
          className="w-full bg-primary-container border border-[#6B3FD4] font-mono text-system-label text-on-primary-container tracking-widest py-4 uppercase disabled:opacity-50 hover:shadow-[0_0_10px_#6CCBFF] transition-all"
        >
          {loading ? 'INITIALIZING SYSTEM...' : 'BEGIN ASCENSION'}
        </button>
      </div>
    </div>
  )
}
