import webpush from 'npm:web-push'
import { createClient } from 'npm:@supabase/supabase-js'

const vapidPublicKey =
  Deno.env.get('VAPID_PUBLIC_KEY') ??
  Deno.env.get('NEXT_PUBLIC_VAPID_PUBLIC_KEY') ??
  ''
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
const vapidEmailRaw = Deno.env.get('VAPID_EMAIL') ?? ''
const vapidSubject = vapidEmailRaw.startsWith('mailto:')
  ? vapidEmailRaw
  : `mailto:${vapidEmailRaw}`

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
)

type PushSubscriptionRow = {
  id?: string
  subscription: unknown
}

type ReminderSlot = 'morning' | 'midday' | 'evening' | 'final' | 'none'

function configureWebPush() {
  if (!vapidPublicKey || !vapidPrivateKey || !vapidEmailRaw) {
    throw new Error('Missing VAPID configuration')
  }

  webpush.setVapidDetails(
    vapidSubject,
    vapidPublicKey,
    vapidPrivateKey,
  )
}

function getPushErrorStatus(err: unknown): number | null {
  if (typeof err !== 'object' || err === null) return null
  const statusCode = (err as { statusCode?: unknown }).statusCode
  return typeof statusCode === 'number' ? statusCode : null
}

function getISTParts(now: Date): { date: string; hour: number; minute: number } {
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000)
  return {
    date: ist.toISOString().split('T')[0],
    hour: ist.getUTCHours(),
    minute: ist.getUTCMinutes(),
  }
}

function getReminderSlot(hour: number, minute: number): ReminderSlot {
  if (minute !== 0 && minute !== 30) return 'none'
  if (hour === 9 && minute === 0) return 'morning'
  if (hour === 14 && minute === 0) return 'midday'
  if (hour === 20 && minute === 0) return 'evening'
  if (hour === 23 && minute === 30) return 'final'
  return 'none'
}

async function sendToUser(
  userId: string,
  title: string,
  body: string,
  tag: string,
  url?: string,
  renotify = false,
) {
  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('id, subscription')
    .eq('user_id', userId)

  if (!subscriptions?.length) return

  try {
    configureWebPush()
  } catch {
    return
  }

  const payload = JSON.stringify({ title, body, tag, url, renotify })

  for (const sub of subscriptions as PushSubscriptionRow[]) {
    try {
      await webpush.sendNotification(sub.subscription, payload, {
        TTL: 12 * 60 * 60,
        urgency: 'high',
        topic: tag,
      })
    } catch (err) {
      const status = getPushErrorStatus(err)
      if ((status === 404 || status === 410) && sub.id) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id)
      }
    }
  }
}

Deno.serve(async () => {
  const now = new Date()
  const { date: today, hour, minute } = getISTParts(now)
  const reminderSlot = getReminderSlot(hour, minute)

  // Get all users with push subscriptions
  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('user_id')

  if (!subscriptions?.length) {
    return new Response(JSON.stringify({ ok: true, sent: 0 }), { status: 200 })
  }

  const userIds = [...new Set(subscriptions.map((s: { user_id: string }) => s.user_id))]
  let sent = 0

  for (const userId of userIds) {
    const { data: user } = await supabase
      .from('users')
      .select('hunter_name, current_streak, penalty_tier, penalty_zone_active, penalty_zone_started_at')
      .eq('id', userId)
      .single()

    if (!user) continue

    const { count: completedToday } = await supabase
      .from('quests')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('date_assigned', today)
      .eq('is_completed', true)

    const done = completedToday ?? 0

    const { data: activeSel } = await supabase
      .from('quest_selections')
      .select('cycle_number')
      .eq('user_id', userId)
      .eq('is_active', true)
      .gte('expires_date', today)
      .limit(1)
      .maybeSingle()

    const cycleNumber = activeSel?.cycle_number ?? 1
    const thresholds = [0, 4, 5, 6, 7]
    const threshold = thresholds[Math.min(cycleNumber, 4)]

    const name = user.hunter_name ?? 'Hunter'

    // Penalty zone reminders
    if (user.penalty_zone_active && user.penalty_zone_started_at) {
      const startMs = new Date(user.penalty_zone_started_at).getTime()
      const hoursElapsed = (Date.now() - startMs) / 3600000
      const hoursRemaining = Math.max(0, 12 - hoursElapsed)

      if (minute === 0 && hour % 2 === 0) {
        if (hour >= 7 && hour < 23) {
          await sendToUser(
            userId,
            'Penalty Zone Active',
            `${Math.ceil(hoursRemaining)} hours remaining. Complete or face consequences.`,
            'penalty-zone',
            '/dashboard',
            true,
          )
          sent++
        }
      }
      continue
    }

    if (reminderSlot === 'morning' && done === 0) {
      const { count: totalQuests } = await supabase
        .from('quests')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('date_assigned', today)
      await sendToUser(
        userId,
        'System Active',
        `Your daily hunt is waiting. ${totalQuests ?? 0} quests assigned. Begin.`,
        'morning-reminder',
        '/dashboard',
      )
      sent++
    } else if (reminderSlot === 'midday' && done < Math.floor(threshold / 2)) {
      const { count: total } = await supabase
        .from('quests')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('date_assigned', today)
      const remaining = (total ?? 0) - done
      await sendToUser(
        userId,
        `Hunter ${name}`,
        `${remaining} quests remaining. Momentum builds now. Don't fall behind.`,
        'midday-reminder',
        '/dashboard',
      )
      sent++
    } else if (reminderSlot === 'evening' && done < threshold) {
      const { count: total } = await supabase
        .from('quests')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('date_assigned', today)
      const remaining = (total ?? 0) - done
      await sendToUser(
        userId,
        '3 Hours Remaining',
        `${remaining} quests unresolved. The system is watching. Finish the hunt.`,
        'evening-reminder',
        '/dashboard',
      )
      sent++
    } else if (reminderSlot === 'final' && done < threshold) {
      const { count: total } = await supabase
        .from('quests')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('date_assigned', today)
      const remaining = (total ?? 0) - done
      const streakText = user.current_streak > 3
        ? ` ${user.current_streak} day streak is at risk.`
        : ''
      await sendToUser(
        userId,
        'Final Warning',
        `${remaining} quests still unfinished. Midnight is close.${streakText} Complete the daily task now.`,
        'final-warning',
        '/dashboard',
        true,
      )
      sent++
    }
  }

  return new Response(JSON.stringify({ ok: true, sent }), { status: 200 })
})
