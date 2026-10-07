import { redirect } from 'next/navigation'

// The proxy sends signed-out users to /auth/login and un-onboarded users to /onboarding.
export default function RootPage() {
  redirect('/dashboard')
}
