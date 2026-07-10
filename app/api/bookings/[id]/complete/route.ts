import { NextRequest, NextResponse } from 'next/server'
import { eq, inArray } from 'drizzle-orm'
import { createClient } from '@/lib/supabase/server'
import { logAudit, adminClient } from '@/lib/audit'
import { db, schema } from '@/lib/db'
import { sendTripCompletionReceiptEmail, sendTripCompletedStaffEmail } from '@/lib/email'

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

  // Role check
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, full_name')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'manager', 'staff'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Fetch booking (joined with drivers, for the driver name shown on the
  // guest receipt email — same shape as app/api/cron/auto-complete/route.ts)
  const [booking] = await db
    .select({
      id: schema.bookings.id,
      referenceNumber: schema.bookings.referenceNumber,
      status: schema.bookings.status,
      createdBy: schema.bookings.createdBy,
      guestName: schema.bookings.guestName,
      guestEmail: schema.bookings.guestEmail,
      pickupDatetime: schema.bookings.pickupDatetime,
      dropoffDatetime: schema.bookings.dropoffDatetime,
      pickupLocation: schema.bookings.pickupLocation,
      dropoffLocation: schema.bookings.dropoffLocation,
      vehicleType: schema.bookings.vehicleType,
      vehiclePlate: schema.bookings.vehiclePlate,
      vehicleModel: schema.bookings.vehicleModel,
      finalCostUsd: schema.bookings.finalCostUsd,
      driverFullName: schema.drivers.fullName,
    })
    .from(schema.bookings)
    .leftJoin(schema.drivers, eq(schema.bookings.driverId, schema.drivers.id))
    .where(eq(schema.bookings.id, params.id))
    .limit(1)

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  }

  // Any authenticated staff member (per the role check above) can complete
  // any booking (not restricted to the creator or admin/manager) — explicit
  // product decision.

  if (booking.status !== 'approved') {
    return NextResponse.json(
      { error: 'Only approved bookings can be marked as completed' },
      { status: 400 }
    )
  }

  // Mark as completed
  await db
    .update(schema.bookings)
    .set({
      status: 'completed',
      completedAt: new Date().toISOString(),
    })
    .where(eq(schema.bookings.id, params.id))

  await logAudit(adminClient(), {
    bookingId: params.id,
    actorId: user.id,
    actorName: profile.full_name || user.email || 'Unknown',
    action: 'booking_completed',
    field: 'status',
    oldValue: 'approved',
    newValue: 'completed',
  })

  // In-app notification for booking creator
  if (booking.createdBy) {
    await db.insert(schema.notifications).values({
      userId: booking.createdBy,
      type: 'system',
      title: 'Trip Completed',
      message: `Booking ${booking.referenceNumber} has been marked as completed.`,
      bookingId: params.id,
    })
  }

  // Send the same completion emails that the auto-complete cron job sends,
  // so manually-completed trips aren't missing them (see
  // app/api/cron/auto-complete/route.ts). Awaited + try/caught so an email
  // failure never fails the "mark as completed" action itself.
  const finalCostUsd = booking.finalCostUsd != null ? Number(booking.finalCostUsd) : null

  if (booking.guestEmail) {
    try {
      await sendTripCompletionReceiptEmail({
        guestEmail: booking.guestEmail,
        guestName: booking.guestName ?? '',
        referenceNumber: booking.referenceNumber,
        pickupDatetime: booking.pickupDatetime ?? '',
        dropoffDatetime: booking.dropoffDatetime ?? null,
        pickupLocation: booking.pickupLocation ?? '',
        dropoffLocation: booking.dropoffLocation ?? '',
        vehicleType: booking.vehicleType,
        vehiclePlate: booking.vehiclePlate ?? null,
        vehicleModel: booking.vehicleModel ?? null,
        finalCostUsd,
        driverName: booking.driverFullName ?? null,
      })
    } catch (err) {
      console.error(`[complete] receipt email error for ${booking.referenceNumber}:`, err)
    }
  }

  const staffProfiles = await db
    .select({ email: schema.profiles.email })
    .from(schema.profiles)
    .where(inArray(schema.profiles.role, ['admin', 'manager', 'staff']))
  const staffEmails = staffProfiles.map((p) => p.email).filter(Boolean).join(',')

  if (staffEmails) {
    try {
      await sendTripCompletedStaffEmail({
        staffEmails,
        referenceNumber: booking.referenceNumber,
        guestName: booking.guestName ?? '',
        pickupLocation: booking.pickupLocation ?? '',
        dropoffLocation: booking.dropoffLocation ?? '',
        vehicleType: booking.vehicleType,
        finalCostUsd,
      })
    } catch (err) {
      console.error(`[complete] staff email error for ${booking.referenceNumber}:`, err)
    }
  }

  return NextResponse.json({ success: true })
}
