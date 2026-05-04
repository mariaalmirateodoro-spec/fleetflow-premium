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
    .select('*, profiles!bookings_created_by_fkey(full_name,email), suppliers(company_name), quotes(*, suppliers(company_name,rating))')
    .in('status', ['quoted', 'pending'])
    .order('created_at', { ascending: true })

  const { data: recentApprovals } = await supabase
    .from('approvals')
    .select('*, profiles!approvals_reviewer_id_fkey(full_name), bookings(reference, guest_name)')
    .order('created_at', { ascending: false })
    .limit(10)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar profile={profile} title="Approvals" subtitle="Review and approve booking requests" />
      <div className="flex-1 overflow-y-auto p-6">
        <ApprovalsClient
          pendingBookings={bookings ?? []}
          recentApprovals={recentApprovals ?? []}
          profile={profile}
        />
      </div>
    </div>
  )
}
