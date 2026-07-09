import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { createClient } from '@/lib/supabase/server'
import { sendDriverAssignedEmail } from '@/lib/email'
import { logAudit, adminClient } from '@/lib/audit'
import { db, schema } from '@/lib/db'

// GET (detail) still goes through supabase-js/PostgREST for now — it's a
// read-only join query (profiles + suppliers + quotes) that isn't part of
// the is_draft bug this migration targets. Slated for the general CRUD
// sweep (Phase 2d) rather than rewritten here.
export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('bookings')
    .select('*, profiles!bookings_created_by_fkey(full_name), suppliers(*), quotes(*, suppliers(*))')
    .eq('id', params.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json({ data })
}

// Staff "Edit Booking" update (also used for single-field patches: driver
// assignment, vehicle plate/model, final cost) — talks directly to Postgres
// via Drizzle (see lib/db) instead of PostgREST. Used to need the
// fleetflow_get_is_draft / fleetflow_set_is_draft RPCs as a workaround for
// PostgREST losing track of the is_draft column (ticket SU-415685); not
// needed anymore since this route no longer touches PostgREST at all.
// auth.getUser() below is Supabase Auth, a separate service from
// PostgREST/the database — unaffected by that bug, so it's intentionally
// left as-is.
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  const body = await request.json()

  // Final cost changes have money-movement implications — restrict to
  // admin/manager (a plain staff account could otherwise quietly adjust the
  // amount after approval with nobody else aware).
  if (body.final_cost_usd !== undefined && !['admin', 'manager'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Only admins and managers can change the final cost.' }, { status: 403 })
  }

  // Fetch current values for anything we might need to audit or compare
  // against. Includes every field the staff "Edit Booking" form can send,
  // so the catch-all diff below only reports fields that actually changed.
  const [existing] = await db
    .select({
      driverId: schema.bookings.driverId,
      finalCostUsd: schema.bookings.finalCostUsd,
      guestEmail: schema.bookings.guestEmail,
      guestName: schema.bookings.guestName,
      guestNationality: schema.bookings.guestNationality,
      guestCount: schema.bookings.guestCount,
      guestPhone: schema.bookings.guestPhone,
      guestLineId: schema.bookings.guestLineId,
      referenceNumber: schema.bookings.referenceNumber,
      pickupLocation: schema.bookings.pickupLocation,
      dropoffLocation: schema.bookings.dropoffLocation,
      pickupDatetime: schema.bookings.pickupDatetime,
      dropoffDatetime: schema.bookings.dropoffDatetime,
      vehicleType: schema.bookings.vehicleType,
      vehiclePlate: schema.bookings.vehiclePlate,
      vehicleModel: schema.bookings.vehicleModel,
      driverRequired: schema.bookings.driverRequired,
      budgetUsd: schema.bookings.budgetUsd,
      notes: schema.bookings.notes,
      specialRequests: schema.bookings.specialRequests,
    })
    .from(schema.bookings)
    .where(eq(schema.bookings.id, params.id))
    .limit(1)

  // If a driver is being assigned, check whether it's a new/changed assignment
  let shouldEmailDriver = false
  let assignedDriver: { fullName: string; phone: string } | null = null

  if (body.driver_id != null && existing && existing.driverId !== body.driver_id && existing.guestEmail) {
    const [driver] = await db
      .select({ fullName: schema.drivers.fullName, phone: schema.drivers.phone })
      .from(schema.drivers)
      .where(eq(schema.drivers.id, body.driver_id))
      .limit(1)

    if (driver) {
      shouldEmailDriver = true
      assignedDriver = driver
    }
  }

  const [data] = await db
    .update(schema.bookings)
    .set({
      guestName: 'guest_name' in body ? (body.guest_name === '' ? null : body.guest_name ?? null) : undefined,
      guestNationality: 'guest_nationality' in body ? (body.guest_nationality === '' ? null : body.guest_nationality ?? null) : undefined,
      guestCount: body.guest_count != null ? Number(body.guest_count) : undefined,
      guestPhone: 'guest_phone' in body ? (body.guest_phone === '' ? null : body.guest_phone ?? null) : undefined,
      guestEmail: 'guest_email' in body ? (body.guest_email === '' ? null : body.guest_email ?? null) : undefined,
      guestLineId: 'guest_line_id' in body ? (body.guest_line_id === '' ? null : body.guest_line_id ?? null) : undefined,
      pickupDatetime: 'pickup_datetime' in body ? (body.pickup_datetime ?? null) : undefined,
      dropoffDatetime: 'dropoff_datetime' in body ? (body.dropoff_datetime ?? null) : undefined,
      pickupLocation: 'pickup_location' in body ? (body.pickup_location === '' ? null : body.pickup_location ?? null) : undefined,
      dropoffLocation: 'dropoff_location' in body ? (body.dropoff_location === '' ? null : body.dropoff_location ?? null) : undefined,
      vehicleType: 'vehicle_type' in body && body.vehicle_type ? body.vehicle_type : undefined,
      driverRequired: 'driver_required' in body ? body.driver_required : undefined,
      budgetUsd: 'budget_usd' in body ? (body.budget_usd != null ? String(body.budget_usd) : null) : undefined,
      notes: 'notes' in body ? (body.notes === '' ? null : body.notes ?? null) : undefined,
      specialRequests: 'special_requests' in body ? (body.special_requests === '' ? null : body.special_requests ?? null) : undefined,
      driverId: 'driver_id' in body ? body.driver_id : undefined,
      vehiclePlate: 'vehicle_plate' in body ? body.vehicle_plate : undefined,
      vehicleModel: 'vehicle_model' in body ? body.vehicle_model : undefined,
      finalCostUsd: 'final_cost_usd' in body ? (body.final_cost_usd != null ? String(body.final_cost_usd) : null) : undefined,
      isDraft: 'is_draft' in body ? body.is_draft === true : undefined,
    })
    .where(eq(schema.bookings.id, params.id))
    .returning()

  if (!data) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })

  const admin = adminClient()
  const actorName = profile?.full_name || user.email || 'Unknown'

  // Audit trail — only for the fields that matter for accountability.
  if (existing) {
    // final_cost_usd comes back from Drizzle as a string (numeric columns
    // use string mode to avoid float precision loss) but arrives in the
    // request body as a number — normalize both to Number before comparing,
    // otherwise "150" !== 150 would falsely log a change on every save.
    const existingFinalCost = existing.finalCostUsd != null ? Number(existing.finalCostUsd) : null
    if (body.final_cost_usd !== undefined && Number(body.final_cost_usd) !== existingFinalCost) {
      await logAudit(admin, {
        bookingId: params.id, actorId: user.id, actorName,
        action: 'final_cost_changed', field: 'final_cost_usd',
        oldValue: existing.finalCostUsd, newValue: body.final_cost_usd,
      })
    }
    if (body.driver_id !== undefined && body.driver_id !== existing.driverId) {
      await logAudit(admin, {
        bookingId: params.id, actorId: user.id, actorName,
        action: 'driver_changed', field: 'driver_id',
        oldValue: existing.driverId, newValue: body.driver_id,
      })
    }
  }

  // Generic catch-all: any other fields that actually changed value (guest
  // info, pickup/dropoff details, vehicle type, notes, etc. — e.g. edits made
  // through the staff "Edit Booking" form) get one summary entry. Diffed
  // against the fetched "existing" row above, not just "was this key present
  // in the request body" — the edit form resends the whole payload every
  // time, so a naive presence-check would falsely claim every field changed.
  // Explicit snake_case (request body) -> camelCase (Drizzle row) mapping,
  // since the two no longer share identical key names the way the old
  // supabase-js response (always snake_case) did.
  if (existing) {
    const fieldMap: Array<[string, keyof typeof existing]> = [
      ['guest_name', 'guestName'],
      ['guest_nationality', 'guestNationality'],
      ['guest_count', 'guestCount'],
      ['guest_phone', 'guestPhone'],
      ['guest_email', 'guestEmail'],
      ['guest_line_id', 'guestLineId'],
      ['pickup_location', 'pickupLocation'],
      ['dropoff_location', 'dropoffLocation'],
      ['pickup_datetime', 'pickupDatetime'],
      ['dropoff_datetime', 'dropoffDatetime'],
      ['vehicle_type', 'vehicleType'],
      ['vehicle_plate', 'vehiclePlate'],
      ['vehicle_model', 'vehicleModel'],
      ['driver_required', 'driverRequired'],
      ['budget_usd', 'budgetUsd'],
      ['notes', 'notes'],
      ['special_requests', 'specialRequests'],
    ]

    const changedKeys = fieldMap
      .filter(([bodyKey]) => bodyKey in body)
      .filter(([bodyKey, existingKey]) => {
        const newVal = body[bodyKey]
        const oldVal = existing[existingKey]
        // budget_usd is a numeric column (string mode) — normalize before comparing.
        if (existingKey === 'budgetUsd') {
          return Number(newVal ?? 0) !== (oldVal != null ? Number(oldVal) : null)
        }
        return newVal !== oldVal
      })
      .map(([bodyKey]) => bodyKey)

    if (changedKeys.length > 0) {
      await logAudit(admin, {
        bookingId: params.id, actorId: user.id, actorName,
        action: body.is_draft ? 'booking_draft_saved' : 'booking_updated',
        note: `Updated fields: ${changedKeys.join(', ')}`,
      })
    }
  }

  // Send driver assignment email to guest
  if (shouldEmailDriver && existing && assignedDriver) {
    try {
      await sendDriverAssignedEmail({
        guestName: existing.guestName ?? '',
        guestEmail: existing.guestEmail ?? '',
        referenceNumber: existing.referenceNumber,
        pickupLocation: existing.pickupLocation ?? '',
        dropoffLocation: existing.dropoffLocation ?? '',
        pickupDatetime: existing.pickupDatetime ?? '',
        vehicleType: existing.vehicleType,
        driverName: assignedDriver.fullName,
        driverPhone: assignedDriver.phone,
        vehiclePlate: (body.vehicle_plate ?? existing.vehiclePlate) as string | null,
        vehicleModel: (body.vehicle_model ?? existing.vehicleModel) as string | null,
      })
    } catch (err) {
      console.error('[driver-assign] email error:', err)
    }
  }

  return NextResponse.json({ data })
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Admin only — verify via user session
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    await db.delete(schema.notifications).where(eq(schema.notifications.bookingId, params.id))
    await db.delete(schema.approvals).where(eq(schema.approvals.bookingId, params.id))
    await db.delete(schema.quotes).where(eq(schema.quotes.bookingId, params.id))
    await db.delete(schema.bookings).where(eq(schema.bookings.id, params.id))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete booking'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
