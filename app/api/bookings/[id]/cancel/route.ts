import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { createClient } from '@/lib/supabase/server'
import { sendBookingCancelledEmail } from '@/lib/email'
import { logAudit, adminClient } from '@/lib/audit'
import { db, schema } from '@/lib/db'

// Talks directly to Postgres via Drizzle instead of PostgREST — same
// migration pass as approve/route.ts and the other booking-lifecycle routes.
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
  const [booking] = await db
    .select()
    .from(schema.bookings)
    .where(eq(schema.bookings.id, params.id))
    .limit(1)

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  }

  // Only the booking's creator, or an admin/manager, can cancel it — matches
  // the old RLS policy ("Staff can update own bookings; admins/managers can
  // update any"), which silently blocked everyone else at the database
  // level before this route talked directly to Postgres.
  if (booking.createdBy !== user.id && !['admin', 'manager'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Prevent cancelling already-cancelled or completed bookings
  if (booking.status === 'cancelled') {
    return NextResponse.json({ error: 'Booking is already cancelled' }, { status: 400 })
  }
  if (booking.status === 'completed') {
    return NextResponse.json({ error: 'Completed bookings cannot be cancelled' }, { status: 400 })
  }

  // Cancel the booking
  await db
    .update(schema.bookings)
    .set({
      status: 'cancelled',
      cancellationReason: reason.trim(),
      cancelledAt: new Date().toISOString(),
    })
    .where(eq(schema.bookings.id, params.id))

  await logAudit(adminClient(), {
    bookingId: params.id,
    actorId: user.id,
    actorName: profile.full_name || user.email || 'Unknown',
    action: 'booking_cancelled',
    field: 'status',
    oldValue: booking.status,
    newValue: 'cancelled',
    note: reason.trim(),
  })

  // In-app notification for booking creator
  if (booking.createdBy) {
    await db.insert(schema.notifications).values({
      userId: booking.createdBy,
      type: 'system',
      title: 'Booking Cancelled',
      message: `Booking ${booking.referenceNumber} was cancelled. Reason: ${reason.trim()}`,
      bookingId: params.id,
    })
  }

  // Send cancellation email to guest
  if (booking.guestEmail) {
    try {
      await sendBookingCancelledEmail({
        guestName: booking.guestName ?? '',
        guestEmail: booking.guestEmail,
        referenceNumber: booking.referenceNumber,
        pickupLocation: booking.pickupLocation ?? '',
        dropoffLocation: booking.dropoffLocation ?? '',
        pickupDatetime: booking.pickupDatetime ?? '',
        cancellationReason: reason.trim(),
      })
    } catch (err) {
      // Email failure must not fail the whole request
      console.error('[cancel] email error:', err)
    }
  }

  return NextResponse.json({ success: true })
}
