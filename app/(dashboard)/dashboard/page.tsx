import { Suspense } from 'react'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Topbar } from '@/components/layout/Topbar'
import { DashboardContent } from '@/components/dashboard/DashboardContent'
import { PageLoader } from '@/components/ui/LoadingSpinner'

export const metadata: Metadata = { title: 'Dashboard' }

// Trimmed from 8 separate round trips to Supabase down to 5: `pending`,
// `monthlyData`, and `needsDriverCount` were each re-querying data that the
// first `bookings` query (select('*') neq cancelled) already contains —
// now derived in JS from that single result instead of hitting the DB
// again for each one. The remaining queries (suppliers, upcoming w/ joins,
// recentBookings w/ joins, drivers) genuinely need their own trip since
// they're different tables or need joined columns the base query doesn't have.
async function getDashboardData() {
  const supabase = createClient()

  const [
    { data: bookings, count: totalBookings },
    { data: suppliers, count: supplierCount },
    { data: upcoming },
    { data: recentBookings },
    { count: availableDriverCount },
  ] = await Promise.all([
    supabase.from('bookings').select('*', { count: 'exact' }).neq('status', 'cancelled'),
    supabase.from('suppliers').select('*', { count: 'exact' }).eq('is_available', true),
    supabase
      .from('bookings')
      .select('*, suppliers(company_name)')
      .in('status', ['approved', 'quoted'])
      .gte('pickup_datetime', new Date().toISOString())
      .order('pickup_datetime', { ascending: true })
      .limit(5),
    supabase
      .from('bookings')
      .select('*, profiles!bookings_created_by_fkey(full_name), suppliers(company_name)')
      .order('created_at', { ascending: false })
      .limit(8),
    supabase.from('drivers').select('id', { count: 'exact' }).eq('is_available', true),
  ])

  // Compute monthly spend from the bookings we already fetched above,
  // instead of a separate `monthlyData` query for the same table.
  const monthlySpend: Record<string, number> = {}
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = d.toLocaleString('default', { month: 'short' })
    monthlySpend[key] = 0
  }

  ;(bookings ?? []).forEach((b) => {
    const d = new Date(b.created_at)
    const monthKey = d.toLocaleString('default', { month: 'short' })
    if (monthKey in monthlySpend) {
      monthlySpend[monthKey] += b.final_cost_usd ?? b.budget_usd ?? 0
    }
  })

  const monthlySpendData = Object.entries(monthlySpend).map(([month, amount]) => ({
    month,
    amount: Math.round(amount),
  }))

  const totalSpend = (bookings ?? []).reduce(
    (sum, b) => sum + (b.final_cost_usd ?? b.budget_usd ?? 0),
    0
  )

  // Status breakdown (also gives us pendingCount/quotedCount for free)
  const statusCounts: Record<string, number> = {}
  ;(bookings ?? []).forEach((b) => {
    statusCounts[b.status] = (statusCounts[b.status] ?? 0) + 1
  })

  const needsDriverCount = (bookings ?? []).filter(
    (b) =>
      b.driver_required &&
      !b.driver_id &&
      ['pending', 'quoted', 'approved'].includes(b.status)
  ).length

  return {
    totalBookings: totalBookings ?? 0,
    pendingCount: statusCounts.pending ?? 0,
    monthlySpend: Math.round(totalSpend),
    supplierCount: supplierCount ?? 0,
    upcomingBookings: upcoming ?? [],
    recentBookings: recentBookings ?? [],
    monthlySpendData,
    statusCounts,
    quotedCount: statusCounts.quoted ?? 0,
    availableDriverCount: availableDriverCount ?? 0,
    needsDriverCount,
  }
}

export default async function DashboardPage() {
  // Run in parallel instead of one after the other — the dashboard data
  // fetch doesn't actually depend on the profile, so there's no reason to
  // wait for the profile round trip to finish before starting it.
  const [profile, data] = await Promise.all([getProfile(), getDashboardData()])
  if (!profile) redirect('/login')

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar profile={profile} title="Dashboard" subtitle={`Welcome back, ${profile.full_name?.split(' ')[0] || 'there'} 👋`} />
      <div className="flex-1 overflow-y-auto">
        <Suspense fallback={<PageLoader />}>
          <DashboardContent data={data} profile={profile} />
        </Suspense>
      </div>
    </div>
  )
}
