import { cx } from './cx'

interface ProgressBarProps {
  value: number
  max?: number
  /** Accessible name — what is being measured. */
  label: string
  /** Any CSS background for the fill (colour or gradient). Defaults to the secondary token. */
  fill?: string
  className?: string
}

export default function ProgressBar({ value, max = 100, label, fill, className }: ProgressBarProps) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(value, max)}
      className={cx('h-1 w-full overflow-hidden bg-surface-container-high', className)}
    >
      <div className={cx('h-full transition-all duration-500', !fill && 'bg-secondary')} style={{ width: `${pct}%`, background: fill }} />
    </div>
  )
}
