import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <p
          className="text-xs tracking-[0.4em] text-text-secondary mb-4"
          style={{ fontFamily: 'var(--font-share-tech-mono)' }}
        >
          SYSTEM ERROR 404
        </p>
        <p
          className="text-6xl font-bold text-highlight-1 text-glow mb-2"
          style={{ fontFamily: 'var(--font-rajdhani)' }}
        >
          404
        </p>
        <p
          className="text-lg font-bold text-text-primary mb-2"
          style={{ fontFamily: 'var(--font-rajdhani)' }}
        >
          LOCATION NOT FOUND
        </p>
        <p
          className="text-xs text-text-secondary/50 mb-8"
          style={{ fontFamily: 'var(--font-share-tech-mono)' }}
        >
          The system could not locate this resource.
        </p>
        <Link
          href="/dashboard"
          className="text-xs tracking-[0.2em] border border-aura-primary/60 px-6 py-3 text-highlight-1 hover:bg-aura-primary/10 transition-colors rounded-sm"
          style={{ fontFamily: 'var(--font-share-tech-mono)' }}
        >
          RETURN TO CONSOLE
        </Link>
      </div>
    </div>
  )
}
