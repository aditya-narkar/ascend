'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

type PushParams = {
  user_id: string
  title: string
  body: string
  tag?: string
  url?: string
  renotify?: boolean
}

type PushActionResult = {
  success: boolean
  error?: string
  sent?: number
  failed?: number
}

async function dispatchPushNotification(params: PushParams): Promise<PushActionResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const authSecret = process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !authSecret) {
    return { success: false, error: 'Missing Supabase notification configuration.' }
  }
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/send-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authSecret}`,
      },
      body: JSON.stringify(params),
    })
    const responseText = await res.text()
    if (!res.ok) {
      const error = responseText
      return { success: false, error: error || `Push send failed with ${res.status}.` }
    }
    try {
      const result = JSON.parse(responseText) as { sent?: number; failed?: number }
      return { success: true, sent: result.sent, failed: result.failed }
    } catch {
      return { success: true }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Push send failed.',
    }
  }
}

export async function sendPushNotification(params: PushParams): Promise<boolean> {
  const result = await dispatchPushNotification(params)
  return result.success
}

export async function sendTestPushNotification(): Promise<PushActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not signed in.' }

  return dispatchPushNotification({
    user_id: user.id,
    title: 'ASCEND TEST',
    body: 'Server push is working on this device.',
    tag: 'ascend-test',
    url: '/dashboard',
    renotify: true,
  })
}

function getSubscriptionEndpoint(subscription: Record<string, unknown>): string | null {
  const endpoint = subscription.endpoint
  return typeof endpoint === 'string' && endpoint.length > 0 ? endpoint : null
}

export async function saveNotificationSubscription(
  subscription: Record<string, unknown>,
): Promise<PushActionResult> {
  const endpoint = getSubscriptionEndpoint(subscription)
  if (!endpoint) return { success: false, error: 'Push subscription endpoint missing.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not signed in.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('push_subscriptions')
    .upsert(
      { user_id: user.id, endpoint, subscription, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,endpoint' },
    )

  if (!error) {
    return { success: true }
  }

  // Backward-compatible fallback for databases that have not applied the
  // multi-device push subscription migration yet.
  const { error: legacyError } = await admin
    .from('push_subscriptions')
    .upsert({ user_id: user.id, subscription }, { onConflict: 'user_id' })

  if (legacyError) {
    return { success: false, error: `${error.message}; fallback failed: ${legacyError.message}` }
  }

  return { success: true }
}
