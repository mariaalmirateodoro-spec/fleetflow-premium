import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

type CookieOpts = {
  path?: string
  maxAge?: number
  domain?: string
  secure?: boolean
  httpOnly?: boolean
  sameSite?: 'strict' | 'lax' | 'none' | boolean
  expires?: Date | number
  priority?: 'low' | 'medium' | 'high'
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOpts }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            supabaseResponse.cookies.set(name, value, options as any)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Bare domain root has no page of its own — send guests to the fleet
  // showcase (a public-facing landing page) and staff straight to their
  // dashboard, instead of falling through to the /login redirect below
  // (which used to mean anyone who just typed the domain name, with no
  // path, landed on a staff login screen).
  if (pathname === '/') {
    const url = request.nextUrl.clone()
    url.pathname = user ? '/dashboard' : '/fleet'
    return NextResponse.redirect(url)
  }

  // Public routes that don't need auth
  const publicRoutes = ['/login', '/auth/callback', '/fleet', '/book']
  const isPublicRoute =
    publicRoutes.some((route) => pathname.startsWith(route)) ||
    pathname.startsWith('/api/public') ||
    pathname.startsWith('/api/cron') // cron routes authenticate via CRON_SECRET bearer token, not a user session

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // .webmanifest added here: it was previously falling through to the
    // auth check below, so a guest's phone (not logged in) fetching this
    // PWA metadata file got redirected to /login and received an HTML
    // page instead of JSON — breaking "Add to Home Screen" for guests
    // and showing as a manifest parse error in the console.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|webmanifest)$).*)',
  ],
}
