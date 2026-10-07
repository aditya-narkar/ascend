'use client'

import Button from '@/components/ui/Button'

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-[#14121a] flex items-center justify-center px-4">
      <div className="text-center space-y-6 max-w-sm">
        <div className="w-20 h-20 mx-auto bg-primary-container/10 border border-primary-container/30 flex items-center justify-center">
          <span aria-hidden="true" className="material-symbols-outlined text-[40px] text-primary-container">
            wifi_off
          </span>
        </div>

        <div>
          <div className="font-mono text-system-label text-error tracking-widest mb-2">
            CONNECTION LOST
          </div>
          <h1 className="font-display text-headline-md text-on-surface mb-2">System Offline</h1>
          <p className="font-mono text-system-label text-on-surface-variant">
            The system cannot reach its servers. Check your connection and try again.
          </p>
        </div>

        <Button block onClick={() => window.location.reload()}>
          RETRY CONNECTION
        </Button>

        <p className="font-mono text-xs text-outline">
          Previously loaded data may still be available below.
        </p>
      </div>
    </div>
  )
}
