// ============================================================
// FleetFlow Premium – Notification System
// Creates in-app notifications + optional email via Resend
// ============================================================

import { createClient } from '@/lib/supabase/server'
import type { NotificationType } from '@/types'

interface CreateNotificationInput {
  userId: string
  type: NotificationType
  title: string
  message: string
  bookingId?: string
}

export async function createNotification(input: CreateNotificationInput) {
  const supabase = createClient()

  const { error } = await supabase
    .from('notifications')
    .insert({
      user_id: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      booking_id: input.bookingId ?? null,
    })

  if (error) {
    console.error('[notifications] Failed to create notification:', error)
  }
}

export async function notifyManagers(
  title: string,
  message: string,
  bookingId?: string
) {
  const supabase = createClient()

  const { data: managers } = await supabase
    .from('profiles')
    .select('id')
    .in('role', ['manager', 'admin'])
    .eq('is_active', true)

  if (!managers) return

  const notifications = managers.map((m) => ({
    user_id: m.id,
    type: 'approval_needed' as NotificationType,
    title,
    message,
    booking_id: bookingId ?? null,
  }))

  await supabase.from('notifications').insert(notifications)
}

export async function markNotificationRead(notificationId: string, userId: string) {
  const supabase = createClient()

  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .eq('user_id', userId)
}

export async function markAllNotificationsRead(userId: string) {
  const supabase = createClient()

  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false)
}
