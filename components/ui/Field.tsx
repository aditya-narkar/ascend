import type { InputHTMLAttributes, ReactNode } from 'react'
import { cx } from './cx'

export function Field({ label, id, className, ...props }: { label: string; id: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block font-mono text-xs tracking-widest text-on-surface-variant">
        {label}
      </label>
      <input
        id={id}
        name={id}
        className={cx(
          'w-full border border-outline-variant bg-surface-container px-3 py-3 font-body text-sm text-on-surface placeholder-outline transition-colors focus:border-secondary',
          className,
        )}
        {...props}
      />
    </div>
  )
}

export function FormMessage({ tone, children }: { tone: 'error' | 'info'; children: ReactNode }) {
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={cx(
        'border px-3 py-2 font-mono text-xs leading-relaxed',
        tone === 'error' ? 'border-error/40 bg-error/10 text-error' : 'border-secondary/40 bg-secondary/10 text-secondary',
      )}
    >
      {children}
    </p>
  )
}
