import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { gameDate } from '@/lib/date'
import Card from '@/components/ui/Card'
import ProgressBar from '@/components/ui/ProgressBar'
import type { UserProfile, Stats, QuestSelection } from '@/lib/types'

const STAT_CONFIG = [
  { key: 'strength',     icon: 'fitness_center', color: 'text-error',             bar: '#ffb4ab' },
  { key: 'focus',        icon: 'my_location',    color: 'text-secondary',         bar: '#7ed0ff' },
  { key: 'discipline',   icon: 'gavel',          color: 'text-primary',           bar: '#c9beff' },
  { key: 'confidence',   icon: 'emoji_events',   color: 'text-tertiary',          bar: '#ffb693' },
  { key: 'intelligence', icon: 'psychology',     color: 'text-secondary',         bar: '#7ed0ff' },
  { key: 'purpose',      icon: 'flare',          color: 'text-primary-fixed-dim', bar: '#c9beff' },
  { key: 'energy',       icon: 'bolt',           color: 'text-tertiary-fixed-dim',bar: '#ffb693' },
] as const

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

  const today = gameDate()

  const [profileRes, statsRes, todayQuestsRes, activeSelsRes] = await Promise.all([
    supabase.from('users').select('*').eq('id', user.id).single(),
    supabase.from('stats').select('*').eq('user_id', user.id).single(),
    supabase.from('quests').select('stat_target, stat_reward, xp_reward').eq('user_id', user.id).eq('date_assigned', today).eq('is_completed', true),
    supabase.from('quest_selections').select('cycle_number, selected_date, expires_date').eq('user_id', user.id).eq('is_active', true).gte('expires_date', today).limit(1).maybeSingle(),
  ])

  const profile = profileRes.data as UserProfile | null
  const stats = statsRes.data as Stats | null
  if (!profile?.hunter_name) redirect('/onboarding')

  const todayDeltas: Record<string, number> = {}
  for (const q of todayQuestsRes.data ?? []) {
    if (q.stat_target && q.stat_reward) {
      todayDeltas[q.stat_target] = (todayDeltas[q.stat_target] ?? 0) + q.stat_reward
    }
  }

  const activeSel = activeSelsRes.data as QuestSelection | null
  let completionRate: number | null = null
  let daysRemaining: number | null = null
  let cycleNumber: number | null = null
  const nowMs = new Date().getTime()

  if (activeSel) {
    cycleNumber = activeSel.cycle_number
    daysRemaining = Math.max(0, Math.ceil(
      (new Date(activeSel.expires_date).getTime() - nowMs) / 86400000
    ))
    const daysElapsed = Math.max(1, Math.floor(
      (nowMs - new Date(activeSel.selected_date).getTime()) / 86400000
    ))
    const { data: streakDays } = await supabase
      .from('daily_summary').select('id').eq('user_id', user.id)
      .eq('streak_maintained', true).gte('date', activeSel.selected_date)
    if (streakDays !== null) {
      completionRate = Math.round((streakDays.length / daysElapsed) * 100)
    }
  }

  const xpPercent = Math.min(100, Math.round((profile.current_xp / profile.xp_to_next_level) * 100))
  const statValues = stats as unknown as Record<string, number>

  const daysSinceJoin = Math.floor((nowMs - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24)) + 1

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-4 pb-24">

      {/* Header bar */}
      <div className="flex justify-between items-center">
        <span className="font-mono text-system-label text-secondary tracking-widest">SYSTEM ACTIVE</span>
        <span className="font-mono text-system-label text-on-surface-variant">DAY {daysSinceJoin}</span>
      </div>

      {/* Rank card */}
      <Card as="section" corners className="p-6">
        <div className="flex flex-col items-center justify-center space-y-3 relative z-10">
          <div className="font-mono text-system-label text-secondary tracking-[0.3em]">CURRENT RANK</div>
          <div className="font-display text-[80px] leading-none text-primary level-glow font-bold">
            {profile.level}
          </div>
          <div className="font-mono text-system-label text-on-surface-variant uppercase tracking-wider">
            {profile.archetype}
          </div>
          <div className="w-full mt-2">
            <div className="flex justify-between font-mono text-system-label mb-2 text-on-surface">
              <span>XP: {profile.current_xp.toLocaleString()} / {profile.xp_to_next_level.toLocaleString()}</span>
              <span className="text-secondary">{xpPercent}%</span>
            </div>
            <ProgressBar label="Experience to next level" value={profile.current_xp} max={profile.xp_to_next_level} />
          </div>
        </div>
      </Card>

      {/* Stats — single column */}
      <section className="flex flex-col gap-4">
        {STAT_CONFIG.map(({ key, icon, color, bar }) => {
          const val = statValues[key] ?? 0
          const delta = todayDeltas[key] ?? 0
          const deltaLabel = delta > 0
            ? `+${delta} TODAY`
            : delta < 0
              ? `${delta} TODAY (DRAINED)`
              : 'NO CHANGE'
          const deltaColor = delta > 0 ? color : delta < 0 ? 'text-error' : 'text-on-surface-variant'
          return (
            <Card key={key} className="p-4 flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <div className="font-mono text-system-label text-on-surface-variant uppercase tracking-wider">{key}</div>
                <span aria-hidden="true" className={`material-symbols-outlined ${color}`} style={{ fontSize: '20px', fontVariationSettings: "'FILL' 1" }}>{icon}</span>
              </div>
              <div className="flex items-end gap-3">
                <div className="font-display text-headline-lg text-on-surface">{val}</div>
                <div className={`font-mono text-system-label mb-1 ${deltaColor}`}>{deltaLabel}</div>
              </div>
              <ProgressBar label={`${key} stat`} value={val} fill={bar} />
            </Card>
          )
        })}
      </section>

      {/* Operational Streak */}
      <Card as="section" className="p-5">
        <div className="font-mono text-system-label text-on-surface-variant mb-4 pb-2 border-b border-outline-variant">
          OPERATIONAL STREAK
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <span className="font-mono text-system-label text-on-surface">CURRENT</span>
            <span className="font-display text-stat-value text-secondary">{profile.current_streak} DAYS</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-mono text-system-label text-on-surface">BEST RECORD</span>
            <span className="font-display text-stat-value text-on-surface">{profile.best_streak} DAYS</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-mono text-system-label text-on-surface">RECOVERY</span>
            <span className={`font-mono text-system-label ${profile.streak_shield_active ? 'text-secondary' : 'text-outline'}`}>
              {profile.streak_shield_active ? 'AVAILABLE' : 'NONE'}
            </span>
          </div>
          {cycleNumber !== null && (
            <>
              <div className="flex justify-between items-center">
                <span className="font-mono text-system-label text-on-surface">CYCLE</span>
                <span className="font-mono text-system-label text-on-surface-variant">{cycleNumber}</span>
              </div>
              {daysRemaining !== null && (
                <div className="flex justify-between items-center">
                  <span className="font-mono text-system-label text-on-surface">DAYS REMAINING</span>
                  <span className="font-display text-stat-value text-on-surface">{daysRemaining}</span>
                </div>
              )}
              {completionRate !== null && (
                <div className="flex justify-between items-center">
                  <span className="font-mono text-system-label text-on-surface">STREAK RATE</span>
                  <span className={`font-mono text-system-label ${completionRate >= 60 ? 'text-secondary' : 'text-tertiary'}`}>
                    {completionRate}%
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </Card>

      {/* Milestone Log */}
      <Card as="section" className="p-5">
        <div className="font-mono text-system-label text-on-surface-variant mb-4 pb-2 border-b border-outline-variant">
          MILESTONE LOG
        </div>
        <div className="flex flex-col gap-3">
          {profile.level >= 1 && (
            <div className="flex justify-between items-center">
              <span className="font-mono text-xs text-outline">CURRENT</span>
              <span className="font-mono text-xs text-on-surface-variant">ACHIEVED LEVEL {profile.level}</span>
              <span className="font-mono text-xs text-secondary">+{profile.total_xp > 0 ? Math.floor(profile.total_xp / 100) * 100 : 0} XP</span>
            </div>
          )}
          {RANK_ROWS.filter(({ max }) => profile.level > max).slice(-3).reverse().map(({ rank, min }) => (
            <div key={rank} className="flex justify-between items-center opacity-60">
              <span className="font-mono text-xs text-outline">PAST</span>
              <span className="font-mono text-xs text-outline">REACHED RANK {rank}</span>
              <span className="font-mono text-xs text-outline">LV {min}</span>
            </div>
          ))}
          {profile.level <= 1 && (
            <p className="font-mono text-system-label text-outline text-center">No milestones yet. Begin ascending.</p>
          )}
        </div>
      </Card>
    </div>
  )
}
