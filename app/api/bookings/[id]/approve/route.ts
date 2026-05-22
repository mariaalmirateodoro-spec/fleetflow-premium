import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { sendBookingApprovedEmail, sendBookingRejectedEmail } from '@/lib/email'

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
  const supabase = createClient()

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Role check — only admin/manager can approve
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, full_name')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'manager'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const {
    action,          // 'approved' | 'rejected' | 'revision_requested'
    comments,        // string | null
    supplierId,      // string | null (only for approved)
    finalCost,       // number | null (only for approved)
  } = body as {
    action: 'approved' | 'rejected' | 'revision_requested'
    comments?: string | null
    supplierId?: string | null
    finalCost?: number | null
  }

  // Fetch full booking
  const { data: booking, error: bookingErr } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', params.id)
    .single()

  if (bookingErr || !booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  }

  // Guard: cannot act on a terminal-status booking
  if (booking.status === 'cancelled') {
    return NextResponse.json({ error: 'This booking has already been cancelled and cannot be modified.' }, { status: 400 })
  }
  if (booking.status === 'completed') {
    return NextResponse.json({ error: 'Completed bookings cannot be modified.' }, { status: 400 })
  }

  // Map action → new status
  const newStatus =
    action === 'approved' ? 'approved' :
    action === 'rejected' ? 'cancelled' : 'pending'

  // Update booking
  const bookingUpdate: Record<string, unknown> = {
    status: newStatus,
  }
  if (action === 'approved') {
    bookingUpdate.approved_by = profile.id
    bookingUpdate.approved_at = new Date().toISOString()
    if (supplierId) bookingUpdate.assigned_supplier = supplierId
    if (finalCost != null) bookingUpdate.final_cost_usd = finalCost
  }
  if (action === 'rejected') {
    bookingUpdate.cancelled_at = new Date().toISOString()
    bookingUpdate.cancellation_reason = comments ?? null
  }

  const admin = createAdminClient()
  const { error: updateErr } = await admin
    .from('bookings')
    .update(bookingUpdate)
    .eq('id', params.id)

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 400 })
  }

  // Insert approval record
  await admin.from('approvals').insert({
    booking_id: params.id,
    reviewer_id: profile.id,
    action,
    comments: comments ?? null,
  })

  // Insert in-app notification for booking creator
  if (booking.created_by) {
    const notifTitle =
      action === 'approved' ? 'Booking Approved! ✅' :
      action === 'rejected' ? 'Booking Rejected' : 'Revision Requested'
    const notifMsg =
      action === 'approved'
        ? `Booking ${booking.reference_number} has been approved.`
        : action === 'rejected'
        ? `Booking ${booking.reference_number} was rejected.${comments ? ' Reason: ' + comments : ''}`
        : `Booking ${booking.reference_number} needs revision.${comments ? ' Notes: ' + comments : ''}`

    await admin.from('notifications').insert({
      user_id: booking.created_by,
      type: action === 'approved' ? 'approved' : 'system',
      title: notifTitle,
      message: notifMsg,
      booking_id: params.id,
    })
  }

  // Fetch supplier name (if assigned) for email
  let supplierName: string | undefined
  if (supplierId) {
    const { data: supplier } = await supabase
      .from('suppliers')
      .select('company_name')
      .eq('id', supplierId)
      .single()
    supplierName = supplier?.company_name
  }

  // Send guest email (only if guest email is on file)
  if (booking.guest_email) {
    try {
      const emailBase = {
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
        await sendBookingApprovedEmail({
          ...emailBase,
          supplierName,
          finalCost: finalCost ?? undefined,
        })
      } else if (action === 'rejected') {
        await sendBookingRejectedEmail(emailBase)
      }
    } catch (err) {
      // Email failure should not fail the whole request
      console.error('[approve] email error:', err)
    }
  }

  return NextResponse.json({ success: true, status: newStatus })
}
