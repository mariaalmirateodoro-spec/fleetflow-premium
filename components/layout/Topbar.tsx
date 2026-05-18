'use client'

import { useState, useEffect } from 'react'
import { Bell, X, Check } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn, timeAgo } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import type { Notification, Profile } from '@/types'

interface TopbarProps {
  profile: Profile
  title: string
  subtitle?: string
}

export function Topbar({ profile, title, subtitle }: TopbarProps) {
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showNotifs, setShowNotifs] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    loadNotifications()
    // Real-time subscription
    const supabase = createClient()
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` },
        () => loadNotifications()
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [profile.id])

  async function loadNotifications() {
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
  }

  async function markAllRead() {
    const supabase = createClient()
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', profile.id)
      .eq('is_read', false)
    loadNotifications()
  }

  async function handleNotificationClick(n: Notification) {
    // Mark as read
    if (!n.is_read) {
      const supabase = createClient()
      await supabase.from('notifications').update({ is_read: true }).eq('id', n.id)
      loadNotifications()
    }
    // Navigate to related booking if applicable
    if (n.booking_id) {
      setShowNotifs(false)
      router.push('/bookings')
    }
  }

  const typeIcons: Record<string, string> = {
    new_request: '📋',
    new_booking: '📋',
    approval_needed: '⏳',
    approved: '✅',
    payment_due: '💳',
    system: 'ℹ️',
  }

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-4 border-b border-white/8 glass">
      {/* Page title */}
      <div>
        <h1 className="text-lg font-display font-bold text-white">{title}</h1>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        {/* Notification bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotifs(!showNotifs)}
            className="relative p-2 rounded-xl glass hover:bg-white/10 text-slate-400 hover:text-white transition-all"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-fleet-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse-glow">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifs && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowNotifs(false)} />
              <div className="absolute right-0 top-full mt-2 w-80 glass rounded-2xl border border-white/10 shadow-2xl z-20 animate-slide-down overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
                  <span className="text-sm font-semibold text-white">Notifications</span>
                  <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                      <button onClick={markAllRead} className="text-xs text-fleet-400 hover:text-fleet-300 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Mark all read
                      </button>
                    )}
                    <button onClick={() => setShowNotifs(false)}>
                      <X className="w-4 h-4 text-slate-500 hover:text-white transition-colors" />
                    </button>
                  </div>
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-white/5">
                  {notifications.length === 0 ? (
                    <div className="py-8 text-center text-sm text-slate-500">No notifications</div>
                  ) : (
                    notifications.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => handleNotificationClick(n)}
                        className={cn(
                          'w-full text-left px-4 py-3 text-sm transition-colors hover:bg-white/5',
                          n.is_read ? 'opacity-60' : 'bg-fleet-500/5',
                          n.booking_id && 'cursor-pointer'
                        )}
                      >
                        <div className="flex gap-2">
                          <span className="text-base shrink-0">{typeIcons[n.type] ?? 'ℹ️'}</span>
                          <div className="min-w-0">
                            <p className="font-medium text-slate-200 text-xs">{n.title}</p>
                            <p className="text-slate-400 text-xs mt-0.5 leading-snug">{n.message}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <p className="text-slate-600 text-[10px]">{timeAgo(n.created_at)}</p>
                              {n.booking_id && !n.is_read && (
                                <span className="text-[10px] text-fleet-400">View booking →</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Date chip */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 glass rounded-xl text-xs text-slate-400">
          <span>
            {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
        </div>
      </div>
    </header>
  )
}
