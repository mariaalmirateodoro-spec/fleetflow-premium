import { NextResponse } from 'next/server'
import { and, eq, inArray, lt } from 'drizzle-orm'
import { sendTripCompletionReceiptEmail, sendTripCompletedStaffEmail } from '@/lib/email'
import { db, schema } from '@/lib/db'

// Talks directly to Postgres via Drizzle instead of PostgREST.
export async function GET(request: Request) {
  // Verify this is called by Vercel Cron (or internally)
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date().toISOString()

  // Find all approved bookings whose pickup datetime has passed
  const rows = await db
    .select({
      id: schema.bookings.id,
      referenceNumber: schema.bookings.referenceNumber,
      pickupDatetime: schema.bookings.pickupDatetime,
      dropoffDatetime: schema.bookings.dropoffDatetime,
      pickupLocation: schema.bookings.pickupLocation,
      dropoffLocation: schema.bookings.dropoffLocation,
      guestName: schema.bookings.guestName,
      guestEmail: schema.bookings.guestEmail,
      vehicleType: schema.bookings.vehicleType,
      vehiclePlate: schema.bookings.vehiclePlate,
      vehicleModel: schema.bookings.vehicleModel,
      finalCostUsd: schema.bookings.finalCostUsd,
      driverId: schema.bookings.driverId,
      createdBy: schema.bookings.createdBy,
      driverFullName: schema.drivers.fullName,
    })
    .from(schema.bookings)
    .leftJoin(schema.drivers, eq(schema.bookings.driverId, schema.drivers.id))
    .where(and(eq(schema.bookings.status, 'approved'), lt(schema.bookings.pickupDatetime, now)))

  if (rows.length === 0) {
    return NextResponse.json({ message: 'No bookings to complete', completed: 0 })
  }

  const ids = rows.map((b) => b.id)

  await db
    .update(schema.bookings)
    .set({ status: 'completed', completedAt: now, updatedAt: now })
    .where(inArray(schema.bookings.id, ids))

  console.log(`[auto-complete] marked ${ids.length} booking(s) as completed:`, rows.map((b) => b.referenceNumber))

  // Internal staff — notified once per completed trip, same recipients as new-booking notifications
  const staffProfiles = await db
    .select({ email: schema.profiles.email })
    .from(schema.profiles)
    .where(inArray(schema.profiles.role, ['admin', 'manager', 'staff']))
  const staffEmails = staffProfiles.map((p) => p.email).filter(Boolean).join(',')

  // Send receipt emails (guest) + internal notification (staff) for each completed booking
  let emailsSent = 0
  for (const booking of rows) {
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
        emailsSent++
      } catch (err) {
        console.error(`[auto-complete] receipt email error for ${booking.referenceNumber}:`, err)
      }
    }

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
        console.error(`[auto-complete] staff email error for ${booking.referenceNumber}:`, err)
      }
    }

    // In-app notification for the booking's creator — same as the manual
    // "Complete" button in the dashboard (app/api/bookings/[id]/complete),
    // so auto-completed trips aren't silently missing this compared to
    // manually-completed ones. Guest-submitted bookings have no created_by,
    // so nothing to notify there (guests get the email above instead).
    if (booking.createdBy) {
      try {
        await db.insert(schema.notifications).values({
          userId: booking.createdBy,
          type: 'system',
          title: 'Trip Completed',
          message: `Booking ${booking.referenceNumber} has been marked as completed.`,
          bookingId: booking.id,
        })
      } catch (err) {
        console.error(`[auto-complete] notification error for ${booking.referenceNumber}:`, err)
      }
    }
  }

  return NextResponse.json({
    message: `Marked ${ids.length} booking(s) as completed`,
    completed: ids.length,
    emailsSent,
    references: rows.map((b) => b.referenceNumber),
  })
}
