import type { Metadata } from 'next'
import { desc, inArray } from 'drizzle-orm'
import { getProfile } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Topbar } from '@/components/layout/Topbar'
import { ActivityLogClient } from '@/components/activity/ActivityLogClient'
import { db, schema } from '@/lib/db'

export const metadata: Metadata = { title: 'Activity Log' }

// Talks directly to Postgres via Drizzle instead of PostgREST.
export default async function ActivityPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')
  if (!['admin', 'manager'].includes(profile.role)) redirect('/dashboard')

  const logs = await db
    .select()
    .from(schema.auditLog)
    .orderBy(desc(schema.auditLog.createdAt))
    .limit(300)

  // Attach reference numbers for any logs tied to a booking (two-step lookup —
  // simpler and safer than relying on a specific FK constraint name for an
  // embedded join).
  const bookingIds = Array.from(new Set(logs.map((l) => l.bookingId).filter(Boolean))) as string[]
  let refByBookingId: Record<string, string> = {}
  if (bookingIds.length > 0) {
    const bookingRows = await db
      .select({ id: schema.bookings.id, referenceNumber: schema.bookings.referenceNumber })
      .from(schema.bookings)
      .where(inArray(schema.bookings.id, bookingIds))
    refByBookingId = Object.fromEntries(bookingRows.map((b) => [b.id, b.referenceNumber]))
  }

  const enrichedLogs = logs.map((l) => ({
    id: l.id,
    booking_id: l.bookingId,
    actor_id: l.actorId,
    actor_name: l.actorName,
    action: l.action,
    field: l.field,
    old_value: l.oldValue,
    new_value: l.newValue,
    note: l.note,
    created_at: l.createdAt,
    reference_number: l.bookingId ? refByBookingId[l.bookingId] ?? null : null,
  }))

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar profile={profile} title="Activity Log" subtitle="Every staff action recorded across the system" />
      <div className="flex-1 overflow-y-auto p-6">
        <ActivityLogClient initialLogs={enrichedLogs} />
      </div>
    </div>
  )
}
