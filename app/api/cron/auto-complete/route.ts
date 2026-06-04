import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: Request) {
  // Verify this is called by Vercel Cron (or internally)
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date().toISOString()

  // Find all approved bookings whose pickup datetime has passed
  const { data: bookings, error: fetchError } = await adminSupabase
    .from('bookings')
    .select('id, reference_number, pickup_datetime')
    .eq('status', 'approved')
    .lt('pickup_datetime', now)

  if (fetchError) {
    console.error('[auto-complete] fetch error:', fetchError)
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  if (!bookings || bookings.length === 0) {
    return NextResponse.json({ message: 'No bookings to complete', completed: 0 })
  }

  const ids = bookings.map((b) => b.id)

  const { error: updateError } = await adminSupabase
    .from('bookings')
    .update({ status: 'completed', updated_at: now })
    .in('id', ids)

  if (updateError) {
    console.error('[auto-complete] update error:', updateError)
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  console.log(`[auto-complete] marked ${ids.length} booking(s) as completed:`, bookings.map((b) => b.reference_number))

  return NextResponse.json({
    message: `Marked ${ids.length} booking(s) as completed`,
    completed: ids.length,
    references: bookings.map((b) => b.reference_number),
  })
}
