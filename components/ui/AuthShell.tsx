import type { ReactNode } from 'react'
import Card from './Card'

// Shared frame for the signed-out screens (login, signup, forgot / reset password).
export default function AuthShell({ eyebrow, title, footer, children }: { eyebrow: string; title: string; footer?: ReactNode; children: ReactNode }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center bg-background p-4">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/4 h-96 w-96 -translate-x-1/2 rounded-full bg-primary-container/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="mb-10 text-center">
          <p className="mb-2 font-mono text-xs tracking-[0.4em] text-on-surface-variant">{eyebrow}</p>
          <h1 className="font-display text-4xl font-bold tracking-widest text-on-surface">ASCEND</h1>
          <div className="mt-3 h-px bg-gradient-to-r from-transparent via-primary-container to-transparent" />
        </div>

        <Card corners className="p-8 shadow-aura">
          <h2 className="mb-6 font-mono text-xs tracking-[0.3em] text-on-surface-variant">{title}</h2>
          {children}
        </Card>

        {footer && <div className="mt-6 text-center font-mono text-xs text-on-surface-variant">{footer}</div>}
      </div>
    </main>
  )
}
