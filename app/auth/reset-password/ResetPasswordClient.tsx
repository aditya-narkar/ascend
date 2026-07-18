'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Props = {
  code?: string
}

export default function ResetPasswordClient({ code }: Props) {
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function prepareRecoverySession() {
      const supabase = createClient()

      try {
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
          if (exchangeError) throw exchangeError
        } else if (window.location.hash.includes('access_token=')) {
          const params = new URLSearchParams(window.location.hash.slice(1))
          const accessToken = params.get('access_token')
          const refreshToken = params.get('refresh_token')
          if (accessToken && refreshToken) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            })
            if (sessionError) throw sessionError
          }
        }

        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          throw new Error('Reset link is invalid or expired. Request a new one.')
        }

        if (!cancelled) setReady(true)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Reset link is invalid or expired.')
        }
      }
    }

    prepareRecoverySession()
    return () => { cancelled = true }
  }, [code])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setMessage('')

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    await supabase.auth.signOut()
    setMessage('Password updated. You can now sign in with the new password.')
    setPassword('')
    setConfirm('')
  }

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-aura-primary/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="text-center mb-10">
          <p className="text-xs tracking-[0.4em] text-text-secondary mb-2">CREDENTIAL RESET</p>
          <h1
            className="text-4xl font-bold tracking-widest text-text-primary"
            style={{ fontFamily: 'var(--font-rajdhani)' }}
          >
            ASCEND
          </h1>
          <div className="mt-3 h-px bg-gradient-to-r from-transparent via-aura-primary to-transparent" />
        </div>

        <div className="bg-card border border-border rounded-sm p-8 aura-glow-sm">
          <p className="text-xs tracking-[0.3em] text-text-secondary mb-6">SET NEW PASSWORD</p>

          {!ready && !error && (
            <p className="text-xs text-text-secondary tracking-wide border border-border bg-bg-secondary px-3 py-2 rounded-sm">
              Verifying recovery link...
            </p>
          )}

          {ready && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs text-text-secondary tracking-widest mb-1.5">
                  NEW PASSWORD
                </label>
                <input
                  name="password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full bg-bg-secondary border border-border rounded-sm px-3 py-2.5 text-sm text-text-primary placeholder-text-secondary/40 focus:outline-none focus:border-aura-primary transition-colors"
                  placeholder="confirm new key"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-aura-primary hover:bg-aura-primary/80 disabled:opacity-50 text-text-primary font-semibold tracking-widest py-3 rounded-sm transition-all mt-2"
                style={{ fontFamily: 'var(--font-rajdhani)' }}
              >
                {loading ? 'UPDATING...' : 'UPDATE PASSWORD'}
              </button>
            </form>
          )}

          {error && (
            <p className="text-xs text-red-400 tracking-wide border border-red-400/20 bg-red-400/5 px-3 py-2 rounded-sm">
              {error}
            </p>
          )}

          {message && (
            <p className="text-xs text-highlight-1 tracking-wide border border-highlight-1/20 bg-highlight-1/5 px-3 py-2 rounded-sm">
              {message}
            </p>
          )}

          <div className="mt-6 text-center">
            <Link href="/auth/login" className="text-xs text-highlight-1 hover:text-highlight-2 transition-colors">
              Return to login
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
