import type { ButtonHTMLAttributes } from 'react'
import { cx } from './cx'

type Variant = 'primary' | 'outline' | 'danger' | 'ghost'
type Size = 'md' | 'lg'

const VARIANT: Record<Variant, string> = {
  primary: 'border border-primary-edge bg-primary-container text-on-primary-container hover:shadow-glow',
  outline: 'border border-outline text-on-surface hover:border-secondary hover:text-secondary',
  danger: 'border border-error/60 bg-error/5 text-error hover:border-error hover:bg-error/10',
  ghost: 'border border-transparent text-on-surface-variant hover:text-on-surface',
}
const SIZE: Record<Size, string> = { md: 'min-h-11 px-4', lg: 'min-h-14 px-6' }

interface StyleOptions {
  variant?: Variant
  size?: Size
  block?: boolean
}

// Also usable on <Link>: <Link className={buttonClass({ variant: 'outline' })} />
export function buttonClass({ variant = 'primary', size = 'md', block = false }: StyleOptions = {}) {
  return cx(
    'inline-flex items-center justify-center gap-2 font-mono text-system-label uppercase tracking-widest transition-all',
    'disabled:cursor-not-allowed disabled:opacity-50',
    VARIANT[variant],
    SIZE[size],
    block && 'w-full',
  )
}

export default function Button({
  variant,
  size,
  block,
  className,
  type = 'button',
  ...props
}: StyleOptions & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={cx(buttonClass({ variant, size, block }), className)} {...props} />
}
