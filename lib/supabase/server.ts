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
export const getUser = cache(async function getUser() {
  const supabase = createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
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

  return data
})