'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/dashboard', label: 'TODAY', icon: 'gps_fixed' },
  { href: '/stats', label: 'STATS', icon: 'equalizer' },
  { href: '/profile', label: 'PROFILE', icon: 'person' },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Main"
      className="bg-surface-container-lowest border-t border-outline-variant fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-2 h-16"
    >
      {NAV.map((item) => {
        const active = pathname.startsWith(item.href)

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`flex flex-col items-center justify-center pt-2 px-4 h-full w-full transition-colors ${
              active
                ? 'text-secondary border-t-2 border-secondary'
                : 'text-outline hover:bg-surface-variant/20'
            }`}
          >
            <span aria-hidden="true" className="material-symbols-outlined mb-1" style={{ fontSize: '20px' }}>
              {item.icon}
            </span>
            <span className="font-mono text-system-label">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
