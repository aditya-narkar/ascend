import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
  const isAuthRoute = path.startsWith('/auth')
  const isOnboarding = path.startsWith('/onboarding')
  const isProtected = path.startsWith('/dashboard') || path.startsWith('/stats') || path.startsWith('/profile')

  if (!user && isProtected) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  if (!user && isOnboarding) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  if (user && isAuthRoute) {
    const { data: profile } = await supabase
      .from('users')
      .select('hunter_name')
      .eq('id', user.id)
      .single()

    return NextResponse.redirect(
      new URL(profile?.hunter_name ? '/dashboard' : '/onboarding', request.url)
    )
  }

  if (user && isProtected) {
    const { data: profile } = await supabase
      .from('users')
      .select('hunter_name')
      .eq('id', user.id)
      .single()

    if (!profile?.hunter_name) {
      return NextResponse.redirect(new URL('/onboarding', request.url))
    }
  }

  if (user && isOnboarding) {
    const { data: profile } = await supabase
      .from('users')
      .select('hunter_name')
      .eq('id', user.id)
      .single()

    if (profile?.hunter_name) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  if (!user && path === '/') {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  if (user && path === '/') {
    const { data: profile } = await supabase
      .from('users')
      .select('hunter_name')
      .eq('id', user.id)
      .single()

    return NextResponse.redirect(
      new URL(profile?.hunter_name ? '/dashboard' : '/onboarding', request.url)
    )
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
