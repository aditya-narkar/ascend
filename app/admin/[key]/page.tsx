import { createAdminClient } from '@/lib/supabase/admin'
import { getUTCDateString } from '@/lib/date'
import RefreshButton from './RefreshButton'
import type { UserProfile, Stats, Quest, Cycle } from '@/lib/types'

export const revalidate = 30

type DailySummary = {
  id: string
  user_id: string
  date: string
  streak_maintained: boolean
  weak_day: boolean
  quests_completed: number
}

export default async function AdminPage({
  params,
}: {
  params: Promise<{ key: string }>
}) {
  const { key } = await params

  if (key !== process.env.ADMIN_SECRET_KEY) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="font-display text-display-lg text-error">403</div>
          <div className="font-mono text-system-label text-on-surface-variant">
            ACCESS DENIED. INVALID CREDENTIALS.
          </div>
        </div>
      </div>
    )
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="font-mono text-system-label text-error text-center space-y-2">
          <div>CONFIGURATION ERROR</div>
          <div className="text-outline">SUPABASE_SERVICE_ROLE_KEY not set</div>
        </div>
      </div>
    )
  }

  const supabaseAdmin = createAdminClient()
  const today = getUTCDateString()

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7)
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0]

  console.log('[admin] today UTC:', today)
  console.log('[admin] Admin client URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
  console.log('[admin] Service key present:', !!process.env.SUPABASE_SERVICE_ROLE_KEY)

  // Fetch users and stats as separate queries — avoids FK join ambiguity
  const [usersRes, allStatsRes, todayQuestsRes, recentSummariesRes, cyclesRes] = await Promise.all([
    supabaseAdmin.from('users').select('*').order('created_at', { ascending: false }),
    supabaseAdmin.from('stats').select('*'),
    supabaseAdmin.from('quests').select('*').eq('date_assigned', today),
    supabaseAdmin
      .from('daily_summary')
      .select('*')
      .gte('date', sevenDaysAgoStr)
      .order('date', { ascending: true }),
    supabaseAdmin.from('cycles').select('*').eq('is_complete', false),
  ])

  // Collect any DB errors for the in-page debug banner
  const errors: string[] = []
  if (usersRes.error) errors.push(`users: ${usersRes.error.message}`)
  if (allStatsRes.error) errors.push(`stats: ${allStatsRes.error.message}`)
  if (todayQuestsRes.error) errors.push(`quests: ${todayQuestsRes.error.message}`)
  if (recentSummariesRes.error) errors.push(`daily_summary: ${recentSummariesRes.error.message}`)
  if (cyclesRes.error) errors.push(`cycles: ${cyclesRes.error.message}`)

  const rawUsers = (usersRes.data ?? []) as UserProfile[]
  const allStats = (allStatsRes.data ?? []) as Stats[]
  const todayQuests = (todayQuestsRes.data ?? []) as Quest[]
  const recentSummaries = (recentSummariesRes.data ?? []) as DailySummary[]
  const cycles = (cyclesRes.data ?? []) as Cycle[]

  // Merge stats into users manually
  const users = rawUsers.map((u) => ({
    ...u,
    userStats: allStats.find((s) => s.user_id === u.id) ?? null,
  }))

  console.log('[admin] users fetched:', users.length)
  console.log('[admin] today quests:', todayQuests.length)
  console.log('[admin] summaries:', recentSummaries.length)
  if (errors.length) console.error('[admin] query errors:', errors)

  const totalUsers = users.length
  const activeToday = todayQuests
    .filter((q) => q.is_completed)
    .map((q) => q.user_id)
    .filter((v, i, a) => a.indexOf(v) === i).length
  const questsCompletedToday = todayQuests.filter((q) => q.is_completed).length
  const xpEarnedToday = todayQuests
    .filter((q) => q.is_completed)
    .reduce((sum, q) => sum + (q.xp_reward ?? 0), 0)

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="border-b border-outline-variant px-8 py-4 flex justify-between items-center sticky top-0 bg-surface z-40">
        <div>
          <div className="font-mono text-system-label text-secondary tracking-widest">
            ASCEND SYSTEM
          </div>
          <h1 className="font-display text-headline-md text-on-surface">ADMIN CONSOLE</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-mono text-system-label text-outline">
            {new Date().toLocaleDateString()}
          </span>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-secondary rounded-full animate-pulse" />
            <span className="font-mono text-system-label text-secondary">LIVE</span>
          </div>
          <RefreshButton />
        </div>
      </header>

      {/* DB error banner — only shown if queries failed */}
      {errors.length > 0 && (
        <div className="mx-8 mt-6 border border-error/40 bg-error/10 p-4 flex flex-col gap-2">
          <div className="font-mono text-system-label text-error flex items-center gap-2">
            <span className="material-symbols-outlined text-[14px]">error</span>
            DATABASE QUERY ERRORS — CHECK SERVICE ROLE KEY AND TABLE PERMISSIONS
          </div>
          {errors.map((e) => (
            <div key={e} className="font-mono text-[10px] text-error/70">
              {e}
            </div>
          ))}
        </div>
      )}

      {/* Overview stats */}
      <section className="grid grid-cols-4 gap-4 px-8 py-6">
        {[
          { label: 'TOTAL HUNTERS', value: totalUsers, color: 'text-primary', icon: 'group' },
          { label: 'ACTIVE TODAY', value: activeToday, color: 'text-secondary', icon: 'bolt' },
          {
            label: 'QUESTS DONE TODAY',
            value: questsCompletedToday,
            color: 'text-tertiary',
            icon: 'check_circle',
          },
          {
            label: 'XP EARNED TODAY',
            value: xpEarnedToday.toLocaleString(),
            color: 'text-[#6CCBFF]',
            icon: 'stars',
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="card-gradient border border-outline-variant p-6 flex flex-col gap-3"
          >
            <div className="flex justify-between items-start">
              <span className="font-mono text-system-label text-on-surface-variant">
                {stat.label}
              </span>
              <span className="material-symbols-outlined text-outline-variant">{stat.icon}</span>
            </div>
            <div className={`font-display text-display-lg ${stat.color} leading-none`}>
              {stat.value}
            </div>
          </div>
        ))}
      </section>

      {/* User records */}
      <section className="px-8 pb-8">
        <h2 className="font-mono text-system-label text-on-surface-variant mb-6 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">person_search</span>
          HUNTER RECORDS
        </h2>

        <div className="flex flex-col gap-6">
          {users.map((user) => {
            const userTodayQuests = todayQuests.filter((q) => q.user_id === user.id)
            const completedToday = userTodayQuests.filter((q) => q.is_completed).length
            const totalTodayQuests = userTodayQuests.length
            const userStats = user.userStats
            const userSummaries = recentSummaries.filter((s) => s.user_id === user.id)
            const userCycle = cycles.find((c) => c.user_id === user.id)
            const daysSinceJoined = Math.floor(
              (Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24),
            )

            const last7Days = Array.from({ length: 7 }, (_, i) => {
              const date = new Date()
              date.setUTCDate(date.getUTCDate() - (6 - i))
              const dateStr = date.toISOString().split('T')[0]
              const summary = userSummaries.find((s) => s.date === dateStr)
              return {
                date: dateStr,
                status: !summary
                  ? 'none'
                  : summary.streak_maintained
                    ? 'success'
                    : summary.weak_day
                      ? 'weak'
                      : summary.quests_completed > 0
                        ? 'weak'
                        : 'failed',
              }
            })

            return (
              <div
                key={user.id}
                className="card-gradient border border-outline-variant relative overflow-hidden"
              >
                {/* Corner accents */}
                <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-primary opacity-30" />
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-primary opacity-30" />

                {/* Penalty banner */}
                {user.penalty_tier > 0 && (
                  <div
                    className={`px-4 py-2 font-mono text-system-label uppercase tracking-widest flex items-center gap-2 ${
                      user.penalty_tier === 3
                        ? 'bg-error/15 text-error border-b border-error/30'
                        : user.penalty_tier === 2
                          ? 'bg-error/10 text-error border-b border-error/20'
                          : 'bg-error/5 text-error/70 border-b border-error/10'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[14px]">warning</span>
                    PENALTY TIER {user.penalty_tier}
                    {user.penalty_zone_active && ' — PENALTY ZONE ACTIVE'}
                  </div>
                )}

                <div className="p-6">
                  <div className="grid grid-cols-12 gap-6">
                    {/* COLUMN 1 — Identity */}
                    <div className="col-span-3 flex flex-col gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-[#6CCBFF]/10 border border-[#6CCBFF] flex items-center justify-center flex-shrink-0">
                          <span className="font-display text-[20px] text-[#6CCBFF] font-bold">
                            {user.hunter_name?.[0]?.toUpperCase() ?? '?'}
                          </span>
                        </div>
                        <div>
                          <div className="font-display text-headline-md text-on-surface">
                            {user.hunter_name}
                          </div>
                          <div className="font-mono text-system-label text-secondary">
                            {user.archetype}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        {[
                          { label: 'RANK', value: user.rank, className: 'text-primary' },
                          {
                            label: 'LEVEL',
                            value: user.level,
                            className: 'font-display text-stat-value text-on-surface',
                          },
                          {
                            label: 'TOTAL XP',
                            value: user.total_xp?.toLocaleString(),
                            className: 'text-[#6CCBFF]',
                          },
                          { label: 'DAY', value: daysSinceJoined, className: 'text-outline' },
                        ].map(({ label, value, className }) => (
                          <div key={label} className="flex justify-between">
                            <span className="font-mono text-system-label text-on-surface-variant">
                              {label}
                            </span>
                            <span className={`font-mono text-system-label ${className}`}>
                              {value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* COLUMN 2 — Today's Hunt */}
                    <div className="col-span-3 flex flex-col gap-4">
                      <div className="font-mono text-system-label text-on-surface-variant border-b border-outline-variant pb-2">
                        TODAY&apos;S HUNT
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <svg width="56" height="56">
                            <circle
                              cx="28"
                              cy="28"
                              r="22"
                              fill="none"
                              stroke="rgba(255,255,255,0.06)"
                              strokeWidth="5"
                            />
                            <circle
                              cx="28"
                              cy="28"
                              r="22"
                              fill="none"
                              stroke={
                                completedToday >= totalTodayQuests && totalTodayQuests > 0
                                  ? '#34d399'
                                  : completedToday > 0
                                    ? '#6CCBFF'
                                    : 'rgba(255,255,255,0.06)'
                              }
                              strokeWidth="5"
                              strokeDasharray={2 * Math.PI * 22}
                              strokeDashoffset={
                                2 *
                                Math.PI *
                                22 *
                                (1 - (totalTodayQuests > 0 ? completedToday / totalTodayQuests : 0))
                              }
                              transform="rotate(-90 28 28)"
                            />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center font-display text-[14px] font-bold text-on-surface">
                            {completedToday}/{totalTodayQuests}
                          </div>
                        </div>
                        <div className="flex flex-col gap-1">
                          <div className="font-mono text-system-label text-outline">COMPLETED</div>
                          <div className="font-display text-stat-value text-on-surface">
                            {completedToday} quests
                          </div>
                          <div className="font-mono text-system-label text-[#6CCBFF]">
                            +
                            {userTodayQuests
                              .filter((q) => q.is_completed)
                              .reduce((sum, q) => sum + (q.xp_reward ?? 0), 0)}{' '}
                            XP
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1">
                        {userTodayQuests.map((quest) => (
                          <div key={quest.id} className="flex items-center gap-2">
                            <div
                              className={`w-3 h-3 border flex-shrink-0 ${
                                quest.is_completed
                                  ? 'bg-secondary/20 border-secondary'
                                  : 'border-outline-variant'
                              }`}
                            >
                              {quest.is_completed && (
                                <span className="material-symbols-outlined text-secondary text-[10px] leading-none">
                                  check
                                </span>
                              )}
                            </div>
                            <span
                              className={`font-mono text-[10px] truncate ${
                                quest.is_completed
                                  ? 'text-on-surface-variant line-through'
                                  : 'text-on-surface'
                              }`}
                            >
                              {quest.title}
                            </span>
                          </div>
                        ))}
                        {userTodayQuests.length === 0 && (
                          <span className="font-mono text-system-label text-outline">
                            No quests generated
                          </span>
                        )}
                      </div>
                    </div>

                    {/* COLUMN 3 — Stat Matrix */}
                    <div className="col-span-3 flex flex-col gap-4">
                      <div className="font-mono text-system-label text-on-surface-variant border-b border-outline-variant pb-2">
                        STAT MATRIX
                      </div>

                      {userStats ? (
                        <div className="flex flex-col gap-2">
                          {(
                            [
                              { key: 'strength', color: '#FF6B6B' },
                              { key: 'focus', color: '#6CCBFF' },
                              { key: 'discipline', color: '#A78BFA' },
                              { key: 'confidence', color: '#34D399' },
                              { key: 'intelligence', color: '#8EF0FF' },
                              { key: 'purpose', color: '#FFC432' },
                              { key: 'energy', color: '#FF9F50' },
                            ] as const
                          ).map((stat) => (
                            <div key={stat.key}>
                              <div className="flex justify-between mb-1">
                                <span className="font-mono text-[9px] text-on-surface-variant uppercase tracking-wider">
                                  {stat.key}
                                </span>
                                <span className="font-mono text-[9px] text-on-surface">
                                  {userStats[stat.key] ?? 0}
                                </span>
                              </div>
                              <div className="h-1 bg-surface-container-high">
                                <div
                                  className="h-full"
                                  style={{
                                    background: stat.color,
                                    width: `${Math.min(userStats[stat.key] ?? 0, 100)}%`,
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="font-mono text-system-label text-outline">No stats</span>
                      )}
                    </div>

                    {/* COLUMN 4 — Activity Log */}
                    <div className="col-span-3 flex flex-col gap-4">
                      <div className="font-mono text-system-label text-on-surface-variant border-b border-outline-variant pb-2">
                        ACTIVITY LOG
                      </div>

                      <div className="flex flex-col gap-2">
                        <span className="font-mono text-[10px] text-outline">LAST 7 DAYS</span>
                        <div className="flex gap-2">
                          {last7Days.map((day, i) => (
                            <div key={i} className="flex flex-col items-center gap-1">
                              <div
                                className={`w-6 h-6 border flex items-center justify-center ${
                                  day.status === 'success'
                                    ? 'bg-secondary/20 border-secondary'
                                    : day.status === 'weak'
                                      ? 'bg-tertiary/20 border-tertiary/50'
                                      : day.status === 'failed'
                                        ? 'bg-error/20 border-error/50'
                                        : 'border-outline-variant opacity-30'
                                }`}
                              >
                                {day.status === 'success' && (
                                  <span className="material-symbols-outlined text-secondary text-[12px]">
                                    check
                                  </span>
                                )}
                                {day.status === 'failed' && (
                                  <span className="material-symbols-outlined text-error text-[12px]">
                                    close
                                  </span>
                                )}
                                {day.status === 'weak' && (
                                  <span className="material-symbols-outlined text-tertiary text-[12px]">
                                    remove
                                  </span>
                                )}
                              </div>
                              <span className="font-mono text-[8px] text-outline">
                                {new Date(day.date + 'T00:00:00Z').getUTCDate()}
                              </span>
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-4 mt-1">
                          {[
                            { color: 'bg-secondary', label: 'MET' },
                            { color: 'bg-tertiary/50', label: 'WEAK' },
                            { color: 'bg-error/50', label: 'FAIL' },
                          ].map(({ color, label }) => (
                            <div key={label} className="flex items-center gap-1">
                              <div className={`w-2 h-2 ${color}`} />
                              <span className="font-mono text-[9px] text-outline">{label}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 border-t border-outline-variant pt-3">
                        <div className="flex justify-between">
                          <span className="font-mono text-system-label text-on-surface-variant">
                            STREAK
                          </span>
                          <span className="font-display text-stat-value text-tertiary">
                            {user.current_streak}d
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-mono text-system-label text-on-surface-variant">
                            CYCLE
                          </span>
                          <span className="font-mono text-system-label text-primary">
                            {userCycle?.cycle_number ?? 1}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-mono text-system-label text-on-surface-variant">
                            SHIELD
                          </span>
                          <span
                            className={`font-mono text-system-label ${
                              user.streak_shield_active ? 'text-secondary' : 'text-outline'
                            }`}
                          >
                            {user.streak_shield_active ? 'READY' : 'NOT EARNED'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-mono text-system-label text-on-surface-variant">
                            PENALTY
                          </span>
                          <span
                            className={`font-mono text-system-label ${
                              user.penalty_tier > 0 ? 'text-error' : 'text-secondary'
                            }`}
                          >
                            TIER {user.penalty_tier}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}

          {users.length === 0 && errors.length === 0 && (
            <div className="font-mono text-system-label text-outline text-center py-12">
              NO HUNTERS REGISTERED
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
