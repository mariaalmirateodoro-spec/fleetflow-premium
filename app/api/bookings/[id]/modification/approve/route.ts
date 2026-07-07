import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { logAudit } from '@/lib/audit'

function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(
  _: NextRequest,
  { params }: { params: { id: string } }
) {
  // Verify admin session
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  if (!['admin', 'manager', 'staff'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()

  // Fetch booking with modification data
  const { data: booking, error: fetchError } = await admin
    .from('bookings')
    .select('id, guest_name, guest_email, reference_number, pickup_datetime, pickup_location, dropoff_location, vehicle_type, modification_status, modification_pickup_datetime, modification_pickup_location, modification_dropoff_location, modification_notes')
    .eq('id', params.id)
    .single()

  if (fetchError || !booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  }

  if (booking.modification_status !== 'pending') {
    return NextResponse.json({ error: 'No pending modification request' }, { status: 400 })
  }

  const now = new Date().toISOString()

  // Apply the requested changes and clear modification fields
  const updates: Record<string, unknown> = {
    modification_status: 'approved',
    modification_pickup_datetime: null,
    modification_pickup_location: null,
    modification_dropoff_location: null,
    modification_notes: null,
    modification_requested_at: null,
    updated_at: now,
  }

  if (booking.modification_pickup_datetime) {
    updates.pickup_datetime = booking.modification_pickup_datetime
  }
  if (booking.modification_pickup_location) {
    updates.pickup_location = booking.modification_pickup_location
  }
  if (booking.modification_dropoff_location) {
    updates.dropoff_location = booking.modification_dropoff_location
  }

  const { data: updated, error: updateError } = await admin
    .from('bookings')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  await logAudit(admin, {
    bookingId: params.id,
    actorId: user.id,
    actorName: profile?.full_name || user.email || 'Unknown',
    action: 'modification_approved',
    note: booking.modification_notes ?? null,
  })

  return NextResponse.json({ success: true, data: updated })
}
