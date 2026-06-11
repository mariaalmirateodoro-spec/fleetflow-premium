import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendTripReminderEmail } from '@/lib/email'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

  const { data: bookings, error: fetchError } = await adminSupabase
    .from('bookings')
    .select(`
      id, reference_number, guest_name, guest_email,
      pickup_location, dropoff_location, pickup_datetime, vehicle_type,
      vehicle_plate, vehicle_model,
      drivers(full_name, phone)
    `)
    .eq('status', 'approved')
    .gte('pickup_datetime', in16h)
    .lte('pickup_datetime', in40h)
    .not('guest_email', 'is', null)

  if (fetchError) {
    console.error('[reminder] fetch error:', fetchError)
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  if (!bookings || bookings.length === 0) {
    return NextResponse.json({ message: 'No upcoming bookings to remind', sent: 0 })
  }

  let sent = 0
  const errors: string[] = []

  for (const booking of bookings) {
    try {
      const driver = Array.isArray(booking.drivers)
        ? booking.drivers[0]
        : booking.drivers as { full_name: string; phone: string } | null

      await sendTripReminderEmail({
        guestName: booking.guest_name,
        guestEmail: booking.guest_email!,
        referenceNumber: booking.reference_number,
        pickupLocation: booking.pickup_location,
        dropoffLocation: booking.dropoff_location,
        pickupDatetime: booking.pickup_datetime,
        vehicleType: booking.vehicle_type,
        driverName: driver?.full_name ?? null,
        driverPhone: driver?.phone ?? null,
        vehiclePlate: booking.vehicle_plate ?? null,
        vehicleModel: booking.vehicle_model ?? null,
      })

      sent++
      console.log(`[reminder] sent to ${booking.guest_email} for ref ${booking.reference_number}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`${booking.reference_number}: ${msg}`)
      console.error(`[reminder] failed for ${booking.reference_number}:`, err)
    }
  }

  return NextResponse.json({
    message: `Sent ${sent} reminder(s)`,
    sent,
    errors: errors.length > 0 ? errors : undefined,
  })
}
