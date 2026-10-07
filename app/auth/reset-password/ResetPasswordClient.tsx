'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import AuthShell from '@/components/ui/AuthShell'
import Button from '@/components/ui/Button'
import { Field, FormMessage } from '@/components/ui/Field'

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
    <AuthShell
      eyebrow="CREDENTIAL RESET"
      title="SET NEW PASSWORD"
      footer={
        <Link href="/auth/login" className="text-secondary hover:underline">
          Return to login
        </Link>
      }
    >
      {!ready && !error && <FormMessage tone="info">Verifying recovery link...</FormMessage>}

      {ready && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field
            label="NEW PASSWORD"
            id="password"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
          />
          <Field
            label="CONFIRM PASSWORD"
            id="confirm"
            type="password"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repeat the new password"
          />

          <Button type="submit" size="lg" block disabled={loading}>
            {loading ? 'UPDATING...' : 'UPDATE PASSWORD'}
          </Button>
        </form>
      )}

      <div className="space-y-4">
        {error && <FormMessage tone="error">{error}</FormMessage>}
        {message && <FormMessage tone="info">{message}</FormMessage>}
      </div>
    </AuthShell>
  )
}
