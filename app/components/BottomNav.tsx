'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  {
    href: '/dashboard',
    label: 'Console',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="3" width="20" height="14" rx="1" />
        <path d="M8 21h8M12 17v4" />
      </svg>
    ),
  },
  {
    href: '/dashboard#quests',
    label: 'Hunt',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M14.5 2.5c0 1.5-1.5 7-1.5 7h-2S9 4 9 2.5a2.5 2.5 0 0 1 5 0Z" />
        <path d="M8 9h8l1 13H7L8 9Z" />
        <path d="M9.5 16a.5.5 0 0 0 1 0v-3a.5.5 0 0 0-1 0v3ZM13.5 16a.5.5 0 0 0 1 0v-3a.5.5 0 0 0-1 0v3Z" />
      </svg>
    ),
  },
  {
    href: '/stats',
    label: 'Stats',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 3v18h18" />
        <path d="M7 16l4-4 4 4 4-8" />
      </svg>
    ),
  },
  {
    href: '/profile',
    label: 'Profile',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
      </svg>
    ),
  },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-bg-secondary border-t border-border z-50">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href.split('#')[0]))
          const isConsoleActive = item.href === '/dashboard' && pathname === '/dashboard'

          const active = item.label === 'Console' ? isConsoleActive : isActive

          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex flex-col items-center gap-1 px-4 py-2 transition-colors ${
                active ? 'text-highlight-1' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {item.icon}
              <span className="text-xs tracking-widest" style={{ fontFamily: 'var(--font-rajdhani)', fontWeight: 600 }}>
                {item.label.toUpperCase()}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
