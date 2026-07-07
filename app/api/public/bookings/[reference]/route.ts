import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { sendBookingConfirmationEmail } from '@/lib/email'

// Public endpoint — no auth required. A guest who knows their reference_number
// (given to them when they saved the draft) can resume editing it, and finally
// submit it for real. Only rows with is_draft = true can be touched here —
// once a booking is submitted/approved/etc. this route refuses to modify it.

const EDITABLE_FIELDS = [
  'guest_name', 'guest_nationality', 'guest_count', 'guest_phone', 'guest_email',
  'guest_line_id', 'pickup_location', 'dropoff_location', 'pickup_datetime',
  'dropoff_datetime', 'vehicle_type', 'driver_required', 'special_requests',
] as const

export async function PATCH(
  request: NextRequest,
  { params }: { params: { reference: string } }
) {
  try {
    const anonClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => [], setAll: () => {} } }
    )
    const adminClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { cookies: { getAll: () => [], setAll: () => {} } }
    )

    const { data: existing, error: fetchError } = await anonClient
      .from('bookings')
      .select('id, is_draft')
      .eq('reference_number', params.reference.toUpperCase())
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }
    if (!existing.is_draft) {
      return NextResponse.json({ error: 'This booking is no longer a draft and cannot be edited here.' }, { status: 403 })
    }

    const body = await request.json()
    const finalize = body.finalize === true

    let verificationId: string | null = null
    if (finalize) {
      const required = ['guest_name', 'guest_nationality', 'guest_count', 'pickup_location', 'dropoff_location', 'pickup_datetime', 'vehicle_type', 'guest_phone', 'guest_email']
      for (const field of required) {
        if (!body[field]) {
          return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 })
        }
      }

      const normalizedEmail = String(body.guest_email).trim().toLowerCase()
      const { data: verification } = await adminClient
        .from('email_verifications')
        .select('id')
        .eq('email', normalizedEmail)
        .eq('verified', true)
        .eq('used', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!verification) {
        return NextResponse.json(
          { error: 'Please verify your email address before submitting your booking.' },
          { status: 403 }
        )
      }
      verificationId = verification.id
    }

    const update: Record<string, unknown> = {}
    for (const field of EDITABLE_FIELDS) {
      if (field in body) update[field] = body[field] === '' ? null : body[field]
    }
    if (finalize) update.is_draft = false

    // Guests have no session (no auth.uid()), so the update can't go through
    // RLS's owner check — same pattern as the modify-request route: use the
    // service-role client, since the reference_number itself is the guest's
    // "credential" here (and we've already verified it's still a draft above).
    const { data, error } = await adminClient
      .from('bookings')
      .update(update)
      .eq('id', existing.id)
      .select('id, reference_number, guest_name, guest_nationality, guest_email, guest_count, pickup_location, dropoff_location, pickup_datetime, dropoff_datetime, vehicle_type, special_requests')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    if (finalize) {
      // Consume the verification so it can't be reused for a different booking
      if (verificationId) {
        await adminClient.from('email_verifications').update({ used: true }).eq('id', verificationId)
      }

      // Same follow-up as a normal guest submission: notify staff + email the guest.
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
            message: `${data.guest_name} (${data.guest_nationality}) submitted a booking request — ${data.pickup_location} → ${data.dropoff_location}. Ref: ${data.reference_number}`,
            booking_id: data.id,
          }))
        )
      }

      if (data.guest_email) {
        sendBookingConfirmationEmail({
          guestName: data.guest_name,
          guestEmail: data.guest_email,
          referenceNumber: data.reference_number,
          pickupLocation: data.pickup_location,
          dropoffLocation: data.dropoff_location,
          pickupDatetime: data.pickup_datetime,
          dropoffDatetime: data.dropoff_datetime ?? null,
          vehicleType: data.vehicle_type,
          guestCount: data.guest_count,
          specialRequests: data.special_requests ?? null,
        }).catch((err) => console.error('[email] confirmation failed:', err))
      }
    }

    return NextResponse.json({ reference_number: data.reference_number, is_draft: !finalize })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
