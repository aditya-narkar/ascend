'use client'

import { useState } from 'react'
import Link from 'next/link'
import { signup } from '@/app/actions/auth'
import AuthShell from '@/components/ui/AuthShell'
import Button from '@/components/ui/Button'
import { Field, FormMessage } from '@/components/ui/Field'

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
    <AuthShell
      eyebrow="PERSONAL EVOLUTION SYSTEM"
      title="INITIALIZE HUNTER PROFILE"
      footer={
        <>
          Already a hunter?{' '}
          <Link href="/auth/login" className="text-secondary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="EMAIL" id="email" type="email" required autoComplete="email" placeholder="hunter@domain.com" />
        <Field label="PASSWORD" id="password" type="password" required minLength={6} autoComplete="new-password" placeholder="At least 6 characters" />
        <Field label="CONFIRM PASSWORD" id="confirm" type="password" required autoComplete="new-password" placeholder="••••••••" />

        {error && <FormMessage tone="error">{error}</FormMessage>}

        <Button type="submit" size="lg" block disabled={loading}>
          {loading ? 'INITIALIZING...' : 'CREATE PROFILE'}
        </Button>
      </form>
    </AuthShell>
  )
}
