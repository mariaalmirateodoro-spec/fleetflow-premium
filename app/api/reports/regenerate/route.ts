import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateReports } from '@/lib/reports'

// Manual "Regenerate now" trigger for staff, so the Reports page isn't stuck
// waiting on the once-a-day Vercel Cron — same underlying logic as
// app/api/cron/generate-reports, just gated by a normal staff session
// instead of CRON_SECRET.
export async function POST() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
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
