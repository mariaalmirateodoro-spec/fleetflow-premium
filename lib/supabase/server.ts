import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { cache } from 'react'
import type { Profile } from '@/types'

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

export function createClient() {
  const cookieStore = cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOpts }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              cookieStore.set(name, value, options as any)
            )
          } catch {
            // The `setAll` method is called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
      },
    }
  )
}

// Wrapped in React's cache() so multiple calls during the same request/
// navigation (e.g. the dashboard layout calling getProfile(), then the page
// underneath it calling getProfile() again) reuse the first result instead
// of each re-hitting Supabase Auth + the profiles table from scratch. This
// was previously uncached, so every single dashboard page navigation paid
// for the full auth+profile round trip twice — a meaningful chunk of the
// "switching pages feels slow" complaint.
//
// Uses getSession() (fast — decodes the session already present in cookies,
// no network call) rather than getUser() (authoritative, but makes a real
// round trip to Supabase's Auth server every time). This is safe here
// specifically because middleware.ts already runs supabase.auth.getUser()
// — the slow, network-verified check — on every single request that can
// reach a page in this app (its matcher covers all routes), before this
// code ever runs. By the time a Server Component executes, this exact
// request has already passed that authoritative check, so re-verifying
// again here would just be a second network round trip for no extra
// security. Do not swap this back to getUser() without also removing (or
// changing) the middleware check, or the "authoritative check happened
// upstream" assumption breaks.
export const getUser = cache(async function getUser() {
  const supabase = createClient()
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error || !session?.user) return null
  return session.user
})

export const getProfile = cache(async function getProfile(): Promise<Profile | null> {
  const user = await getUser()
  if (!user) return null

  const supabase = createClient()
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return data as Profile | null
})
