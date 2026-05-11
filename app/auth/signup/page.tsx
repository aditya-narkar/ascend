'use client'

import { useState } from 'react'
import Link from 'next/link'
import { signup } from '@/app/actions/auth'

export default function SignupPage() {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const fd = new FormData(e.currentTarget)
    if (fd.get('password') !== fd.get('confirm')) {
      setError('Passwords do not match.')
      setLoading(false)
      return
    }
    const result = await signup(fd)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-aura-primary/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="text-center mb-10">
          <p className="text-xs tracking-[0.4em] text-text-secondary mb-2">PERSONAL EVOLUTION SYSTEM</p>
          <h1
            className="text-4xl font-bold tracking-widest text-text-primary"
            style={{ fontFamily: 'var(--font-rajdhani)' }}
          >
            ASCEND
          </h1>
          <div className="mt-3 h-px bg-gradient-to-r from-transparent via-aura-primary to-transparent" />
        </div>

        <div className="bg-card border border-border rounded-sm p-8 aura-glow-sm">
          <p className="text-xs tracking-[0.3em] text-text-secondary mb-6">INITIALIZE HUNTER PROFILE</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-text-secondary tracking-widest mb-1.5">
                EMAIL
              </label>
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                className="w-full bg-bg-secondary border border-border rounded-sm px-3 py-2.5 text-sm text-text-primary placeholder-text-secondary/40 focus:outline-none focus:border-aura-primary transition-colors"
                placeholder="hunter@domain.com"
              />
            </div>

            <div>
              <label className="block text-xs text-text-secondary tracking-widest mb-1.5">
                PASSWORD
              </label>
              <input
                name="password"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                className="w-full bg-bg-secondary border border-border rounded-sm px-3 py-2.5 text-sm text-text-primary placeholder-text-secondary/40 focus:outline-none focus:border-aura-primary transition-colors"
                placeholder="min. 6 characters"
              />
            </div>

            <div>
              <label className="block text-xs text-text-secondary tracking-widest mb-1.5">
                CONFIRM PASSWORD
              </label>
              <input
                name="confirm"
                type="password"
                required
                autoComplete="new-password"
                className="w-full bg-bg-secondary border border-border rounded-sm px-3 py-2.5 text-sm text-text-primary placeholder-text-secondary/40 focus:outline-none focus:border-aura-primary transition-colors"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-xs text-red-400 tracking-wide border border-red-400/20 bg-red-400/5 px-3 py-2 rounded-sm">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-aura-primary hover:bg-aura-primary/80 disabled:opacity-50 text-text-primary font-semibold tracking-widest py-3 rounded-sm transition-all mt-2"
              style={{ fontFamily: 'var(--font-rajdhani)' }}
            >
              {loading ? 'INITIALIZING...' : 'CREATE PROFILE'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-text-secondary">
              Already a hunter?{' '}
              <Link href="/auth/login" className="text-highlight-1 hover:text-highlight-2 transition-colors">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
