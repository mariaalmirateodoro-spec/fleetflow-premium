import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { sendBookingConfirmationEmail } from '@/lib/email'

// Public endpoint — no auth required. A guest who knows their reference_number
// (given to them when they saved the draft) can resume editing it, and finally
// submit it for real. Only rows with is_draft = true can be touched here —
// once a booking is submitted/approved/etc. this route refuses to modify it.
//
// This route goes through two RPC functions (fleetflow_get_draft_by_reference,
// fleetflow_update_draft_booking — see supabase/patch_draft_rpc.sql) instead of
// plain .from('bookings') calls, because both need to read/write the is_draft
// column, which has repeatedly been dropped from Supabase's PostgREST schema
// cache in production (ticket SU-415685) even though it provably exists in the
// DB. Raw SQL inside an RPC function runs directly in Postgres and never goes
// through PostgREST's column-aware request parsing, so it sidesteps the bug.

type DraftRow = {
  id: string
  reference_number: string
  guest_name: string | null
  guest_nationality: string | null
  guest_email: string | null
  guest_count: number | null
  pickup_location: string | null
  dropoff_location: string | null
  pickup_datetime: string | null
  dropoff_datetime: string | null
  vehicle_type: string | null
  special_requests: string | null
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { reference: string } }
) {
  try {
    const adminClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { cookies: { getAll: () => [], setAll: () => {} } }
    )

    // Looked up via RPC (not a plain .select) with the service-role client —
    // this is a public, unauthenticated endpoint (a guest with just their
    // reference_number), so it can't rely on an RLS policy scoped to a logged-in
    // user. The reference_number itself is what actually limits this to one row;
    // the DB no longer has a broad anon-readable bookings policy to lean on
    // (see supabase/patch_lockdown_rls.sql).
    const { data: existing, error: fetchError } = await adminClient
      .rpc('fleetflow_get_draft_by_reference', { p_reference: params.reference })
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }
    const existingRow = existing as { id: string; is_draft: boolean }
    if (!existingRow.is_draft) {
      return NextResponse.json({ error: 'This booking is no longer a draft and cannot be edited here.' }, { status: 403 })
    }

    const body = await request.json()
    const finalize = body.finalize === true

    if (finalize) {
      const required = ['guest_name', 'guest_count', 'pickup_location', 'dropoff_location', 'pickup_datetime', 'vehicle_type', 'guest_phone', 'guest_email']
      for (const field of required) {
        if (!body[field]) {
          return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 })
        }
      }
    }

    // Guests have no session (no auth.uid()), so the update can't go through
    // RLS's owner check — same pattern as the modify-request route: use the
    // service-role client, since the reference_number itself is the guest's
    // "credential" here (and we've already verified it's still a draft above).
    // DraftResumeForm always sends the full current form state (not a partial
    // diff), so it's safe to write every editable field on every save.
    const { data, error } = await adminClient
      .rpc('fleetflow_update_draft_booking', {
        p_id: existingRow.id,
        p_finalize: finalize,
        p_guest_name: body.guest_name === '' ? null : body.guest_name ?? null,
        p_guest_nationality: body.guest_nationality === '' ? null : body.guest_nationality ?? null,
        p_guest_count: body.guest_count ? Number(body.guest_count) : null,
        p_guest_phone: body.guest_phone === '' ? null : body.guest_phone ?? null,
        p_guest_email: body.guest_email === '' ? null : body.guest_email ?? null,
        p_guest_line_id: body.guest_line_id === '' ? null : body.guest_line_id ?? null,
        p_pickup_location: body.pickup_location === '' ? null : body.pickup_location ?? null,
        p_dropoff_location: body.dropoff_location === '' ? null : body.dropoff_location ?? null,
        p_pickup_datetime: body.pickup_datetime === '' ? null : body.pickup_datetime ?? null,
        p_dropoff_datetime: body.dropoff_datetime === '' ? null : body.dropoff_datetime ?? null,
        p_vehicle_type: body.vehicle_type === '' ? null : body.vehicle_type ?? null,
        p_driver_required: typeof body.driver_required === 'boolean' ? body.driver_required : null,
        p_special_requests: body.special_requests === '' ? null : body.special_requests ?? null,
      })
      .single()

    if (error || !data) return NextResponse.json({ error: error?.message ?? 'Failed to update booking' }, { status: 400 })

    const updated = data as DraftRow

    if (finalize) {
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
            message: `${updated.guest_name} submitted a booking request — ${updated.pickup_location} → ${updated.dropoff_location}. Ref: ${updated.reference_number}`,
            booking_id: updated.id,
          }))
        )
      }

      if (updated.guest_email) {
        sendBookingConfirmationEmail({
          guestName: updated.guest_name ?? '',
          guestEmail: updated.guest_email,
          referenceNumber: updated.reference_number,
          pickupLocation: updated.pickup_location ?? '',
          dropoffLocation: updated.dropoff_location ?? '',
          pickupDatetime: updated.pickup_datetime ?? '',
          dropoffDatetime: updated.dropoff_datetime ?? null,
          vehicleType: updated.vehicle_type ?? '',
          guestCount: updated.guest_count ?? 1,
          specialRequests: updated.special_requests ?? null,
        }).catch((err) => console.error('[email] confirmation failed:', err))
      }
    }

    return NextResponse.json({ reference_number: updated.reference_number, is_draft: !finalize })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
