import { NextRequest, NextResponse } from 'next/server'
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm'
import { createClient } from '@/lib/supabase/server'
import { notifyManagers } from '@/lib/notifications'
import { logAudit, adminClient } from '@/lib/audit'
import { db, schema } from '@/lib/db'

// GET (list) — not currently called from the frontend (the real Bookings
// page fetches its own data directly server-side, see
// app/(dashboard)/bookings/page.tsx from Phase 2c); migrated anyway for
// consistency, in case anything else starts using it. Talks directly to
// Postgres via Drizzle instead of PostgREST.
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') ?? '50')
    const offset = parseInt(searchParams.get('offset') ?? '0')

    const conditions = []
    if (status) conditions.push(eq(schema.bookings.status, status as typeof schema.bookings.$inferSelect.status))
    if (search) {
      conditions.push(
        or(
          ilike(schema.bookings.guestName, `%${search}%`),
          ilike(schema.bookings.referenceNumber, `%${search}%`)
        )
      )
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined

    const [rows, [{ count }]] = await Promise.all([
      db
        .select({
          b: schema.bookings,
          creatorFullName: schema.profiles.fullName,
          supplierCompanyName: schema.suppliers.companyName,
        })
        .from(schema.bookings)
        .leftJoin(schema.profiles, eq(schema.bookings.createdBy, schema.profiles.id))
        .leftJoin(schema.suppliers, eq(schema.bookings.assignedSupplier, schema.suppliers.id))
        .where(where)
        .orderBy(desc(schema.bookings.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: sql<number>`count(*)::int` }).from(schema.bookings).where(where),
    ])

    const data = rows.map(({ b, creatorFullName, supplierCompanyName }) => ({
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
      suppliers: supplierCompanyName != null ? { company_name: supplierCompanyName } : undefined,
    }))

    return NextResponse.json({ data, count })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Staff "New Booking" create — talks directly to Postgres via Drizzle (see
// lib/db) instead of PostgREST. Used to need the fleetflow_set_is_draft RPC
// as a workaround for PostgREST losing track of the is_draft column (ticket
// SU-415685); not needed anymore since this route no longer touches
// PostgREST at all. auth.getUser() below is Supabase Auth, a separate
// service from PostgREST/the database — unaffected by that bug, so it's
// intentionally left as-is.
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const isDraft = body.is_draft === true

    const [created] = await db
      .insert(schema.bookings)
      .values({
        guestName: body.guest_name ?? null,
        guestNationality: body.guest_nationality ?? null,
        guestCount: body.guest_count != null ? Number(body.guest_count) : 1,
        guestPhone: body.guest_phone ?? null,
        guestEmail: body.guest_email ?? null,
        guestLineId: body.guest_line_id ?? null,
        pickupDatetime: body.pickup_datetime ?? null,
        dropoffDatetime: body.dropoff_datetime ?? null,
        pickupLocation: body.pickup_location ?? null,
        dropoffLocation: body.dropoff_location ?? null,
        vehicleType: body.vehicle_type || 'sedan',
        driverRequired: body.driver_required ?? false,
        budgetUsd: body.budget_usd != null ? String(body.budget_usd) : null,
        notes: body.notes ?? null,
        specialRequests: body.special_requests ?? null,
        isDraft,
        createdBy: user.id,
      })
      .returning()

    if (!created) return NextResponse.json({ error: 'Failed to create booking' }, { status: 400 })

    // Notify managers
    await notifyManagers(
      'New Transport Request',
      `New booking ${created.referenceNumber} for ${created.guestName} requires review.`,
      created.id
    )

    const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
    await logAudit(adminClient(), {
      bookingId: created.id,
      actorId: user.id,
      actorName: profile?.full_name || user.email || 'Unknown',
      action: 'booking_created',
      note: `Created booking ${created.referenceNumber} for ${created.guestName}`,
    })

    return NextResponse.json({ data: created }, { status: 201 })
  } catch (err) {
    console.error('[bookings] POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
