'use client'

import { useState } from 'react'
import Link from 'next/link'
import { requestPasswordReset } from '@/app/actions/auth'
import AuthShell from '@/components/ui/AuthShell'
import Button from '@/components/ui/Button'
import { Field, FormMessage } from '@/components/ui/Field'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    setError('')

    const fd = new FormData(e.currentTarget)
    const result = await requestPasswordReset(fd)

    if (result?.error) {
      setError(result.error)
    } else {
      setMessage(result?.message ?? 'Password reset link sent. Check your email.')
    }
    setLoading(false)
  }

  return (
    <AuthShell
      eyebrow="ACCOUNT RECOVERY"
      title="RESET ACCESS KEY"
      footer={
        <Link href="/auth/login" className="text-secondary hover:underline">
          Return to login
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field
          label="EMAIL"
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="hunter@domain.com"
        />

        {error && <FormMessage tone="error">{error}</FormMessage>}
        {message && <FormMessage tone="info">{message}</FormMessage>}

        <Button type="submit" size="lg" block disabled={loading}>
          {loading ? 'SENDING...' : 'SEND RESET LINK'}
        </Button>
      </form>
    </AuthShell>
  )
}
