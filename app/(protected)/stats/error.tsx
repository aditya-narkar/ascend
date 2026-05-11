'use client'

export default function StatsError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <p
          className="text-xs tracking-[0.4em] text-text-secondary mb-3"
          style={{ fontFamily: 'var(--font-share-tech-mono)' }}
        >
          SYSTEM ERROR
        </p>
        <p
          className="text-5xl font-bold text-highlight-1 mb-4"
          style={{ fontFamily: 'var(--font-rajdhani)' }}
        >
          !
        </p>
        <p
          className="text-sm text-text-secondary mb-6"
          style={{ fontFamily: 'var(--font-share-tech-mono)' }}
        >
          System error. Retry.
        </p>
        <button
          onClick={reset}
          className="text-xs tracking-[0.2em] border border-aura-primary/60 px-6 py-3 text-highlight-1 hover:bg-aura-primary/10 transition-colors rounded-sm"
          style={{ fontFamily: 'var(--font-share-tech-mono)' }}
        >
          RETRY
        </button>
      </div>
    </div>
  )
}
