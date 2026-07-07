import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Topbar } from '@/components/layout/Topbar'
import { ApprovalsClient } from '@/components/approvals/ApprovalsClient'

export const metadata: Metadata = { title: 'Approvals' }

export default async function ApprovalsPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')
  if (!['admin', 'manager'].includes(profile.role)) redirect('/dashboard')

  const supabase = createClient()
  const { data: bookings } = await supabase
    .from('bookings')
    .select('*, profiles!bookings_created_by_fkey(full_name), suppliers(company_name), quotes(*, suppliers(company_name,rating))')
    .in('status', ['quoted', 'pending'])
    .order('created_at', { ascending: true })

  // Embeds by column name (reviewer_id), not by guessing the generated FK
  // constraint name — the approvals table only has reviewer_id (no
  // approved_by column exists), so the old constraint-name reference here
  // never matched anything and this query silently returned nothing every
  // time, even when approvals existed.
  const { data: recentApprovals } = await supabase
    .from('approvals')
    .select('*, profiles!reviewer_id(full_name), bookings(reference_number, guest_name)')
    .order('created_at', { ascending: false })
    .limit(10)

  const { data: suppliers } = await supabase
    .from('suppliers')
    .select('id, company_name, contact_person, phone, rating')
    .eq('is_available', true)
    .order('company_name', { ascending: true })

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar profile={profile} title="Approvals" subtitle="Review and approve booking requests" />
      <div className="flex-1 overflow-y-auto p-6">
        <ApprovalsClient
          pendingBookings={bookings ?? []}
          recentApprovals={recentApprovals ?? []}
          profile={profile}
          suppliers={suppliers ?? []}
        />
      </div>
    </div>
  )
}
