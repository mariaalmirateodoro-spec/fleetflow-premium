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

  const [{ data: bookings, error: bookingsError }, { data: suppliers }, { data: drivers }] = await Promise.all([
    supabase
      .from('bookings')
      .select('*, profiles!bookings_created_by_fkey(full_name), suppliers(company_name), drivers(id,full_name,phone,license_number), feedback(rating,comment)')
      .order('created_at', { ascending: false }),
    supabase.from('suppliers').select('*').eq('is_available', true).order('company_name'),
    supabase.from('drivers').select('*').order('full_name'),
  ])

  // Temporary diagnostic: this query previously failed silently (data ?? []
  // swallowed whatever the real error was, showing a misleading "No bookings
  // found" empty state instead of surfacing the actual problem). Logging
  // server-side (visible in Vercel's function logs) and rendering it inline
  // so it's visible without needing Vercel dashboard access.
  if (bookingsError) {
    console.error('[bookings/page] query failed:', bookingsError)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar profile={profile} title="Bookings" subtitle="Manage all guest transport requests" />
      <div className="flex-1 overflow-y-auto p-6">
        {bookingsError && (
          <div className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm font-mono whitespace-pre-wrap">
            <p className="font-sans font-semibold text-red-200 mb-1">Bookings query failed — this banner is temporary, for diagnosis:</p>
            {JSON.stringify(bookingsError, null, 2)}
          </div>
        )}
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
