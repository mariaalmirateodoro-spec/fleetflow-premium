import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendBookingCancelledEmail } from '@/lib/email'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Role check — admin, manager, or staff can cancel
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, full_name')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'manager', 'staff'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { reason } = body as { reason?: string }

  if (!reason || !reason.trim()) {
    return NextResponse.json({ error: 'A cancellation reason is required' }, { status: 400 })
  }

  // Fetch the booking
  const { data: booking, error: bookingErr } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', params.id)
    .single()

  if (bookingErr || !booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  }

  // Prevent cancelling already-cancelled or completed bookings
  if (booking.status === 'cancelled') {
    return NextResponse.json({ error: 'Booking is already cancelled' }, { status: 400 })
  }
  if (booking.status === 'completed') {
    return NextResponse.json({ error: 'Completed bookings cannot be cancelled' }, { status: 400 })
  }

  // Cancel the booking
  const { error: updateErr } = await supabase
    .from('bookings')
    .update({
      status: 'cancelled',
      cancellation_reason: reason.trim(),
      cancelled_at: new Date().toISOString(),
    })
    .eq('id', params.id)

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 400 })
  }

  // In-app notification for booking creator
  if (booking.created_by) {
    await supabase.from('notifications').insert({
      user_id: booking.created_by,
      type: 'system',
      title: 'Booking Cancelled',
      message: `Booking ${booking.reference_number} was cancelled. Reason: ${reason.trim()}`,
      booking_id: params.id,
    })
  }

  // Send cancellation email to guest
  if (booking.guest_email) {
    try {
      await sendBookingCancelledEmail({
        guestName: booking.guest_name,
        guestEmail: booking.guest_email,
        referenceNumber: booking.reference_number,
        pickupLocation: booking.pickup_location,
        dropoffLocation: booking.dropoff_location,
        pickupDatetime: booking.pickup_datetime,
        cancellationReason: reason.trim(),
      })
    } catch (err) {
      // Email failure must not fail the whole request
      console.error('[cancel] email error:', err)
    }
  }

  return NextResponse.json({ success: true })
}
