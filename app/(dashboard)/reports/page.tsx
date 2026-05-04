import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Topbar } from '@/components/layout/Topbar'
import { ReportsContent } from '@/components/reports/ReportsContent'

export const metadata: Metadata = { title: 'Reports' }

export default async function ReportsPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')
  if (!['admin', 'finance', 'manager'].includes(profile.role)) redirect('/dashboard')

  const supabase = createClient()

  const [{ data: bookings }, { data: suppliers }] = await Promise.all([
    supabase.from('bookings').select('*').order('created_at', { ascending: true }),
    supabase.from('suppliers').select('*'),
  ])

  // Pre-compute report data server-side
  const allBookings = bookings ?? []
  const allSuppliers = suppliers ?? []

  // Monthly bookings & spend (last 12 months)
  const monthlyMap: Record<string, { bookings: number; spend: number }> = {}
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = d.toLocaleString('default', { month: 'short', year: '2-digit' })
    monthlyMap[key] = { bookings: 0, spend: 0 }
  }
  allBookings.forEach((b) => {
    const d = new Date(b.created_at)
    const key = d.toLocaleString('default', { month: 'short', year: '2-digit' })
    if (key in monthlyMap) {
      monthlyMap[key].bookings++
      monthlyMap[key].spend += b.final_cost_usd ?? b.budget_usd ?? 0
    }
  })
  const monthlyData = Object.entries(monthlyMap).map(([month, data]) => ({ month, ...data, spend: Math.round(data.spend) }))

  // Top suppliers
  const supplierBookingCount: Record<string, { name: string; bookings: number; revenue: number; rating: number }> = {}
  allBookings.forEach((b) => {
    if (b.assigned_supplier) {
      const s = allSuppliers.find((sup) => sup.id === b.assigned_supplier)
      if (!supplierBookingCount[b.assigned_supplier]) {
        supplierBookingCount[b.assigned_supplier] = { name: s?.company_name ?? 'Unknown', bookings: 0, revenue: 0, rating: s?.rating ?? 0 }
      }
      supplierBookingCount[b.assigned_supplier].bookings++
      supplierBookingCount[b.assigned_supplier].revenue += b.final_cost_usd ?? b.budget_usd ?? 0
    }
  })
  const topSuppliers = Object.values(supplierBookingCount)
    .sort((a, b) => b.bookings - a.bookings)
    .slice(0, 8)
    .map((s) => ({ ...s, revenue: Math.round(s.revenue) }))

  // Cost savings (budget vs actual)
  const savingsData = allBookings
    .filter((b) => b.budget_usd && b.final_cost_usd && b.status === 'completed')
    .map((b) => ({
      reference: b.reference,
      budget: b.budget_usd!,
      actual: b.final_cost_usd!,
      savings: b.budget_usd! - b.final_cost_usd!,
    }))
    .slice(-10)

  // Frequent routes
  const routeMap: Record<string, number> = {}
  allBookings.forEach((b) => {
    const key = `${b.pickup_location} → ${b.dropoff_location}`
    routeMap[key] = (routeMap[key] ?? 0) + 1
  })
  const frequentRoutes = Object.entries(routeMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([route, count]) => ({ route, count }))

  // Status breakdown
  const statusData = ['pending', 'quoted', 'approved', 'completed', 'cancelled'].map((s) => ({
    status: s,
    count: allBookings.filter((b) => b.status === s).length,
  }))

  const totalSpend = allBookings.reduce((s, b) => s + (b.final_cost_usd ?? b.budget_usd ?? 0), 0)
  const totalSavings = savingsData.reduce((s, d) => s + d.savings, 0)
  const completedCount = allBookings.filter((b) => b.status === 'completed').length
  const cancelledCount = allBookings.filter((b) => b.status === 'cancelled').length

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar profile={profile} title="Reports" subtitle="Analytics and financial overview" />
      <div className="flex-1 overflow-y-auto p-6">
        <ReportsContent
          monthlyData={monthlyData}
          topSuppliers={topSuppliers}
          savingsData={savingsData}
          frequentRoutes={frequentRoutes}
          statusData={statusData}
          summary={{ totalSpend: Math.round(totalSpend), totalSavings: Math.round(totalSavings), completedCount, cancelledCount, totalBookings: allBookings.length }}
        />
      </div>
    </div>
  )
}
