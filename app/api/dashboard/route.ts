import { NextResponse } from 'next/server'
import { and, eq, gte, inArray } from 'drizzle-orm'
import { createClient } from '@/lib/supabase/server'
import { db, schema } from '@/lib/db'

// Talks directly to Postgres via Drizzle instead of PostgREST. Note: not
// currently called from the frontend (the real dashboard page fetches its
// own, richer data directly — see app/(dashboard)/dashboard/page.tsx);
// migrated anyway for consistency, in case anything else starts using it.
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const now = new Date().toISOString()

  const [allBookings, pending, availableSuppliers, upcoming] = await Promise.all([
    db.select({ id: schema.bookings.id }).from(schema.bookings),
    db.select({ id: schema.bookings.id }).from(schema.bookings).where(eq(schema.bookings.status, 'pending')),
    db.select({ id: schema.suppliers.id }).from(schema.suppliers).where(eq(schema.suppliers.isAvailable, true)),
    db
      .select()
      .from(schema.bookings)
      .where(
        and(
          inArray(schema.bookings.status, ['approved', 'quoted']),
          gte(schema.bookings.pickupDatetime, now)
        )
      )
      .orderBy(schema.bookings.pickupDatetime)
      .limit(5),
  ])

  const data = {
    totalBookings: allBookings.length,
    pendingCount: pending.length,
    supplierCount: availableSuppliers.length,
    upcomingBookings: upcoming.map((b) => ({
      id: b.id,
      reference_number: b.referenceNumber,
      guest_name: b.guestName,
      pickup_datetime: b.pickupDatetime,
      pickup_location: b.pickupLocation,
      dropoff_location: b.dropoffLocation,
      status: b.status,
    })),
  }

  return NextResponse.json({ data })
}
