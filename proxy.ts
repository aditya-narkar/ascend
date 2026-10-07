import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse, type NextRequest } from 'next/server'
import { loggingFetch } from '@/lib/supabase/logFetch'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { fetch: loggingFetch },
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  // The password-reset page needs a (recovery) session, so signed-in users may stay on it.
  const isAuthRoute = path.startsWith('/auth') && !path.startsWith('/auth/reset-password')
  const isOnboarding = path.startsWith('/onboarding')
  const isProtected = path.startsWith('/dashboard') || path.startsWith('/stats') || path.startsWith('/profile')
  const redirectTo = (to: string) => NextResponse.redirect(new URL(to, request.url))

  if (!user) return isProtected || isOnboarding ? redirectTo('/auth/login') : supabaseResponse

  if (!(isAuthRoute || isOnboarding || isProtected)) return supabaseResponse

  // Signed in: every remaining route depends on whether onboarding is finished.
  const { data: profile } = await supabase
    .from('users')
    .select('hunter_name')
    .eq('id', user.id)
    .single()
  const onboarded = Boolean(profile?.hunter_name)

  if (isProtected) return onboarded ? supabaseResponse : redirectTo('/onboarding')
  if (isOnboarding) return onboarded ? redirectTo('/dashboard') : supabaseResponse
  return redirectTo(onboarded ? '/dashboard' : '/onboarding') // auth pages
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
