// ============================================================
// FleetFlow Premium – Notification System
// ============================================================

import { inArray, and, eq } from 'drizzle-orm'
import { db, schema } from '@/lib/db'
import type { NotificationType } from '@/types'

// Talks directly to Postgres via Drizzle instead of PostgREST. This used to
// go through the session-bound Supabase client (the logged-in staff
// member's own 'authenticated' role) — but a security patch
// (supabase/patch_lockdown_rls.sql) locked the notifications table's INSERT
// policy down to "server only" (WITH CHECK (false)), which blocks that role
// entirely. Since that patch, every call to notifyManagers() has been
// silently failing (the insert's error was never checked) — meaning
// managers/admins stopped getting "New Transport Request" notifications
// when staff created bookings. Drizzle bypasses RLS the same way the old
// service-role client did, so this fixes it. Unrelated to the direct-
// Postgres migration itself, just surfaced while touching this file.
export async function notifyManagers(
  title: string,
  message: string,
  bookingId?: string
) {
  const managers = await db
    .select({ id: schema.profiles.id })
    .from(schema.profiles)
    .where(and(inArray(schema.profiles.role, ['manager', 'admin']), eq(schema.profiles.isActive, true)))

  if (managers.length === 0) return

  await db.insert(schema.notifications).values(
    managers.map((m) => ({
      userId: m.id,
      type: 'approval_needed' as NotificationType,
      title,
      message,
      bookingId: bookingId ?? null,
    }))
  )
}
