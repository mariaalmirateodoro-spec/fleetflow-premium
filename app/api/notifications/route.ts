import { NextRequest, NextResponse } from 'next/server'
import { and, desc, eq } from 'drizzle-orm'
import { createClient, getUser } from '@/lib/supabase/server'
import { db, schema } from '@/lib/db'

// Talks directly to Postgres via Drizzle instead of PostgREST.
export async function GET() {
  const supabase = createClient()
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await db
    .select()
    .from(schema.notifications)
    .where(eq(schema.notifications.userId, user.id))
    .orderBy(desc(schema.notifications.createdAt))
    .limit(50)

  const data = rows.map((n) => ({
    id: n.id,
    user_id: n.userId,
    type: n.type,
    title: n.title,
    message: n.message,
    booking_id: n.bookingId,
    is_read: n.isRead,
    created_at: n.createdAt,
  }))

  return NextResponse.json({ data })
}

export async function PATCH(request: NextRequest) {
  const supabase = createClient()
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { markAllRead, notificationId } = await request.json()

  if (markAllRead) {
    await db
      .update(schema.notifications)
      .set({ isRead: true })
      .where(and(eq(schema.notifications.userId, user.id), eq(schema.notifications.isRead, false)))
  } else if (notificationId) {
    await db
      .update(schema.notifications)
      .set({ isRead: true })
      .where(and(eq(schema.notifications.id, notificationId), eq(schema.notifications.userId, user.id)))
  }

  return NextResponse.json({ success: true })
}
