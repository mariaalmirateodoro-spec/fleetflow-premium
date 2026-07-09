import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { createClient } from '@/lib/supabase/server'
import { logAudit, adminClient } from '@/lib/audit'
import { db, schema } from '@/lib/db'

// Talks directly to Postgres via Drizzle instead of PostgREST — same
// migration pass as approve/route.ts and the other booking-lifecycle routes.
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Role check
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, full_name')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'manager', 'staff'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Fetch booking
  const [booking] = await db
    .select()
    .from(schema.bookings)
    .where(eq(schema.bookings.id, params.id))
    .limit(1)

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  }

  // Only the booking's creator, or an admin/manager, can complete it —
  // matches the old RLS policy ("Staff can update own bookings;
  // admins/managers can update any"), which silently blocked everyone else
  // at the database level before this route talked directly to Postgres.
  if (booking.createdBy !== user.id && !['admin', 'manager'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (booking.status !== 'approved') {
    return NextResponse.json(
      { error: 'Only approved bookings can be marked as completed' },
      { status: 400 }
    )
  }

  // Mark as completed
  await db
    .update(schema.bookings)
    .set({
      status: 'completed',
      completedAt: new Date().toISOString(),
    })
    .where(eq(schema.bookings.id, params.id))

  await logAudit(adminClient(), {
    bookingId: params.id,
    actorId: user.id,
    actorName: profile.full_name || user.email || 'Unknown',
    action: 'booking_completed',
    field: 'status',
    oldValue: 'approved',
    newValue: 'completed',
  })

  // In-app notification for booking creator
  if (booking.createdBy) {
    await db.insert(schema.notifications).values({
      userId: booking.createdBy,
      type: 'system',
      title: 'Trip Completed',
      message: `Booking ${booking.referenceNumber} has been marked as completed.`,
      bookingId: params.id,
    })
  }

  return NextResponse.json({ success: true })
}
