import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { createClient } from '@/lib/supabase/server'
import { logAudit, adminClient } from '@/lib/audit'
import { db, schema } from '@/lib/db'

// Talks directly to Postgres via Drizzle instead of PostgREST — same
// migration pass as approve/route.ts and the other booking-lifecycle routes.
export async function POST(
  _: NextRequest,
  { params }: { params: { id: string } }
) {
  // Verify admin session
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  if (!['admin', 'manager', 'staff'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Fetch booking with modification data
  const [booking] = await db
    .select()
    .from(schema.bookings)
    .where(eq(schema.bookings.id, params.id))
    .limit(1)

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  }

  if (booking.modificationStatus !== 'pending') {
    return NextResponse.json({ error: 'No pending modification request' }, { status: 400 })
  }

  const now = new Date().toISOString()

  // Apply the requested changes and clear modification fields
  const updates: {
    modificationStatus: string
    modificationPickupDatetime: null
    modificationPickupLocation: null
    modificationDropoffLocation: null
    modificationNotes: null
    modificationRequestedAt: null
    updatedAt: string
    pickupDatetime?: string
    pickupLocation?: string
    dropoffLocation?: string
  } = {
    modificationStatus: 'approved',
    modificationPickupDatetime: null,
    modificationPickupLocation: null,
    modificationDropoffLocation: null,
    modificationNotes: null,
    modificationRequestedAt: null,
    updatedAt: now,
  }

  if (booking.modificationPickupDatetime) {
    updates.pickupDatetime = booking.modificationPickupDatetime
  }
  if (booking.modificationPickupLocation) {
    updates.pickupLocation = booking.modificationPickupLocation
  }
  if (booking.modificationDropoffLocation) {
    updates.dropoffLocation = booking.modificationDropoffLocation
  }

  const [updated] = await db
    .update(schema.bookings)
    .set(updates)
    .where(eq(schema.bookings.id, params.id))
    .returning()

  await logAudit(adminClient(), {
    bookingId: params.id,
    actorId: user.id,
    actorName: profile?.full_name || user.email || 'Unknown',
    action: 'modification_approved',
    note: booking.modificationNotes ?? null,
  })

  const data = {
    id: updated.id,
    reference_number: updated.referenceNumber,
    pickup_datetime: updated.pickupDatetime,
    pickup_location: updated.pickupLocation,
    dropoff_location: updated.dropoffLocation,
    modification_status: updated.modificationStatus,
  }

  return NextResponse.json({ success: true, data })
}
