'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/dashboard', label: 'CONSOLE', icon: 'terminal' },
  { href: '/dashboard#quests', label: 'HUNT', icon: 'gps_fixed', matchPath: '/dashboard' },
  { href: '/stats', label: 'STATS', icon: 'equalizer' },
  { href: '/profile', label: 'PROFILE', icon: 'person' },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="bg-surface-container-lowest border-t border-outline-variant fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-2 h-16">
      {NAV.map((item) => {
        const matchPath = item.matchPath ?? item.href.split('#')[0]
        const active =
          item.label === 'CONSOLE'
            ? pathname === '/dashboard'
            : item.label === 'HUNT'
              ? false
              : pathname.startsWith(matchPath)

        return (
          <Link
            key={item.label}
            href={item.href}
            className={`flex flex-col items-center justify-center pt-2 px-4 h-full w-full transition-colors ${
              active
                ? 'text-secondary border-t-2 border-secondary'
                : 'text-outline hover:bg-surface-variant/20'
            }`}
          >
            <span className="material-symbols-outlined text-xl mb-1" style={{ fontSize: '20px' }}>
              {item.icon}
            </span>
            <span className="font-mono text-system-label">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
