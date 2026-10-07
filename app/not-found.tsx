import Link from 'next/link'
import { buttonClass } from '@/components/ui/Button'

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-sm text-center">
        <p className="mb-4 font-mono text-xs tracking-[0.4em] text-on-surface-variant">SYSTEM ERROR 404</p>
        <p className="mb-2 font-display text-6xl font-bold text-secondary text-glow">404</p>
        <h1 className="mb-2 font-display text-lg font-bold text-on-surface">LOCATION NOT FOUND</h1>
        <p className="mb-8 font-mono text-xs text-on-surface-variant">This page doesn&apos;t exist or has moved.</p>
        <Link href="/dashboard" className={buttonClass({ variant: 'outline' })}>
          RETURN TO TODAY
        </Link>
      </div>
    </main>
  )
}
