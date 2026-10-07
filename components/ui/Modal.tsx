'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { cx } from './cx'

interface ModalProps {
  open: boolean
  /** Accessible name for the dialog. */
  label: string
  onClose: () => void
  /** Also close when the dimmed backdrop is clicked. */
  closeOnBackdrop?: boolean
  align?: 'center' | 'end'
  /** Classes for the panel. */
  className?: string
  children: ReactNode
}

const FOCUSABLE = 'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

// Dialog semantics, Escape to close, focus moved in on open (and restored on close), Tab kept inside.
export default function Modal({ open, label, onClose, closeOnBackdrop = false, align = 'center', className, children }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    const target = panel?.querySelector<HTMLElement>(FOCUSABLE) ?? panel
    target?.focus()
    return () => previous?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onClose()
      if (e.key !== 'Tab' || !panelRef.current) return
      const items = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
      if (items.length === 0) return e.preventDefault()
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className={cx(
        'fixed inset-0 z-50 flex justify-center bg-black/90 p-6 flicker-in',
        align === 'end' ? 'items-end pb-24' : 'items-center',
      )}
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={cx('w-full max-w-sm card-gradient border border-primary-container/50 outline-none', className)}
      >
        {children}
      </div>
    </div>
  )
}
