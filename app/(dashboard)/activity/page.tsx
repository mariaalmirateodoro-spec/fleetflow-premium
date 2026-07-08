import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Topbar } from '@/components/layout/Topbar'
import { ActivityLogClient } from '@/components/activity/ActivityLogClient'

export const metadata: Metadata = { title: 'Activity Log' }

export default async function ActivityPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')
  if (!['admin', 'manager'].includes(profile.role)) redirect('/dashboard')

  const supabase = createClient()
  const { data: logs } = await supabase
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(300)

  // Attach reference numbers for any logs tied to a booking (two-step lookup —
  // simpler and safer than relying on a specific FK constraint name for an
  // embedded join).
  const bookingIds = Array.from(new Set((logs ?? []).map((l) => l.booking_id).filter(Boolean))) as string[]
  let refByBookingId: Record<string, string> = {}
  if (bookingIds.length > 0) {
    const { data: bookings } = await supabase
      .from('bookings')
      .select('id, reference_number')
      .in('id', bookingIds)
    refByBookingId = Object.fromEntries((bookings ?? []).map((b) => [b.id, b.reference_number]))
  }

  const enrichedLogs = (logs ?? []).map((l) => ({
    ...l,
    reference_number: l.booking_id ? refByBookingId[l.booking_id] ?? null : null,
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
