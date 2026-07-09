import { NextRequest, NextResponse } from 'next/server'
import { eq, inArray } from 'drizzle-orm'
import { db, schema } from '@/lib/db'
import { sendBookingConfirmationEmail } from '@/lib/email'

// Public endpoint — no auth required. A guest who knows their reference_number
// (given to them when they saved the draft) can resume editing it, and finally
// submit it for real. Only rows with is_draft = true can be touched here —
// once a booking is submitted/approved/etc. this route refuses to modify it.
//
// Talks directly to Postgres via Drizzle (see lib/db) instead of PostgREST —
// this route used to depend on RPC-function workarounds
// (fleetflow_get_draft_by_reference, fleetflow_update_draft_booking) because
// both needed to read/write the is_draft column, which PostgREST's schema
// cache repeatedly lost track of in production (ticket SU-415685). Those
// RPCs are no longer needed now that this route bypasses PostgREST entirely.
// The reference_number itself is still what limits this to one row — same
// as before, there's no session/RLS to lean on for a guest with no login.

export async function PATCH(
  request: NextRequest,
  { params }: { params: { reference: string } }
) {
  try {
    const [existing] = await db
      .select({ id: schema.bookings.id, isDraft: schema.bookings.isDraft })
      .from(schema.bookings)
      .where(eq(schema.bookings.referenceNumber, params.reference.toUpperCase()))
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }
    if (!existing.isDraft) {
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

    // DraftResumeForm always sends the full current form state (not a
    // partial diff), so it's safe to write every editable field on every
    // save. `undefined` values are left out of Drizzle's SET clause
    // entirely (as opposed to `null`, which writes NULL) — used here for
    // fields that should keep their existing DB value when not present.
    const [updated] = await db
      .update(schema.bookings)
      .set({
        guestName: body.guest_name === '' ? null : body.guest_name ?? null,
        guestNationality: body.guest_nationality === '' ? null : body.guest_nationality ?? null,
        guestCount: body.guest_count ? Number(body.guest_count) : undefined,
        guestPhone: body.guest_phone === '' ? null : body.guest_phone ?? null,
        guestEmail: body.guest_email === '' ? null : body.guest_email ?? null,
        guestLineId: body.guest_line_id === '' ? null : body.guest_line_id ?? null,
        pickupLocation: body.pickup_location === '' ? null : body.pickup_location ?? null,
        dropoffLocation: body.dropoff_location === '' ? null : body.dropoff_location ?? null,
        pickupDatetime: body.pickup_datetime === '' ? null : body.pickup_datetime ?? null,
        dropoffDatetime: body.dropoff_datetime === '' ? null : body.dropoff_datetime ?? null,
        vehicleType: body.vehicle_type === '' || body.vehicle_type == null ? undefined : body.vehicle_type,
        driverRequired: typeof body.driver_required === 'boolean' ? body.driver_required : undefined,
        specialRequests: body.special_requests === '' ? null : body.special_requests ?? null,
        isDraft: finalize ? false : undefined,
      })
      .where(eq(schema.bookings.id, existing.id))
      .returning({
        id: schema.bookings.id,
        referenceNumber: schema.bookings.referenceNumber,
        guestName: schema.bookings.guestName,
        guestEmail: schema.bookings.guestEmail,
        guestCount: schema.bookings.guestCount,
        pickupLocation: schema.bookings.pickupLocation,
        dropoffLocation: schema.bookings.dropoffLocation,
        pickupDatetime: schema.bookings.pickupDatetime,
        dropoffDatetime: schema.bookings.dropoffDatetime,
        vehicleType: schema.bookings.vehicleType,
        specialRequests: schema.bookings.specialRequests,
      })

    if (!updated) {
      return NextResponse.json({ error: 'Failed to update booking' }, { status: 400 })
    }

    if (finalize) {
      // Same follow-up as a normal guest submission: notify staff + email the guest.
      const staff = await db
        .select({ id: schema.profiles.id })
        .from(schema.profiles)
        .where(inArray(schema.profiles.role, ['admin', 'manager', 'staff']))

      if (staff.length > 0) {
        await db.insert(schema.notifications).values(
          staff.map((user) => ({
            userId: user.id,
            type: 'new_booking' as const,
            title: '🚗 New Guest Booking',
            message: `${updated.guestName} submitted a booking request — ${updated.pickupLocation} → ${updated.dropoffLocation}. Ref: ${updated.referenceNumber}`,
            bookingId: updated.id,
          }))
        )
      }

      if (updated.guestEmail) {
        // Awaited (not fire-and-forget) — see note in
        // app/api/public/bookings/route.ts for why.
        try {
          await sendBookingConfirmationEmail({
            guestName: updated.guestName ?? '',
            guestEmail: updated.guestEmail,
            referenceNumber: updated.referenceNumber,
            pickupLocation: updated.pickupLocation ?? '',
            dropoffLocation: updated.dropoffLocation ?? '',
            pickupDatetime: updated.pickupDatetime ?? '',
            dropoffDatetime: updated.dropoffDatetime ?? null,
            vehicleType: updated.vehicleType ?? '',
            guestCount: updated.guestCount ?? 1,
            specialRequests: updated.specialRequests ?? null,
          })
        } catch (err) {
          console.error('[email] confirmation failed:', err)
        }
      }
    }

    return NextResponse.json({ reference_number: updated.referenceNumber, is_draft: !finalize })
  } catch (err) {
    console.error('[public/bookings/[reference]] PATCH error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
