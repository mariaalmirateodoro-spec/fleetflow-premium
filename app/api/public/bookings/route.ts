import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { sendBookingConfirmationEmail } from '@/lib/email'

// Public endpoint — no auth required. Uses anon key + RLS policy that allows
// inserts where created_by IS NULL (guest bookings).
export async function POST(request: NextRequest) {
  try {
    const anonClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => [], setAll: () => {} } }
    )

    // Service-role client for sending notifications (bypasses RLS)
    const adminClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { cookies: { getAll: () => [], setAll: () => {} } }
    )

    const body = await request.json()

    // Basic validation
    const required = ['guest_name', 'guest_nationality', 'guest_count', 'pickup_location', 'dropoff_location', 'pickup_datetime', 'vehicle_type', 'guest_phone', 'guest_email']
    for (const field of required) {
      if (!body[field]) {
        return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 })
      }
    }

    const { data, error } = await anonClient
      .from('bookings')
      .insert({
        guest_name: body.guest_name,
        guest_nationality: body.guest_nationality,
        guest_count: Number(body.guest_count),
        guest_phone: body.guest_phone,
        guest_email: body.guest_email,
        guest_line_id: body.guest_line_id ?? null,
        pickup_location: body.pickup_location,
        dropoff_location: body.dropoff_location,
        pickup_datetime: body.pickup_datetime,
        dropoff_datetime: body.dropoff_datetime ?? null,
        vehicle_type: body.vehicle_type,
        driver_required: body.driver_required ?? true,
        special_requests: body.special_requests ?? null,
        status: 'pending',
        created_by: null, // guest booking — no auth user
      })
      .select('id, reference_number')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Notify all admin/manager/staff users about the new guest booking
    const { data: staff } = await adminClient
      .from('profiles')
      .select('id')
      .in('role', ['admin', 'manager', 'staff'])

    if (staff && staff.length > 0) {
      await adminClient.from('notifications').insert(
        staff.map((user) => ({
          user_id: user.id,
          type: 'new_booking',
          title: '🚗 New Guest Booking',
          message: `${body.guest_name} (${body.guest_nationality}) submitted a booking request — ${body.pickup_location} → ${body.dropoff_location}. Ref: ${data.reference_number}`,
          booking_id: data.id,
        }))
      )
    }

    // Send confirmation email to guest (non-blocking — don't fail the booking if email fails)
    sendBookingConfirmationEmail({
      guestName: body.guest_name,
      guestEmail: body.guest_email,
      referenceNumber: data.reference_number,
      pickupLocation: body.pickup_location,
      dropoffLocation: body.dropoff_location,
      pickupDatetime: body.pickup_datetime,
      dropoffDatetime: body.dropoff_datetime ?? null,
      vehicleType: body.vehicle_type,
      guestCount: Number(body.guest_count),
      specialRequests: body.special_requests ?? null,
    }).catch((err) => console.error('[email] confirmation failed:', err))

    return NextResponse.json({ reference_number: data.reference_number }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
