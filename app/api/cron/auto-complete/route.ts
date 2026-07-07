import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendTripCompletionReceiptEmail, sendTripCompletedStaffEmail } from '@/lib/email'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: Request) {
  // Verify this is called by Vercel Cron (or internally)
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date().toISOString()

  // Find all approved bookings whose pickup datetime has passed
  // Select full fields so we can send receipt emails
  const { data: bookings, error: fetchError } = await adminSupabase
    .from('bookings')
    .select(`
      id,
      reference_number,
      pickup_datetime,
      dropoff_datetime,
      pickup_location,
      dropoff_location,
      guest_name,
      guest_email,
      vehicle_type,
      vehicle_plate,
      vehicle_model,
      final_cost_usd,
      driver_id,
      created_by,
      drivers ( full_name )
    `)
    .eq('status', 'approved')
    .lt('pickup_datetime', now)

  if (fetchError) {
    console.error('[auto-complete] fetch error:', fetchError)
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  if (!bookings || bookings.length === 0) {
    return NextResponse.json({ message: 'No bookings to complete', completed: 0 })
  }

  const ids = bookings.map((b) => b.id)

  const { error: updateError } = await adminSupabase
    .from('bookings')
    .update({ status: 'completed', completed_at: now, updated_at: now })
    .in('id', ids)

  if (updateError) {
    console.error('[auto-complete] update error:', updateError)
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  console.log(`[auto-complete] marked ${ids.length} booking(s) as completed:`, bookings.map((b) => b.reference_number))

  // Internal staff — notified once per completed trip, same recipients as new-booking notifications
  const { data: staffProfiles } = await adminSupabase
    .from('profiles')
    .select('email')
    .in('role', ['admin', 'manager', 'staff'])
  const staffEmails = staffProfiles?.map((p) => p.email).filter(Boolean).join(',') ?? ''

  // Send receipt emails (guest) + internal notification (staff) for each completed booking
  let emailsSent = 0
  for (const booking of bookings) {
    const driversField = booking.drivers as { full_name: string }[] | { full_name: string } | null
    const driverName = (Array.isArray(driversField) ? driversField[0] : driversField)?.full_name ?? null

    if (booking.guest_email) {
      try {
        await sendTripCompletionReceiptEmail({
          guestEmail: booking.guest_email,
          guestName: booking.guest_name,
          referenceNumber: booking.reference_number,
          pickupDatetime: booking.pickup_datetime,
          dropoffDatetime: booking.dropoff_datetime ?? null,
          pickupLocation: booking.pickup_location,
          dropoffLocation: booking.dropoff_location,
          vehicleType: booking.vehicle_type,
          vehiclePlate: booking.vehicle_plate ?? null,
          vehicleModel: booking.vehicle_model ?? null,
          finalCostUsd: booking.final_cost_usd ?? null,
          driverName,
        })
        emailsSent++
      } catch (err) {
        console.error(`[auto-complete] receipt email error for ${booking.reference_number}:`, err)
      }
    }

    if (staffEmails) {
      try {
        await sendTripCompletedStaffEmail({
          staffEmails,
          referenceNumber: booking.reference_number,
          guestName: booking.guest_name,
          pickupLocation: booking.pickup_location,
          dropoffLocation: booking.dropoff_location,
          vehicleType: booking.vehicle_type,
          finalCostUsd: booking.final_cost_usd ?? null,
        })
      } catch (err) {
        console.error(`[auto-complete] staff email error for ${booking.reference_number}:`, err)
      }
    }

    // In-app notification for the booking's creator — same as the manual
    // "Complete" button in the dashboard (app/api/bookings/[id]/complete),
    // so auto-completed trips aren't silently missing this compared to
    // manually-completed ones. Guest-submitted bookings have no created_by,
    // so nothing to notify there (guests get the email above instead).
    if (booking.created_by) {
      try {
        await adminSupabase.from('notifications').insert({
          user_id: booking.created_by,
          type: 'system',
          title: 'Trip Completed',
          message: `Booking ${booking.reference_number} has been marked as completed.`,
          booking_id: booking.id,
        })
      } catch (err) {
        console.error(`[auto-complete] notification error for ${booking.reference_number}:`, err)
      }
    }
  }

  return NextResponse.json({
    message: `Marked ${ids.length} booking(s) as completed`,
    completed: ids.length,
    emailsSent,
    references: bookings.map((b) => b.reference_number),
  })
}
