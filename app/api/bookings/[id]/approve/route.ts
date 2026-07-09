import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { createClient } from '@/lib/supabase/server'
import { sendBookingApprovedEmail, sendBookingRejectedEmail } from '@/lib/email'
import { logAudit, adminClient } from '@/lib/audit'
import { db, schema } from '@/lib/db'

// Approves/rejects/requests revision on a booking. Talks directly to
// Postgres via Drizzle instead of PostgREST (part of the same migration as
// the quotes routes in ../quotes/*). This route doesn't touch the
// total_amount/amount_usd column-name bug itself, but was migrated in the
// same pass since it's part of the approvals workflow.
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
  const [booking] = await db
    .select()
    .from(schema.bookings)
    .where(eq(schema.bookings.id, params.id))
    .limit(1)

  if (!booking) {
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
  const bookingUpdate: {
    status: 'pending' | 'quoted' | 'approved' | 'completed' | 'cancelled'
    approvedBy?: string
    approvedAt?: string
    assignedSupplier?: string
    finalCostUsd?: string
    cancelledAt?: string
    cancellationReason?: string | null
  } = {
    status: newStatus,
  }
  if (action === 'approved') {
    bookingUpdate.approvedBy = profile.id
    bookingUpdate.approvedAt = new Date().toISOString()
    if (supplierId) bookingUpdate.assignedSupplier = supplierId
    if (finalCost != null) bookingUpdate.finalCostUsd = String(finalCost)
  }
  if (action === 'rejected') {
    bookingUpdate.cancelledAt = new Date().toISOString()
    bookingUpdate.cancellationReason = comments ?? null
  }

  await db
    .update(schema.bookings)
    .set(bookingUpdate)
    .where(eq(schema.bookings.id, params.id))

  // Insert approval record
  await db.insert(schema.approvals).values({
    bookingId: params.id,
    reviewerId: profile.id,
    action,
    comments: comments ?? null,
  })

  await logAudit(adminClient(), {
    bookingId: params.id,
    actorId: profile.id,
    actorName: profile.full_name || user.email || 'Unknown',
    action: action === 'approved' ? 'booking_approved' : action === 'rejected' ? 'booking_rejected' : 'booking_revision_requested',
    field: 'status',
    oldValue: booking.status,
    newValue: newStatus,
    note: comments ?? null,
  })

  // Insert in-app notification for booking creator
  if (booking.createdBy) {
    const notifTitle =
      action === 'approved' ? 'Booking Approved! ✅' :
      action === 'rejected' ? 'Booking Rejected' : 'Revision Requested'
    const notifMsg =
      action === 'approved'
        ? `Booking ${booking.referenceNumber} has been approved.`
        : action === 'rejected'
        ? `Booking ${booking.referenceNumber} was rejected.${comments ? ' Reason: ' + comments : ''}`
        : `Booking ${booking.referenceNumber} needs revision.${comments ? ' Notes: ' + comments : ''}`

    await db.insert(schema.notifications).values({
      userId: booking.createdBy,
      type: action === 'approved' ? 'approved' : 'system',
      title: notifTitle,
      message: notifMsg,
      bookingId: params.id,
    })
  }

  // Fetch supplier name (if assigned) for email
  let supplierName: string | undefined
  if (supplierId) {
    const [supplier] = await db
      .select({ companyName: schema.suppliers.companyName })
      .from(schema.suppliers)
      .where(eq(schema.suppliers.id, supplierId))
      .limit(1)
    supplierName = supplier?.companyName
  }

  // Send guest email (only if guest email is on file)
  if (booking.guestEmail) {
    try {
      const emailBase = {
        guestName: booking.guestName ?? '',
        guestEmail: booking.guestEmail,
        referenceNumber: booking.referenceNumber,
        pickupLocation: booking.pickupLocation ?? '',
        dropoffLocation: booking.dropoffLocation ?? '',
        pickupDatetime: booking.pickupDatetime ?? '',
        vehicleType: booking.vehicleType,
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
