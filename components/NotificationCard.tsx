'use client'

import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import { useNotifications, type PushAvailability } from '@/lib/useNotifications'

const UNAVAILABLE: Record<Exclude<PushAvailability, 'ok' | 'checking'>, string> = {
  'no-notifications': "This browser doesn't support notifications.",
  'no-push': "This browser doesn't support push alerts. On iPhone, add ASCEND to your Home Screen first.",
  insecure: 'Push alerts need a secure (HTTPS) connection.',
}

export default function NotificationCard() {
  const { availability, permission, status, testing, enable, test } = useNotifications()

  // Hold the layout until the browser has been checked, so the card doesn't flash the wrong state.
  if (availability === 'checking') return null

  const blocked = availability === 'ok' && permission === 'denied'
  const enabled = availability === 'ok' && permission === 'granted'
  const unavailable = availability !== 'ok'

  const title = unavailable ? 'ALERTS UNAVAILABLE' : blocked ? 'ALERTS BLOCKED' : enabled ? 'ALERTS ON' : 'TURN ON ALERTS'
  const body = unavailable
    ? UNAVAILABLE[availability]
    : blocked
      ? 'Alerts are blocked for this site. Allow notifications in your browser or phone settings, then reload.'
      : enabled
        ? status || 'You will get quest reminders and penalty warnings. Send a test to confirm they reach this device.'
        : status || 'Get quest reminders and penalty warnings.'
  const problem = unavailable || blocked

  return (
    <Card as="section" id="alerts" aria-label="Alerts" tone={problem ? 'danger' : 'accent'} className="p-4 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h3 className={`font-mono text-system-label mb-1 ${problem ? 'text-error' : 'text-secondary'}`}>{title}</h3>
        <p role="status" className="font-mono text-xs text-on-surface-variant leading-relaxed">
          {body}
        </p>
      </div>

      {enabled ? (
        <Button variant="outline" onClick={test} disabled={testing} className="shrink-0">
          {testing ? 'SENDING...' : 'SEND TEST'}
        </Button>
      ) : !problem ? (
        <Button onClick={enable} className="shrink-0">
          ENABLE
        </Button>
      ) : null}
    </Card>
  )
}
