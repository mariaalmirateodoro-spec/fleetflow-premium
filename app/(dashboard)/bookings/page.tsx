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

  const [{ data: bookings }, { data: suppliers }, { data: drivers }] = await Promise.all([
    supabase
      .from('bookings')
      .select('*, profiles!bookings_created_by_fkey(full_name,email), suppliers(company_name), drivers(id,full_name,phone,license_number)')
      .order('created_at', { ascending: false }),
    supabase.from('suppliers').select('*').eq('is_available', true).order('company_name'),
    supabase.from('drivers').select('id,full_name,phone,license_number,vehicle_types,is_available,assigned_supplier_id').order('full_name'),
  ])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar profile={profile} title="Bookings" subtitle="Manage all guest transport requests" />
      <div className="flex-1 overflow-y-auto p-6">
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
