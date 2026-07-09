import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { notifyManagers } from '@/lib/notifications'
import { logAudit, adminClient } from '@/lib/audit'
import { db, schema } from '@/lib/db'

// GET (list) still goes through supabase-js/PostgREST for now — it's a
// read-only join query (profiles + suppliers) that isn't part of the
// is_draft bug this migration targets, and isn't broken today. Slated for
// the general CRUD sweep (Phase 2d) rather than rewritten here.
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

    let query = supabase
      .from('bookings')
      .select('*, profiles!bookings_created_by_fkey(full_name), suppliers(company_name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) query = query.eq('status', status)
    if (search) query = query.or(`guest_name.ilike.%${search}%,reference_number.ilike.%${search}%`)

    const { data, error, count } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

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
