'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Notification, Profile } from '@/types'

// Owns the notifications list + realtime subscription for the whole
// dashboard session. Previously this lived inside Topbar, which is
// rendered fresh by every individual page.tsx (not shared via the
// layout) — so every navigation tore down and reopened a Supabase
// realtime WebSocket subscription. This provider lives in
// app/(dashboard)/layout.tsx instead, which Next.js keeps mounted across
// navigations within the dashboard, so the subscription is opened once
// per session and just stays open.
interface NotificationsValue {
  notifications: Notification[]
  unreadCount: number
  markAllRead: () => Promise<void>
  markRead: (id: string) => Promise<void>
  reload: () => Promise<void>
}

const NotificationsContext = createContext<NotificationsValue | null>(null)

export function NotificationsProvider({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  const reload = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(20)

    if (data) {
      setNotifications(data)
      setUnreadCount(data.filter((n) => !n.is_read).length)
    }
  }, [profile.id])

  useEffect(() => {
    reload()
    const supabase = createClient()
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` },
        () => reload()
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [profile.id, reload])

  const markAllRead = useCallback(async () => {
    const supabase = createClient()
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', profile.id)
      .eq('is_read', false)
    await reload()
  }, [profile.id, reload])

  const markRead = useCallback(async (id: string) => {
    const supabase = createClient()
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    await reload()
  }, [reload])

  return (
    <NotificationsContext.Provider value={{ notifications, unreadCount, markAllRead, markRead, reload }}>
      {children}
    </NotificationsContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext)
  if (!ctx) {
    // Safe fallback for anywhere rendered outside the provider.
    return {
      notifications: [] as Notification[],
      unreadCount: 0,
      markAllRead: async () => {},
      markRead: async () => {},
      reload: async () => {},
    }
  }
  return ctx
}
