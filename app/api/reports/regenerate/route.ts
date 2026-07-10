import { NextResponse } from 'next/server'
import { createClient, getUser } from '@/lib/supabase/server'
import { generateReports } from '@/lib/reports'

// Manual "Regenerate now" trigger for staff, so the Reports page isn't stuck
// waiting on the once-a-day Vercel Cron — same underlying logic as
// app/api/cron/generate-reports, just gated by a normal staff session
// instead of CRON_SECRET.
export async function POST() {
  const supabase = createClient()
  // Fast, cache()-backed check that trusts middleware.ts's authoritative,
  // network-verified getUser() call already made for this request — see the
  // comment on getUser() in lib/supabase/server.ts for why this is safe.
  // Was previously a second full round trip to Supabase Auth on top of
  // middleware's, on every single API call.
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!['admin', 'manager', 'finance'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { data, generatedAt } = await generateReports()
    return NextResponse.json({ generatedAt, data })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[reports/regenerate] error:', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
