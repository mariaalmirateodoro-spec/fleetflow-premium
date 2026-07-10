import { NextRequest, NextResponse } from 'next/server'
import { createClient, getUser } from '@/lib/supabase/server'
import { db, schema } from '@/lib/db'
import { sendBookingApprovedEmail, sendBookingRejectedEmail } from '@/lib/email'

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const bookingId = request.nextUrl.searchParams.get('booking_id')
  let query = supabase
    .from('approvals')
    .select('*, profiles!reviewer_id(full_name)')
    .order('created_at', { ascending: false })

  if (bookingId) query = query.eq('booking_id', bookingId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Only admins/managers can approve
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'manager'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { booking_id, action, comments, quote_id } = await request.json()

  // Create approval record
  const { data: approval, error: approvalError } = await supabase
    .from('approvals')
    .insert({ booking_id, action, comments, reviewer_id: user.id })
    .select()
    .single()

  if (approvalError) return NextResponse.json({ error: approvalError.message }, { status: 400 })

  // Update booking status based on action
  const statusMap: Record<string, string> = {
    approved: 'approved',
    rejected: 'rejected',
    revision_requested: 'pending',
  }
  const newStatus = statusMap[action] ?? 'pending'

  const updatePayload: Record<string, unknown> = { status: newStatus }
  if (action === 'approved' && quote_id) {
    updatePayload.selected_quote_id = quote_id
  }

  await supabase.from('bookings').update(updatePayload).eq('id', booking_id)

  // Fetch booking details (including guest email for notifications)
  const { data: booking } = await supabase
    .from('bookings')
    .select('created_by, reference_number, guest_name, guest_email, pickup_location, dropoff_location, pickup_datetime, vehicle_type')
    .eq('id', booking_id)
    .single()

  if (booking) {
    const actionLabels: Record<string, string> = {
      approved: 'approved',
      rejected: 'rejected',
      revision_requested: 'sent back for revision',
    }

    // Internal notification for staff users
    if (booking.created_by) {
      await db.insert(schema.notifications).values({
        userId: booking.created_by,
        title: `Booking ${actionLabels[action] ?? action}`,
        message: `Booking ${booking.reference_number} has been ${actionLabels[action] ?? action}.${comments ? ` Comment: ${comments}` : ''}`,
        type: action === 'approved' ? 'approved' : 'system',
        bookingId: booking_id,
      })
    }

    // Email notification to guest
    if (booking.guest_email) {
      const emailPayload = {
        guestName: booking.guest_name,
        guestEmail: booking.guest_email,
        referenceNumber: booking.reference_number,
        pickupLocation: booking.pickup_location,
        dropoffLocation: booking.dropoff_location,
        pickupDatetime: booking.pickup_datetime,
        vehicleType: booking.vehicle_type,
        comments: comments ?? null,
      }

      if (action === 'approved') {
        sendBookingApprovedEmail(emailPayload).catch((err) =>
          console.error('[email] approved email failed:', err)
        )
      } else if (action === 'rejected') {
        sendBookingRejectedEmail(emailPayload).catch((err) =>
          console.error('[email] rejected email failed:', err)
        )
      }
    }
  }

  return NextResponse.json({ data: approval }, { status: 201 })
}
