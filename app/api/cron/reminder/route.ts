import { NextResponse } from 'next/server'
import { and, eq, gte, isNotNull, lte } from 'drizzle-orm'
import { sendTripReminderEmail } from '@/lib/email'
import { db, schema } from '@/lib/db'

// Talks directly to Postgres via Drizzle instead of PostgREST.
export async function GET(request: Request) {
  // Verify this is called by Vercel Cron
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()

  // Find approved bookings whose pickup is 16–40 hours from now
  // Cron runs at 00:00 UTC (08:00 PHT), so this window covers all of "tomorrow" in PHT
  const in16h = new Date(now.getTime() + 16 * 60 * 60 * 1000).toISOString()
  const in40h = new Date(now.getTime() + 40 * 60 * 60 * 1000).toISOString()

  const rows = await db
    .select({
      id: schema.bookings.id,
      referenceNumber: schema.bookings.referenceNumber,
      guestName: schema.bookings.guestName,
      guestEmail: schema.bookings.guestEmail,
      pickupLocation: schema.bookings.pickupLocation,
      dropoffLocation: schema.bookings.dropoffLocation,
      pickupDatetime: schema.bookings.pickupDatetime,
      vehicleType: schema.bookings.vehicleType,
      vehiclePlate: schema.bookings.vehiclePlate,
      vehicleModel: schema.bookings.vehicleModel,
      driverFullName: schema.drivers.fullName,
      driverPhone: schema.drivers.phone,
    })
    .from(schema.bookings)
    .leftJoin(schema.drivers, eq(schema.bookings.driverId, schema.drivers.id))
    .where(
      and(
        eq(schema.bookings.status, 'approved'),
        gte(schema.bookings.pickupDatetime, in16h),
        lte(schema.bookings.pickupDatetime, in40h),
        isNotNull(schema.bookings.guestEmail)
      )
    )

  if (rows.length === 0) {
    return NextResponse.json({ message: 'No upcoming bookings to remind', sent: 0 })
  }

  let sent = 0
  const errors: string[] = []

  for (const booking of rows) {
    try {
      await sendTripReminderEmail({
        guestName: booking.guestName ?? '',
        guestEmail: booking.guestEmail!,
        referenceNumber: booking.referenceNumber,
        pickupLocation: booking.pickupLocation ?? '',
        dropoffLocation: booking.dropoffLocation ?? '',
        pickupDatetime: booking.pickupDatetime ?? '',
        vehicleType: booking.vehicleType,
        driverName: booking.driverFullName ?? null,
        driverPhone: booking.driverPhone ?? null,
        vehiclePlate: booking.vehiclePlate ?? null,
        vehicleModel: booking.vehicleModel ?? null,
      })

      sent++
      console.log(`[reminder] sent to ${booking.guestEmail} for ref ${booking.referenceNumber}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`${booking.referenceNumber}: ${msg}`)
      console.error(`[reminder] failed for ${booking.referenceNumber}:`, err)
    }
  }

  return NextResponse.json({
    message: `Sent ${sent} reminder(s)`,
    sent,
    errors: errors.length > 0 ? errors : undefined,
  })
}
