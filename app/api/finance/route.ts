import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function requireFinanceOrAdmin(supabase: ReturnType<typeof createClient>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'finance'].includes(profile.role)) return null
  return user
}

export async function GET() {
  const supabase = createClient()
  const user = await requireFinanceOrAdmin(supabase)
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Only show bookings that have a cost (approved or completed)
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      id, reference_number, guest_name, pickup_datetime, dropoff_datetime,
      pickup_location, dropoff_location, vehicle_type,
      budget_usd, final_cost_usd, status,
      payment_status, payment_amount, paid_at, payment_notes,
      created_at, updated_at,
      profiles!bookings_created_by_fkey(full_name),
      suppliers(company_name)
    `)
    .in('status', ['approved', 'completed'])
    .order('pickup_datetime', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data })
}

export async function PATCH(request: NextRequest) {
  const supabase = createClient()
  const user = await requireFinanceOrAdmin(supabase)
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { bookingId, payment_status, payment_amount, paid_at, payment_notes } =
    await request.json()

  if (!bookingId || !payment_status) {
    return NextResponse.json({ error: 'bookingId and payment_status are required' }, { status: 400 })
  }

  if (!['unpaid', 'partial', 'paid'].includes(payment_status)) {
    return NextResponse.json({ error: 'Invalid payment_status' }, { status: 400 })
  }

  const updates: Record<string, unknown> = { payment_status }
  if (payment_amount !== undefined) updates.payment_amount = payment_amount
  if (paid_at !== undefined) updates.paid_at = paid_at
  if (payment_notes !== undefined) updates.payment_notes = payment_notes

  const { data: rows, error } = await supabase
    .from('bookings')
    .update(updates)
    .eq('id', bookingId)
    .select('id, payment_status, payment_amount, paid_at, payment_notes')

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data: rows?.[0] ?? null })
}
