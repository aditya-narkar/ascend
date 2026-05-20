import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { logout } from '@/app/actions/auth'
import type { UserProfile, Stats } from '@/lib/types'

const RANK_ORDER = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'Monarch'] as const

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [profileRes, statsRes, completedRes, cyclesRes, penaltyRes] = await Promise.all([
    supabase.from('users').select('*').eq('id', user.id).single(),
    supabase.from('stats').select('*').eq('user_id', user.id).single(),
    supabase.from('quests').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_completed', true),
    supabase.from('cycles').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_complete', true),
    supabase.from('daily_summary').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('penalty_triggered', true),
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
    { name: 'FIRST BLOOD',     earned: completedCount >= 1 },
    { name: 'CONSISTENT',      earned: profile.current_streak >= 7 },
    { name: 'IRON WILL',       earned: profile.current_streak >= 21 },
    { name: 'CYCLE COMPLETE',  earned: cyclesCompleted >= 1 },
    { name: 'SHADOW RETURNED', earned: hadPenalty && profile.current_streak > 0 },
    { name: 'E-RANK HUNTER',   earned: rankIndex >= 1 },
    { name: 'FOCUSED',         earned: (stats?.focus ?? 0) >= 50 },
    { name: 'SHIELD BEARER',   earned: profile.streak_shield_active },
  ]

  return (
    <div className="max-w-lg mx-auto flex flex-col pb-24">

      {/* Identity Block */}
      <section className="card-gradient border border-outline-variant p-6 relative overflow-hidden mx-4 mt-4">
        <div className="absolute top-0 right-0 w-6 h-6 border-t border-r border-primary-container opacity-40" />
        <div className="absolute bottom-0 left-0 w-6 h-6 border-b border-l border-primary-container opacity-40" />

        <div className="flex items-start gap-4">
          <div className="w-20 h-20 bg-secondary/10 border border-secondary flex items-center justify-center shrink-0">
            <span className="font-display text-[32px] text-secondary font-bold">
              {(profile.hunter_name?.[0] ?? '?').toUpperCase()}
            </span>
          </div>
          <div className="flex flex-col gap-1.5 flex-1 min-w-0">
            <h2 className="font-display text-headline-lg text-on-surface">{profile.hunter_name}</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-system-label text-secondary">{profile.archetype?.toUpperCase()} ARCHETYPE</span>
              <span className="w-1 h-1 bg-outline-variant rounded-full" />
              <span className="font-mono text-system-label text-primary">RANK: {profile.rank}</span>
            </div>
          </div>
          <form action={logout}>
            <button type="submit" className="font-mono text-system-label text-outline hover:text-on-surface border border-outline-variant hover:border-outline px-3 py-2 transition-colors shrink-0">
              LOGOUT
            </button>
          </form>
        </div>
      </section>

      <div className="flex flex-col gap-4 px-4 mt-4">

        {/* Founding Oath */}
        <div className="card-gradient border border-outline-variant p-5 relative">
          <div className="absolute top-0 left-0 w-full h-0.5 bg-primary-container/30" />
          <h3 className="font-mono text-system-label text-on-surface-variant mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>menu_book</span>
            FOUNDING OATH
          </h3>
          <p className="font-display text-[15px] italic text-on-surface/80 leading-relaxed">
            &ldquo;{profile.commitment_text || 'No oath recorded.'}&rdquo;
          </p>
        </div>

        {/* Battle Record — 4 items matching screenshot */}
        <div className="flex flex-col gap-3">
          <h3 className="font-mono text-system-label text-on-surface-variant flex items-center gap-2">
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>military_tech</span>
            BATTLE RECORD
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'TOTAL QUESTS',   value: completedCount,                             color: 'text-secondary' },
              { label: 'CURRENT STREAK', value: profile.current_streak,                     color: 'text-secondary' },
              { label: 'BEST STREAK',    value: profile.best_streak,                        color: 'text-on-surface' },
              { label: 'TOTAL XP',       value: `${(profile.total_xp / 1000).toFixed(1)}K`, color: 'text-secondary' },
            ].map(({ label, value, color }) => (
              <div key={label} className="card-gradient border border-outline-variant p-4 flex flex-col gap-2">
                <span className="font-mono text-system-label text-on-surface-variant">{label}</span>
                <span className={`font-display text-headline-md font-bold ${color}`}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Titles & Achievements */}
        <div className="flex flex-col gap-3">
          <h3 className="font-mono text-system-label text-on-surface-variant flex items-center gap-2">
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>workspace_premium</span>
            TITLES &amp; ACHIEVEMENTS
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {TITLES.map(({ name, earned }) => (
              <div
                key={name}
                className={`p-4 flex flex-col items-center justify-center text-center gap-1.5 min-h-18 transition-colors ${
                  earned
                    ? 'bg-card-bg-top border border-secondary shadow-[0_0_4px_rgba(126,208,255,0.25)]'
                    : 'bg-surface-container-low border border-outline-variant opacity-50'
                }`}
              >
                {!earned && (
                  <span className="material-symbols-outlined text-outline" style={{ fontSize: '14px' }}>lock</span>
                )}
                <span className={`font-mono text-[10px] tracking-widest ${earned ? 'text-secondary' : 'text-outline'}`}>
                  {name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
