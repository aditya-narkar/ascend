import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { logout } from '@/app/actions/auth'
import type { UserProfile, Stats } from '@/lib/types'

const RANK_ORDER = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'Monarch'] as const

const KEY_STATS = [
  { key: 'strength',   label: 'STR', color: '#ff6b6b' },
  { key: 'focus',      label: 'FOC', color: '#6CCBFF' },
  { key: 'discipline', label: 'DIS', color: '#a78bfa' },
  { key: 'confidence', label: 'CON', color: '#34d399' },
] as const

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [profileRes, statsRes, completedRes, cyclesRes, penaltyRes] = await Promise.all([
    supabase.from('users').select('*').eq('id', user.id).single(),
    supabase.from('stats').select('*').eq('user_id', user.id).single(),
    supabase
      .from('quests')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_completed', true),
    supabase
      .from('cycles')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_complete', true),
    supabase
      .from('daily_summary')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('penalty_triggered', true),
  ])

  const profile = profileRes.data as UserProfile | null
  const stats = statsRes.data as Stats | null
  if (!profile?.hunter_name) redirect('/onboarding')

  const completedCount = completedRes.count ?? 0
  const cyclesCompleted = cyclesRes.count ?? 0
  const hadPenalty = (penaltyRes.count ?? 0) > 0

  const daysSinceJoin = Math.floor(
    (Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24)
  ) + 1

  const rankIndex = RANK_ORDER.indexOf(profile.rank as typeof RANK_ORDER[number])

  const TITLES = [
    { name: 'First Blood',     desc: 'Complete 1 quest',    earned: completedCount >= 1 },
    { name: 'Consistent',      desc: '7-day streak',         earned: profile.current_streak >= 7 },
    { name: 'Iron Will',       desc: '21-day streak',        earned: profile.current_streak >= 21 },
    { name: 'Cycle Complete',  desc: 'Complete a cycle',     earned: cyclesCompleted >= 1 },
    { name: 'Shadow Returned', desc: 'Rise after penalty',   earned: hadPenalty && profile.current_streak > 0 },
    { name: 'E-Rank Hunter',   desc: 'Reach E-Rank',         earned: rankIndex >= 1 },
    { name: 'Focused',         desc: 'Focus stat ≥ 50',      earned: (stats?.focus ?? 0) >= 50 },
  ]

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-5">

      {/* ── Identity Block ── */}
      <div className="bg-card border border-border rounded-sm p-5">
        <div className="flex items-start gap-4">
          {/* Avatar circle */}
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(75,45,189,0.2)', border: '1px solid rgba(75,45,189,0.4)' }}
          >
            <span style={{ fontFamily: 'var(--font-rajdhani)', fontSize: '24px', fontWeight: 700, color: '#6CCBFF' }}>
              {profile.hunter_name?.[0]?.toUpperCase() ?? '?'}
            </span>
          </div>
          {/* Identity text */}
          <div className="flex-1 min-w-0">
            <h1
              style={{ fontFamily: 'var(--font-rajdhani)', fontSize: '28px', fontWeight: 700, color: '#E7ECFF', lineHeight: 1.1 }}
            >
              {profile.hunter_name}
            </h1>
            <p style={{ fontFamily: 'var(--font-share-tech-mono)', fontSize: '10px', color: '#a78bfa', marginTop: 3 }}>
              {profile.archetype}
            </p>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span
                style={{
                  fontFamily: 'var(--font-rajdhani)', fontSize: '12px', fontWeight: 700,
                  color: '#6CCBFF', border: '1px solid rgba(108,203,255,0.3)',
                  background: 'rgba(108,203,255,0.06)', padding: '1px 8px', borderRadius: 4,
                  letterSpacing: '1px',
                }}
              >
                {profile.rank === 'Monarch' ? 'MONARCH' : `RANK ${profile.rank}`}
              </span>
              <span style={{ fontFamily: 'var(--font-share-tech-mono)', fontSize: '9px', color: '#8D96B8' }}>
                Day {daysSinceJoin}
              </span>
            </div>
          </div>
          {/* Logout */}
          <form action={logout}>
            <button
              type="submit"
              className="text-xs tracking-widest text-text-secondary/40 hover:text-text-secondary border border-border/40 hover:border-border px-3 py-1.5 rounded-sm transition-colors"
            >
              LOGOUT
            </button>
          </form>
        </div>
      </div>

      {/* ── Founding Oath ── */}
      <div>
        <p
          className="mb-2"
          style={{ fontFamily: 'var(--font-share-tech-mono)', fontSize: '9px', letterSpacing: '3px', color: '#4B2DBD' }}
        >
          FOUNDING OATH
        </p>
        <div style={{ background: '#0B1120', border: '1px solid rgba(75,45,189,0.2)', borderRadius: 10, padding: 14 }}>
          <p style={{ fontFamily: 'var(--font-rajdhani)', fontSize: '15px', color: '#8D96B8', lineHeight: 1.6 }}>
            {profile.commitment_text || 'No oath recorded.'}
          </p>
        </div>
      </div>

      {/* ── Core Attributes (4 stats) ── */}
      <div>
        <p className="text-xs tracking-[0.3em] text-text-secondary mb-3">CORE ATTRIBUTES</p>
        <div className="grid grid-cols-2 gap-2">
          {KEY_STATS.map(({ key, label, color }) => {
            const val = stats ? (stats as unknown as Record<string, number>)[key] : 0
            return (
              <div key={key} className="bg-card border border-border rounded-sm p-3 text-center">
                <p className="text-xs mb-1" style={{ color }}>{label}</p>
                <p
                  className="text-2xl font-bold text-text-primary"
                  style={{ fontFamily: 'var(--font-rajdhani)' }}
                >
                  {val}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Battle Record ── */}
      <div>
        <p className="text-xs tracking-[0.3em] text-text-secondary mb-3">BATTLE RECORD</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'QUESTS',       value: completedCount,                  color: '#E7ECFF' },
            { label: 'STREAK',       value: profile.current_streak,          color: '#6CCBFF' },
            { label: 'BEST STREAK',  value: profile.best_streak,             color: '#E7ECFF' },
            { label: 'TOTAL XP',     value: profile.total_xp.toLocaleString(), color: '#6CCBFF' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-card border border-border rounded-sm p-4">
              <p className="text-xs tracking-widest text-text-secondary mb-1">{label}</p>
              <p style={{ fontFamily: 'var(--font-rajdhani)', fontSize: '26px', fontWeight: 700, color }}>
                {value}
              </p>
            </div>
          ))}
          <div className="bg-card border border-border rounded-sm p-4 col-span-2">
            <p className="text-xs tracking-widest text-text-secondary mb-1">CYCLES COMPLETE</p>
            <p style={{ fontFamily: 'var(--font-rajdhani)', fontSize: '26px', fontWeight: 700, color: '#E7ECFF' }}>
              {cyclesCompleted}
            </p>
          </div>
        </div>
      </div>

      {/* ── Titles ── */}
      <div>
        <p className="text-xs tracking-[0.3em] text-text-secondary mb-3">TITLES</p>
        <div className="flex flex-wrap gap-2">
          {TITLES.map(({ name, desc, earned }) => (
            <div
              key={name}
              title={desc}
              className="flex items-center gap-1"
              style={{
                padding: '4px 10px',
                borderRadius: 4,
                border: earned ? '1px solid rgba(108,203,255,0.3)' : '1px solid rgba(75,45,189,0.25)',
                background: earned ? 'transparent' : 'rgba(75,45,189,0.12)',
                opacity: earned ? 1 : 0.45,
              }}
            >
              {!earned && (
                <svg viewBox="0 0 16 16" fill="none" width="10" height="10" style={{ flexShrink: 0 }}>
                  <rect x="3" y="7" width="10" height="8" rx="1" stroke="#8D96B8" strokeWidth="1.5" />
                  <path d="M5 7V5a3 3 0 0 1 6 0v2" stroke="#8D96B8" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              )}
              <span
                style={{
                  fontFamily: 'var(--font-share-tech-mono)',
                  fontSize: '10px',
                  color: earned ? '#6CCBFF' : '#8D96B8',
                  letterSpacing: '1px',
                }}
              >
                {name}
              </span>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
