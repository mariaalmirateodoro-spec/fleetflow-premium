import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Topbar } from '@/components/layout/Topbar'
import { BookingsClient } from '@/components/bookings/BookingsClient'

export const metadata: Metadata = { title: 'Bookings' }

export default async function BookingsPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  const supabase = createClient()

  const [
    { data: bookings, error: bookingsError },
    { data: suppliers },
    { data: drivers },
    bareCheck,
    noFeedbackCheck,
  ] = await Promise.all([
    supabase
      .from('bookings')
      .select('*, profiles!bookings_created_by_fkey(full_name), suppliers(company_name), drivers(id,full_name,phone,license_number), feedback(rating,comment)')
      .order('created_at', { ascending: false }),
    supabase.from('suppliers').select('*').eq('is_available', true).order('company_name'),
    supabase.from('drivers').select('*').order('full_name'),
    // Temporary diagnostic: bare query, zero joins.
    supabase.from('bookings').select('id', { count: 'exact', head: true }),
    // Temporary diagnostic: all the same joins EXCEPT feedback.
    supabase
      .from('bookings')
      .select('id, profiles!bookings_created_by_fkey(full_name), suppliers(company_name), drivers(id,full_name,phone,license_number)', { count: 'exact' }),
  ])

  if (bookingsError) {
    console.error('[bookings/page] query failed:', bookingsError)
  }
  console.error('[bookings/page] diagnostic counts:', {
    fullJoinedRowCount: bookings?.length ?? null,
    bareRowCount: bareCheck.count,
    bareError: bareCheck.error,
    noFeedbackRowCount: noFeedbackCheck.count,
    noFeedbackError: noFeedbackCheck.error,
  })

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar profile={profile} title="Bookings" subtitle="Manage all guest transport requests" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs font-mono whitespace-pre-wrap">
          <p className="font-sans font-semibold text-amber-100 mb-1">Temporary diagnostic (remove once resolved):</p>
          {JSON.stringify(
            {
              fullJoinedRowCount: bookings?.length ?? null,
              bookingsError,
              bareRowCount: bareCheck.count,
              bareError: bareCheck.error,
              noFeedbackRowCount: noFeedbackCheck.count,
              noFeedbackError: noFeedbackCheck.error,
            },
            null,
            2
          )}
        </div>
        <BookingsClient
          initialBookings={bookings ?? []}
          suppliers={suppliers ?? []}
          drivers={drivers ?? []}
          profile={profile}
        />
      </div>
    </div>
  )
}
