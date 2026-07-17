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

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
)

const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

type PushSubscriptionRow = {
  id?: string
  subscription: unknown
}

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

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const authHeader = req.headers.get('Authorization')

  if (authHeader !== `Bearer ${serviceRoleKey}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { user_id, title, body, tag, url, renotify } = await req.json()

  if (!user_id) {
    return new Response('Missing user_id', { status: 400 })
  }

  const { data: subscriptions, error } = await supabaseAdmin
    .from('push_subscriptions')
    .select('id, subscription')
    .eq('user_id', user_id)

  if (error || !subscriptions?.length) {
    return new Response('No subscription found', { status: 404 })
  }

  try {
    configureWebPush()
  } catch (err) {
    console.error('Push configuration failed:', err)
    return new Response('Push configuration failed', { status: 500 })
  }

  const payload = JSON.stringify({ title, body, tag, url, renotify })
  let sent = 0
  let failed = 0

  for (const sub of subscriptions as PushSubscriptionRow[]) {
    try {
      await webpush.sendNotification(sub.subscription, payload)
      sent++
    } catch (err) {
      failed++
      const status = getPushErrorStatus(err)
      if ((status === 404 || status === 410) && sub.id) {
        await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id)
      }
      console.error('Push failed:', err)
    }
  }

  if (sent === 0) {
    return new Response(JSON.stringify({ sent, failed }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ sent, failed }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
