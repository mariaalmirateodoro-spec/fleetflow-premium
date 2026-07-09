import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { sendModificationRequestEmail } from '@/lib/email'
import { db, schema } from '@/lib/db'

// Guest-facing: no Supabase auth session here (guests aren't logged-in
// users), looked up by reference_number instead of id — matches the
// original supabase-js admin-client version. Talks directly to Postgres via
// Drizzle instead of PostgREST.
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json()
  const { pickup_datetime, pickup_location, dropoff_location, notes } = body as {
    pickup_datetime?: string
    pickup_location?: string
    dropoff_location?: string
    notes?: string
  }

  // At least one field must be requested
  if (!pickup_datetime && !pickup_location && !dropoff_location && !notes) {
    return NextResponse.json({ error: 'At least one change must be requested' }, { status: 400 })
  }

  // Fetch the booking by reference_number
  const [booking] = await db
    .select({
      id: schema.bookings.id,
      guestName: schema.bookings.guestName,
      guestEmail: schema.bookings.guestEmail,
      referenceNumber: schema.bookings.referenceNumber,
      pickupDatetime: schema.bookings.pickupDatetime,
      pickupLocation: schema.bookings.pickupLocation,
      dropoffLocation: schema.bookings.dropoffLocation,
      status: schema.bookings.status,
      modificationStatus: schema.bookings.modificationStatus,
    })
    .from(schema.bookings)
    .where(eq(schema.bookings.referenceNumber, params.id))
    .limit(1)

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  }

  // Only allow modifications for pending or approved bookings
  if (booking.status !== 'pending' && booking.status !== 'approved') {
    return NextResponse.json({ error: 'Modifications can only be requested for active bookings' }, { status: 400 })
  }

  // Prevent duplicate pending requests
  if (booking.modificationStatus === 'pending') {
    return NextResponse.json({ error: 'A modification request is already pending' }, { status: 400 })
  }

  const now = new Date().toISOString()

  // Store the modification request
  await db
    .update(schema.bookings)
    .set({
      modificationStatus: 'pending',
      modificationPickupDatetime: pickup_datetime ?? null,
      modificationPickupLocation: pickup_location ?? null,
      modificationDropoffLocation: dropoff_location ?? null,
      modificationNotes: notes ?? null,
      modificationRequestedAt: now,
      updatedAt: now,
    })
    .where(eq(schema.bookings.id, booking.id))

  // Notify admin via email
  const adminEmail = process.env.GMAIL_USER
  if (adminEmail) {
    try {
      await sendModificationRequestEmail({
        adminEmail,
        guestName: booking.guestName ?? '',
        referenceNumber: booking.referenceNumber,
        requestedPickupDatetime: pickup_datetime ?? null,
        requestedPickupLocation: pickup_location ?? null,
        requestedDropoffLocation: dropoff_location ?? null,
        requestedNotes: notes ?? null,
        originalPickupDatetime: booking.pickupDatetime ?? '',
        originalPickupLocation: booking.pickupLocation ?? '',
        originalDropoffLocation: booking.dropoffLocation ?? '',
      })
    } catch (err) {
      console.error('[modify-request] email error:', err)
    }
  }

  return NextResponse.json({ success: true })
}
