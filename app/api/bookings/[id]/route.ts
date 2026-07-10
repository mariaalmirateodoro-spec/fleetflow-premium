import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { createClient, getUser } from '@/lib/supabase/server'
import { sendDriverAssignedEmail } from '@/lib/email'
import { logAudit, adminClient } from '@/lib/audit'
import { db, schema } from '@/lib/db'

// GET (detail) — not currently called from the frontend (BookingDetailModal
// receives its `booking` prop directly from the already-fetched list, and
// re-loads specific pieces like quotes via their own routes); migrated
// anyway for consistency, in case anything else starts using it. Talks
// directly to Postgres via Drizzle instead of PostgREST.
export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [row] = await db
    .select({
      b: schema.bookings,
      creatorFullName: schema.profiles.fullName,
      supplier: schema.suppliers,
    })
    .from(schema.bookings)
    .leftJoin(schema.profiles, eq(schema.bookings.createdBy, schema.profiles.id))
    .leftJoin(schema.suppliers, eq(schema.bookings.assignedSupplier, schema.suppliers.id))
    .where(eq(schema.bookings.id, params.id))
    .limit(1)

  if (!row) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })

  const quoteRows = await db
    .select({ q: schema.quotes, supplier: schema.suppliers })
    .from(schema.quotes)
    .leftJoin(schema.suppliers, eq(schema.quotes.supplierId, schema.suppliers.id))
    .where(eq(schema.quotes.bookingId, params.id))

  const reshapeSupplier = (s: typeof schema.suppliers.$inferSelect | null) =>
    s
      ? {
          id: s.id,
          company_name: s.companyName,
          contact_person: s.contactPerson,
          phone: s.phone,
          email: s.email,
          address: s.address,
          vehicle_types: s.vehicleTypes,
          base_rate_usd: s.baseRateUsd != null ? Number(s.baseRateUsd) : null,
          rating: s.rating != null ? Number(s.rating) : 0,
          total_bookings: s.totalBookings,
          is_available: s.isAvailable,
          is_preferred: s.isPreferred,
          notes: s.notes,
          created_by: s.createdBy,
          created_at: s.createdAt,
          updated_at: s.updatedAt,
        }
      : undefined

  const { b, creatorFullName, supplier } = row

  const data = {
    id: b.id,
    reference_number: b.referenceNumber,
    guest_name: b.guestName,
    guest_nationality: b.guestNationality,
    guest_count: b.guestCount,
    guest_phone: b.guestPhone,
    guest_email: b.guestEmail,
    guest_line_id: b.guestLineId,
    pickup_datetime: b.pickupDatetime,
    dropoff_datetime: b.dropoffDatetime,
    pickup_location: b.pickupLocation,
    dropoff_location: b.dropoffLocation,
    vehicle_type: b.vehicleType,
    driver_required: b.driverRequired,
    driver_id: b.driverId,
    vehicle_plate: b.vehiclePlate,
    vehicle_model: b.vehicleModel,
    budget_usd: b.budgetUsd != null ? Number(b.budgetUsd) : null,
    final_cost_usd: b.finalCostUsd != null ? Number(b.finalCostUsd) : null,
    status: b.status,
    notes: b.notes,
    special_requests: b.specialRequests,
    assigned_supplier: b.assignedSupplier,
    created_by: b.createdBy,
    approved_by: b.approvedBy,
    approved_at: b.approvedAt,
    completed_at: b.completedAt,
    cancelled_at: b.cancelledAt,
    cancellation_reason: b.cancellationReason,
    created_at: b.createdAt,
    updated_at: b.updatedAt,
    is_draft: b.isDraft,
    modification_status: b.modificationStatus,
    modification_pickup_datetime: b.modificationPickupDatetime,
    modification_pickup_location: b.modificationPickupLocation,
    modification_dropoff_location: b.modificationDropoffLocation,
    modification_notes: b.modificationNotes,
    modification_requested_at: b.modificationRequestedAt,
    profiles: creatorFullName != null ? { full_name: creatorFullName } : undefined,
    suppliers: reshapeSupplier(supplier),
    quotes: quoteRows.map(({ q, supplier: qs }) => ({
      id: q.id,
      booking_id: q.bookingId,
      supplier_id: q.supplierId,
      amount_usd: Number(q.amountUsd),
      includes_driver: q.includesDriver,
      vehicle_model: q.vehicleModel,
      estimated_duration_hours: q.estimatedDurationHours != null ? Number(q.estimatedDurationHours) : null,
      valid_until: q.validUntil,
      notes: q.notes,
      is_selected: q.isSelected,
      invoice_path: q.invoicePath,
      created_by: q.createdBy,
      created_at: q.createdAt,
      suppliers: reshapeSupplier(qs),
    })),
  }

  return NextResponse.json({ data })
}

// Staff "Edit Booking" update (also used for single-field patches: driver
// assignment, vehicle plate/model, final cost) — talks directly to Postgres
// via Drizzle (see lib/db) instead of PostgREST. Used to need the
// fleetflow_get_is_draft / fleetflow_set_is_draft RPCs as a workaround for
// PostgREST losing track of the is_draft column (ticket SU-415685); not
// needed anymore since this route no longer touches PostgREST at all.
// getUser() below is the fast, cache()-backed helper from
// lib/supabase/server (Supabase Auth, a separate service from
// PostgREST/the database — unaffected by that bug either way).
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const user = await getUser()
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
      createdBy: schema.bookings.createdBy,
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

  if (!existing) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })

  // Any authenticated staff member can edit any booking (not restricted to
  // the creator or admin/manager) — explicit product decision. Only
  // final_cost_usd stays admin/manager-only (checked above).

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
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Admin only — verify via user session
  const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Grab identifying details before deleting — this was never wired up to
  // the Activity Log, so deletions were both unlogged AND (since
  // audit_log.booking_id cascades on delete) would have wiped out any prior
  // history for the booking too. Logged with bookingId: null (the booking
  // won't exist anymore) and the reference number in the note instead, so
  // this entry survives the delete.
  const [toDelete] = await db
    .select({ referenceNumber: schema.bookings.referenceNumber, guestName: schema.bookings.guestName })
    .from(schema.bookings)
    .where(eq(schema.bookings.id, params.id))
    .limit(1)

  try {
    await db.delete(schema.notifications).where(eq(schema.notifications.bookingId, params.id))
    await db.delete(schema.approvals).where(eq(schema.approvals.bookingId, params.id))
    await db.delete(schema.quotes).where(eq(schema.quotes.bookingId, params.id))
    await db.delete(schema.bookings).where(eq(schema.bookings.id, params.id))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete booking'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  await logAudit(adminClient(), {
    bookingId: null,
    actorId: user.id,
    actorName: profile.full_name || user.email || 'Unknown',
    action: 'booking_deleted',
    note: toDelete
      ? `Deleted booking ${toDelete.referenceNumber}${toDelete.guestName ? ` (${toDelete.guestName})` : ''}`
      : `Deleted booking ${params.id}`,
  })

  return NextResponse.json({ success: true })
}
