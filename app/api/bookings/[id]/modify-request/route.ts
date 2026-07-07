import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { sendModificationRequestEmail } from '@/lib/email'

function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json()
  const { pickup_datetime, pickup_location, dropoff_location, notes } = body

  // At least one field must be requested
  if (!pickup_datetime && !pickup_location && !dropoff_location && !notes) {
    return NextResponse.json({ error: 'At least one change must be requested' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Fetch the booking by reference_number
  const { data: booking, error: fetchError } = await admin
    .from('bookings')
    .select('id, guest_name, guest_email, reference_number, pickup_datetime, pickup_location, dropoff_location, status, modification_status')
    .eq('reference_number', params.id)
    .single()

  if (fetchError || !booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  }

  // Only allow modifications for pending or approved bookings
  if (booking.status !== 'pending' && booking.status !== 'approved') {
    return NextResponse.json({ error: 'Modifications can only be requested for active bookings' }, { status: 400 })
  }

  // Prevent duplicate pending requests
  if (booking.modification_status === 'pending') {
    return NextResponse.json({ error: 'A modification request is already pending' }, { status: 400 })
  }

  const now = new Date().toISOString()

  // Store the modification request
  const { error: updateError } = await admin
    .from('bookings')
    .update({
      modification_status: 'pending',
      modification_pickup_datetime: pickup_datetime ?? null,
      modification_pickup_location: pickup_location ?? null,
      modification_dropoff_location: dropoff_location ?? null,
      modification_notes: notes ?? null,
      modification_requested_at: now,
      updated_at: now,
    })
    .eq('id', booking.id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Notify admin via email
  const adminEmail = process.env.GMAIL_USER
  if (adminEmail) {
    try {
      await sendModificationRequestEmail({
        adminEmail,
        guestName: booking.guest_name,
        referenceNumber: booking.reference_number,
        requestedPickupDatetime: pickup_datetime ?? null,
        requestedPickupLocation: pickup_location ?? null,
        requestedDropoffLocation: dropoff_location ?? null,
        requestedNotes: notes ?? null,
        originalPickupDatetime: booking.pickup_datetime,
        originalPickupLocation: booking.pickup_location,
        originalDropoffLocation: booking.dropoff_location,
      })
    } catch (err) {
      console.error('[modify-request] email error:', err)
    }
  }

  return NextResponse.json({ success: true })
}
