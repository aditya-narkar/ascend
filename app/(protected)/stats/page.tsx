import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { formatTodayDate, getRankColor } from '@/lib/utils'
import type { UserProfile, Stats, QuestSelection } from '@/lib/types'

const ALL_STATS = [
  { key: 'strength',     label: 'STRENGTH',     color: '#ff6b6b', desc: 'Physical power and resilience' },
  { key: 'focus',        label: 'FOCUS',         color: '#6CCBFF', desc: 'Depth of attention' },
  { key: 'discipline',   label: 'DISCIPLINE',    color: '#a78bfa', desc: 'Consistency and self-command' },
  { key: 'confidence',   label: 'CONFIDENCE',    color: '#34d399', desc: 'Belief in your own capacity' },
  { key: 'intelligence', label: 'INTELLIGENCE',  color: '#8EF0FF', desc: 'Mental acuity and learning' },
  { key: 'purpose',      label: 'PURPOSE',       color: '#ffc432', desc: 'Clarity of mission' },
  { key: 'energy',       label: 'ENERGY',        color: '#ff9f50', desc: 'Vitality and sustained output' },
]

const RANK_ROWS = [
  { rank: 'F',       min: 1,   max: 5   },
  { rank: 'E',       min: 6,   max: 15  },
  { rank: 'D',       min: 16,  max: 30  },
  { rank: 'C',       min: 31,  max: 50  },
  { rank: 'B',       min: 51,  max: 70  },
  { rank: 'A',       min: 71,  max: 85  },
  { rank: 'S',       min: 86,  max: 99  },
  { rank: 'Monarch', min: 100, max: 100 },
]

export default async function StatsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const today = formatTodayDate()

  const [profileRes, statsRes, todayQuestsRes, activeSelsRes, daysActiveRes] = await Promise.all([
    supabase.from('users').select('*').eq('id', user.id).single(),
    supabase.from('stats').select('*').eq('user_id', user.id).single(),
    supabase
      .from('quests')
      .select('stat_target, stat_reward, xp_reward')
      .eq('user_id', user.id)
      .eq('date_assigned', today)
      .eq('is_completed', true),
    supabase
      .from('quest_selections')
      .select('cycle_number, selected_date, expires_date')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .gte('expires_date', today)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('daily_summary')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gt('quests_completed', 0),
  ])

  const profile = profileRes.data as UserProfile | null
  const stats = statsRes.data as Stats | null
  if (!profile?.hunter_name) redirect('/onboarding')

  const rankColor = getRankColor(profile.rank)

  // Today's stat deltas from completed quests
  const todayStatDeltas: Record<string, number> = {}
  for (const q of todayQuestsRes.data ?? []) {
    if (q.stat_target && q.stat_reward) {
      todayStatDeltas[q.stat_target] = (todayStatDeltas[q.stat_target] ?? 0) + q.stat_reward
    }
  }

  // Cycle completion rate
  const activeSel = activeSelsRes.data as QuestSelection | null
  let completionRate: number | null = null
  let daysRemaining: number | null = null
  let cycleNumber: number | null = null

  if (activeSel) {
    cycleNumber = activeSel.cycle_number
    daysRemaining = Math.max(0, Math.ceil(
      (new Date(activeSel.expires_date).getTime() - Date.now()) / 86400000
    ))
    const cycleStart = activeSel.selected_date
    const daysElapsed = Math.max(1, Math.floor(
      (Date.now() - new Date(cycleStart).getTime()) / 86400000
    ))

    const { data: streakDays } = await supabase
      .from('daily_summary')
      .select('id')
      .eq('user_id', user.id)
      .eq('streak_maintained', true)
      .gte('date', cycleStart)

    if (streakDays !== null) {
      completionRate = Math.round((streakDays.length / daysElapsed) * 100)
    }
  }

  const totalDaysActive = daysActiveRes.count ?? 0
  const xpPercent = Math.min(100, Math.round((profile.current_xp / profile.xp_to_next_level) * 100))

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div>
        <h1
          className="text-2xl font-bold tracking-wide text-text-primary"
          style={{ fontFamily: 'var(--font-rajdhani)' }}
        >
          Hunter Statistics
        </h1>
        <p
          className="text-xs text-text-secondary mt-0.5"
          style={{ fontFamily: 'var(--font-share-tech-mono)' }}
        >
          System record of all growth
        </p>
      </div>

      {/* Stat Cards — 2 column grid */}
      <div className="grid grid-cols-2 gap-3">
        {ALL_STATS.map(({ key, label, color }) => {
          const val = stats ? (stats as unknown as Record<string, number>)[key] : 0
          const delta = todayStatDeltas[key] ?? 0
          const pct = Math.min(100, val)

          return (
            <div key={key} className="bg-card border border-border rounded-sm p-4">
              <p
                className="mb-2"
                style={{ fontFamily: 'var(--font-share-tech-mono)', fontSize: '9px', letterSpacing: '2px', color }}
              >
                {label}
              </p>
              <div className="flex items-end justify-between mb-2">
                <p
                  className="leading-none"
                  style={{ fontFamily: 'var(--font-rajdhani)', fontSize: '32px', fontWeight: 700, color: '#E7ECFF' }}
                >
                  {val}
                </p>
                <p
                  style={{
                    fontFamily: 'var(--font-share-tech-mono)',
                    fontSize: '10px',
                    color: delta > 0 ? '#34d399' : '#8D96B8',
                    marginBottom: '4px',
                  }}
                >
                  {delta > 0 ? `+${delta}` : '—'}
                </p>
              </div>
              <div className="rounded-full overflow-hidden" style={{ height: '4px', background: '#0B1120' }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, background: color }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* Progression */}
      <div className="bg-card border border-border rounded-sm p-5">
        <p className="text-xs tracking-[0.3em] text-text-secondary mb-4">PROGRESSION</p>
        <div className="flex items-end gap-4 mb-4">
          <div>
            <p
              className="leading-none"
              style={{ fontFamily: 'var(--font-rajdhani)', fontSize: '48px', fontWeight: 700, color: '#E7ECFF' }}
            >
              {profile.level}
            </p>
            <p className="text-xs text-text-secondary tracking-widest mt-0.5">LEVEL</p>
          </div>
          <div className="mb-1">
            <span
              className="px-2 py-1 border rounded-sm text-sm font-bold tracking-widest"
              style={{ color: rankColor, borderColor: rankColor + '44', background: rankColor + '11', fontFamily: 'var(--font-rajdhani)' }}
            >
              RANK {profile.rank}
            </span>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-text-secondary tracking-widest">
            <span>XP TO NEXT LEVEL</span>
            <span>{profile.current_xp} / {profile.xp_to_next_level}</span>
          </div>
          <div className="h-2 bg-bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full rounded-full xp-bar-fill"
              style={{ width: `${xpPercent}%`, background: 'linear-gradient(90deg, #4B2DBD, #6CCBFF)' }}
            />
          </div>
          <p className="text-xs text-text-secondary/40 text-right">
            Total XP: <span className="text-highlight-1" style={{ fontFamily: 'var(--font-rajdhani)' }}>{profile.total_xp.toLocaleString()}</span>
          </p>
        </div>
      </div>

      {/* Rank Progression */}
      <div className="bg-card border border-border rounded-sm p-5">
        <p className="text-xs tracking-[0.3em] text-text-secondary mb-4">RANK PROGRESSION</p>
        <div className="space-y-2">
          {RANK_ROWS.map(({ rank, min, max }) => {
            const isCurrent = profile.level >= min && profile.level <= max
            const isPast = profile.level > max
            return (
              <div
                key={rank}
                className={`flex items-center gap-3 px-3 py-2 rounded-sm text-xs ${
                  isCurrent ? 'bg-aura-primary/10 border border-aura-primary/30' : 'border border-transparent'
                }`}
              >
                <span
                  className="w-16 font-bold tracking-widest"
                  style={{
                    fontFamily: 'var(--font-rajdhani)',
                    color: isCurrent ? '#6CCBFF' : isPast ? '#8D96B8' : '#8D96B8',
                    opacity: isPast ? 0.6 : isCurrent ? 1 : 0.3,
                  }}
                >
                  RANK {rank}
                </span>
                <span className="text-text-secondary/40">Lv {min}{max !== min ? `–${max}` : ''}</span>
                {isCurrent && <span className="ml-auto text-highlight-1/60 tracking-widest">CURRENT</span>}
                {isPast && <span className="ml-auto text-text-secondary/20">✓</span>}
              </div>
            )
          })}
        </div>
      </div>

      {/* Streak */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-sm p-4">
          <p className="text-xs tracking-widest text-text-secondary mb-2" style={{ fontSize: '8px' }}>STREAK</p>
          <p
            className="text-3xl font-bold text-highlight-1 text-glow"
            style={{ fontFamily: 'var(--font-rajdhani)' }}
          >
            {profile.current_streak}
          </p>
          <p className="text-xs text-text-secondary/40 mt-1" style={{ fontSize: '8px' }}>CURRENT</p>
        </div>
        <div className="bg-card border border-border rounded-sm p-4">
          <p className="text-xs tracking-widest text-text-secondary mb-2" style={{ fontSize: '8px' }}>BEST</p>
          <p
            className="text-3xl font-bold text-text-primary"
            style={{ fontFamily: 'var(--font-rajdhani)' }}
          >
            {profile.best_streak}
          </p>
          <p className="text-xs text-text-secondary/40 mt-1" style={{ fontSize: '8px' }}>RECORD</p>
        </div>
        <div className="bg-card border border-border rounded-sm p-4">
          <p className="text-xs tracking-widest text-text-secondary mb-2" style={{ fontSize: '8px' }}>ACTIVE</p>
          <p
            className="text-3xl font-bold text-text-primary"
            style={{ fontFamily: 'var(--font-rajdhani)' }}
          >
            {totalDaysActive}
          </p>
          <p className="text-xs text-text-secondary/40 mt-1" style={{ fontSize: '8px' }}>DAYS</p>
        </div>
      </div>

      {/* Cycle Info */}
      {cycleNumber !== null && (
        <div className="bg-card border border-border rounded-sm p-5">
          <p className="text-xs tracking-[0.3em] text-text-secondary mb-4">CYCLE {cycleNumber}</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-text-secondary/50 tracking-widest mb-1">DAYS REMAINING</p>
              <p style={{ fontFamily: 'var(--font-rajdhani)', fontSize: '28px', fontWeight: 700, color: '#E7ECFF' }}>
                {daysRemaining}
              </p>
            </div>
            {completionRate !== null && (
              <div>
                <p className="text-xs text-text-secondary/50 tracking-widest mb-1">STREAK RATE</p>
                <p style={{ fontFamily: 'var(--font-rajdhani)', fontSize: '28px', fontWeight: 700, color: completionRate >= 60 ? '#34d399' : '#ff9f50' }}>
                  {completionRate}%
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
