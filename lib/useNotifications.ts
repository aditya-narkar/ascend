'use client'

import { useCallback, useEffect, useReducer, useState, useSyncExternalStore } from 'react'
import { saveNotificationSubscription, sendTestPushNotification } from '@/app/actions/notifications'
import { registerServiceWorker, subscribeUserToPush } from '@/lib/notifications'

export type PushAvailability = 'checking' | 'ok' | 'no-notifications' | 'no-push' | 'insecure'
export type PushPermission = NotificationPermission | 'unknown'

const noopSubscribe = () => () => {}

function detectAvailability(): PushAvailability {
  if (!('Notification' in window)) return 'no-notifications'
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'no-push'
  if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') return 'insecure'
  return 'ok'
}

// Subscribes this device and saves it. Throws a user-readable Error on any failure.
async function subscribeDevice(requestPermission: boolean, refresh: boolean): Promise<NotificationPermission> {
  let permission = Notification.permission
  if (permission === 'default' && requestPermission) permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error(`Notification permission is ${permission}.`)

  if (!(await registerServiceWorker())) throw new Error('Service worker registration failed.')

  const sub = await subscribeUserToPush({ refresh })
  if (!sub) throw new Error('Push subscription failed. Check the VAPID public key.')

  const saved = await saveNotificationSubscription(sub.toJSON() as Record<string, unknown>)
  if (!saved.success) throw new Error(saved.error ?? 'Subscription save failed.')
  return permission
}

// Browser push state + actions. When alerts are already allowed it silently
// re-subscribes this device on mount (covers reinstalls and rotated push keys).
export function useNotifications() {
  const availability = useSyncExternalStore<PushAvailability>(noopSubscribe, detectAvailability, () => 'checking')
  // Notification.permission changes only through our own calls, so re-render (and re-read it) after them.
  const [, rerender] = useReducer((n: number) => n + 1, 0)
  const permission = useSyncExternalStore<PushPermission>(
    noopSubscribe,
    () => ('Notification' in window ? Notification.permission : 'denied'),
    () => 'unknown',
  )
  const [status, setStatus] = useState('')
  const [testing, setTesting] = useState(false)

  const canSync = availability === 'ok' && permission === 'granted'
  useEffect(() => {
    if (!canSync) return
    subscribeDevice(false, false).catch(() => setStatus('Push setup failed. Use Send test to retry.'))
  }, [canSync])

  const enable = useCallback(async () => {
    setStatus('Preparing push channel...')
    try {
      await subscribeDevice(true, false)
      setStatus('Alerts are on.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Notification setup failed.')
    } finally {
      rerender()
    }
  }, [])

  const test = useCallback(async () => {
    setTesting(true)
    setStatus('Refreshing this device...')
    try {
      await subscribeDevice(true, true)
      setStatus('Sending test alert...')
      const result = await sendTestPushNotification()
      if (!result.success) throw new Error(result.error ?? 'Test alert failed.')
      const devices = typeof result.sent === 'number' ? ` Sent to ${result.sent} device${result.sent === 1 ? '' : 's'}.` : ''
      setStatus(`Test alert sent.${devices} Lock your phone or watch for the banner.`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Test alert failed.')
    } finally {
      setTesting(false)
      rerender()
    }
  }, [])

  return { availability, permission, status, testing, enable, test }
}
