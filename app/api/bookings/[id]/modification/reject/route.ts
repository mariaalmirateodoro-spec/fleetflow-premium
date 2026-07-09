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

  // Fetch booking
  const [booking] = await db
    .select({ modificationStatus: schema.bookings.modificationStatus, createdBy: schema.bookings.createdBy })
    .from(schema.bookings)
    .where(eq(schema.bookings.id, params.id))
    .limit(1)

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  }

  // Only the booking's creator, or an admin/manager, can act on it — matches
  // the old RLS policy ("Staff can update own bookings; admins/managers can
  // update any"), which silently blocked everyone else at the database
  // level before this route talked directly to Postgres.
  if (booking.createdBy !== user.id && !['admin', 'manager'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (booking.modificationStatus !== 'pending') {
    return NextResponse.json({ error: 'No pending modification request' }, { status: 400 })
  }

  const now = new Date().toISOString()

  // Clear modification fields, mark rejected
  await db
    .update(schema.bookings)
    .set({
      modificationStatus: 'rejected',
      modificationPickupDatetime: null,
      modificationPickupLocation: null,
      modificationDropoffLocation: null,
      modificationNotes: null,
      modificationRequestedAt: null,
      updatedAt: now,
    })
    .where(eq(schema.bookings.id, params.id))

  await logAudit(adminClient(), {
    bookingId: params.id,
    actorId: user.id,
    actorName: profile?.full_name || user.email || 'Unknown',
    action: 'modification_rejected',
  })

  return NextResponse.json({ success: true })
}
