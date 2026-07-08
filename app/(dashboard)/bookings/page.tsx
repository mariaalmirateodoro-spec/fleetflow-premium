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

  // `feedback` is deliberately NOT embedded via PostgREST's `feedback(...)`
  // join syntax here. That relationship has twice gone "missing from the
  // schema cache" in production (Supabase's API layer losing track of the
  // feedback -> bookings foreign key after unrelated project maintenance,
  // even though the constraint verifiably still exists in the database),
  // silently zeroing out this ENTIRE query both times. Fetching feedback as
  // a separate plain query and merging it in JS below has no dependency on
  // PostgREST's relationship cache, so it can't be taken down by this again.
  const [{ data: bookings, error: bookingsError }, { data: suppliers }, { data: drivers }, { data: feedbackRows }] =
    await Promise.all([
      supabase
        .from('bookings')
        .select('*, profiles!bookings_created_by_fkey(full_name), suppliers(company_name), drivers(id,full_name,phone,license_number)')
        .order('created_at', { ascending: false }),
      supabase.from('suppliers').select('*').eq('is_available', true).order('company_name'),
      supabase.from('drivers').select('*').order('full_name'),
      supabase.from('feedback').select('booking_id, rating, comment'),
    ])

  if (bookingsError) {
    console.error('[bookings/page] query failed:', bookingsError)
  }

  const feedbackByBooking = new Map<string, { rating: number; comment: string | null }[]>()
  ;(feedbackRows ?? []).forEach((f) => {
    const list = feedbackByBooking.get(f.booking_id) ?? []
    list.push({ rating: f.rating, comment: f.comment })
    feedbackByBooking.set(f.booking_id, list)
  })

  const bookingsWithFeedback = (bookings ?? []).map((b) => ({
    ...b,
    feedback: feedbackByBooking.get(b.id) ?? [],
  }))

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar profile={profile} title="Bookings" subtitle="Manage all guest transport requests" />
      <div className="flex-1 overflow-y-auto p-6">
        <BookingsClient
          initialBookings={bookingsWithFeedback}
          suppliers={suppliers ?? []}
          drivers={drivers ?? []}
          profile={profile}
        />
      </div>
    </div>
  )
}
