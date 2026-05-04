import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [
    { count: totalBookings },
    { data: pending },
    { count: supplierCount },
    { data: upcoming },
  ] = await Promise.all([
    supabase.from('bookings').select('*', { count: 'exact', head: true }),
    supabase.from('bookings').select('id').eq('status', 'pending'),
    supabase.from('suppliers').select('*', { count: 'exact', head: true }).eq('is_available', true),
    supabase.from('bookings').select('*').in('status', ['approved', 'quoted'])
      .gte('pickup_datetime', new Date().toISOString()).order('pickup_datetime').limit(5),
  ])

  return NextResponse.json({
    data: {
      totalBookings: totalBookings ?? 0,
      pendingCount: pending?.length ?? 0,
      supplierCount: supplierCount ?? 0,
      upcomingBookings: upcoming ?? [],
    }
  })
}
