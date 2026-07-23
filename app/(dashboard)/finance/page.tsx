import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getProfile, createClient } from '@/lib/supabase/server'
import { Topbar } from '@/components/layout/Topbar'
import { FinanceClient } from '@/components/finance/FinanceClient'

export const metadata: Metadata = { title: 'Finance' }

export default async function FinancePage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')
  if (!['admin', 'finance'].includes(profile.role)) redirect('/dashboard')

  const supabase = createClient()

  const { data: bookings } = await supabase
    .from('bookings')
    .select(`
      id, reference_number, guest_name, pickup_datetime, dropoff_datetime,
      pickup_location, dropoff_location, vehicle_type,
      budget_usd, final_cost_usd, status,
      payment_status, payment_amount, paid_at, payment_notes,
      created_at, updated_at,
      profiles!bookings_created_by_fkey(full_name),
      suppliers(company_name)
    `)
    .in('status', ['approved', 'completed'])
    .order('pickup_datetime', { ascending: false })

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar
        profile={profile}
        title="Finance"
        subtitle="Track payments for approved and completed bookings"
      />
      <div className="flex-1 overflow-y-auto p-6">
        <FinanceClient
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          initialBookings={(bookings ?? []) as any}
          profile={profile}
        />
      </div>
    </div>
  )
}
