import type { HTMLAttributes } from 'react'
import { cx } from './cx'

const TONE = {
  default: 'border-outline-variant',
  accent: 'border-secondary/40',
  danger: 'border-error/40',
  dashed: 'border-dashed border-outline-variant',
} as const

interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: 'section' | 'article' | 'div'
  tone?: keyof typeof TONE
  /** Decorative corner brackets (top-right, bottom-left). */
  corners?: boolean
}

export default function Card({ as: Tag = 'div', tone = 'default', corners = false, className, children, ...props }: CardProps) {
  return (
    <Tag className={cx('card-gradient border', TONE[tone], corners && 'relative overflow-hidden', className)} {...props}>
      {corners && (
        <>
          <span aria-hidden="true" className="absolute right-0 top-0 h-6 w-6 border-r-2 border-t-2 border-primary opacity-50" />
          <span aria-hidden="true" className="absolute bottom-0 left-0 h-6 w-6 border-b-2 border-l-2 border-primary opacity-50" />
        </>
      )}
      {children}
    </Tag>
  )
}
