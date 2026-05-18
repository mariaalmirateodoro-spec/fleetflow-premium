import { Suspense } from 'react'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Topbar } from '@/components/layout/Topbar'
import { DashboardContent } from '@/components/dashboard/DashboardContent'
import { PageLoader } from '@/components/ui/LoadingSpinner'

export const metadata: Metadata = { title: 'Dashboard' }

async function getDashboardData() {
  const supabase = createClient()

  const [
    { data: bookings, count: totalBookings },
    { data: pending },
    { data: suppliers, count: supplierCount },
    { data: upcoming },
    { data: recentBookings },
    { data: monthlyData },
    { count: availableDriverCount },
    { count: needsDriverCount },
  ] = await Promise.all([
    supabase.from('bookings').select('*', { count: 'exact' }).neq('status', 'cancelled'),
    supabase.from('bookings').select('id').eq('status', 'pending'),
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
    supabase
      .from('bookings')
      .select('final_cost_usd, budget_usd, created_at, status')
      .neq('status', 'cancelled'),
    supabase.from('drivers').select('id', { count: 'exact' }).eq('is_available', true),
    supabase
      .from('bookings')
      .select('id', { count: 'exact' })
      .eq('driver_required', true)
      .is('driver_id', null)
      .in('status', ['pending', 'quoted', 'approved']),
  ])

  // Compute monthly spend
  const monthlySpend: Record<string, number> = {}
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = d.toLocaleString('default', { month: 'short' })
    monthlySpend[key] = 0
  }

  ;(monthlyData ?? []).forEach((b) => {
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

  // Status breakdown
  const statusCounts: Record<string, number> = {}
  ;(bookings ?? []).forEach((b) => {
    statusCounts[b.status] = (statusCounts[b.status] ?? 0) + 1
  })

  return {
    totalBookings: totalBookings ?? 0,
    pendingCount: pending?.length ?? 0,
    monthlySpend: Math.round(totalSpend),
    supplierCount: supplierCount ?? 0,
    upcomingBookings: upcoming ?? [],
    recentBookings: recentBookings ?? [],
    monthlySpendData,
    statusCounts,
    quotedCount: (bookings ?? []).filter((b) => b.status === 'quoted').length,
    availableDriverCount: availableDriverCount ?? 0,
    needsDriverCount: needsDriverCount ?? 0,
  }
}

export default async function DashboardPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  const data = await getDashboardData()

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
