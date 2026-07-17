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
}

async function dispatchPushNotification(params: PushParams): Promise<PushActionResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return { success: false, error: 'Missing Supabase service configuration.' }
  }
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/send-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify(params),
    })
    if (!res.ok) {
      const error = await res.text()
      return { success: false, error: error || `Push send failed with ${res.status}.` }
    }
    return { success: true }
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
    .upsert({ user_id: user.id, subscription }, { onConflict: 'user_id' })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}
