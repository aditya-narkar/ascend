'use client'

import { useState } from 'react'
import Link from 'next/link'
import { login } from '@/app/actions/auth'
import AuthShell from '@/components/ui/AuthShell'
import Button from '@/components/ui/Button'
import { Field, FormMessage } from '@/components/ui/Field'

export default function LoginPage() {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const fd = new FormData(e.currentTarget)
    const result = await login(fd)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <AuthShell
      eyebrow="PERSONAL EVOLUTION SYSTEM"
      title="HUNTER AUTHENTICATION"
      footer={
        <>
          No account?{' '}
          <Link href="/auth/signup" className="text-secondary hover:underline">
            Create hunter profile
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="EMAIL" id="email" type="email" required autoComplete="email" placeholder="hunter@domain.com" />
        <div>
          <Field label="PASSWORD" id="password" type="password" required autoComplete="current-password" placeholder="••••••••" />
          <p className="mt-1 text-right">
            <Link href="/auth/forgot-password" className="inline-flex min-h-11 items-center font-mono text-xs text-secondary hover:underline">
              Forgot password?
            </Link>
          </p>
        </div>

        {error && <FormMessage tone="error">{error}</FormMessage>}

        <Button type="submit" size="lg" block disabled={loading}>
          {loading ? 'AUTHENTICATING...' : 'ENTER SYSTEM'}
        </Button>
      </form>
    </AuthShell>
  )
}
