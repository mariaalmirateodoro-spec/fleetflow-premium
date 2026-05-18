import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient, getProfile } from '@/lib/supabase/server'
import { Topbar } from '@/components/layout/Topbar'
import { DriversClient } from '@/components/drivers/DriversClient'

export const metadata: Metadata = { title: 'Drivers' }

export default async function DriversPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  // Only admin, staff, and manager can access this page
  if (!['admin', 'staff', 'manager'].includes(profile.role)) redirect('/dashboard')

  const supabase = createClient()

  const [{ data: drivers }, { data: suppliers }] = await Promise.all([
    supabase
      .from('drivers')
      .select('*, suppliers(company_name)')
      .order('full_name'),
    supabase
      .from('suppliers')
      .select('id, company_name')
      .eq('is_available', true)
      .order('company_name'),
  ])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar
        profile={profile}
        title="Drivers"
        subtitle="Manage drivers and availability"
      />
      <div className="flex-1 overflow-y-auto p-6">
        <DriversClient
          initialDrivers={drivers ?? []}
          suppliers={suppliers ?? []}
          profile={profile}
        />
      </div>
    </div>
  )
}
