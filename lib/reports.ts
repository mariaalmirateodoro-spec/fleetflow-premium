import { createClient } from '@supabase/supabase-js'

// Shared report-generation logic — used by the scheduled cron
// (app/api/cron/generate-reports), the manual "Regenerate now" button
// (app/api/reports/regenerate), and as a same-request fallback in
// app/(dashboard)/reports/page.tsx if the cache is empty. Keeping this in
// one place means the Reports page can read a pre-computed JSON blob from
// the (previously unused) reports_cache table instead of re-scanning and
// re-aggregating the entire bookings table on every page load.

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export interface DashboardReportData {
  monthlyData: { month: string; bookings: number; spend: number }[]
  topSuppliers: { name: string; bookings: number; revenue: number; rating: number }[]
  savingsData: { reference_number: string; budget: number; actual: number; savings: number }[]
  frequentRoutes: { route: string; count: number }[]
  statusData: { status: string; count: number }[]
  driverStats: { name: string; trips: number; revenue: number }[]
  summary: { totalSpend: number; totalSavings: number; completedCount: number; cancelledCount: number; totalBookings: number }
}

export async function computeDashboardReports(): Promise<DashboardReportData> {
  const supabase = adminClient()

  const [{ data: bookings }, { data: suppliers }, { data: drivers }] = await Promise.all([
    supabase.from('bookings').select('*').order('created_at', { ascending: true }),
    supabase.from('suppliers').select('*'),
    supabase.from('drivers').select('id, full_name'),
  ])

  const allBookings = bookings ?? []
  const allSuppliers = suppliers ?? []
  const allDrivers = drivers ?? []

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
      reference_number: b.reference_number,
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

  // Driver utilization
  const driverMap: Record<string, { name: string; trips: number; revenue: number }> = {}
  allBookings.forEach((b) => {
    if (b.driver_id) {
      const driver = allDrivers.find((d) => d.id === b.driver_id)
      if (!driverMap[b.driver_id]) {
        driverMap[b.driver_id] = { name: driver?.full_name ?? 'Unknown', trips: 0, revenue: 0 }
      }
      driverMap[b.driver_id].trips++
      driverMap[b.driver_id].revenue += b.final_cost_usd ?? b.budget_usd ?? 0
    }
  })
  const driverStats = Object.values(driverMap)
    .sort((a, b) => b.trips - a.trips)
    .slice(0, 10)
    .map((d) => ({ ...d, revenue: Math.round(d.revenue) }))

  const totalSpend = allBookings.reduce((s, b) => s + (b.final_cost_usd ?? b.budget_usd ?? 0), 0)
  const totalSavings = savingsData.reduce((s, d) => s + d.savings, 0)
  const completedCount = allBookings.filter((b) => b.status === 'completed').length
  const cancelledCount = allBookings.filter((b) => b.status === 'cancelled').length

  return {
    monthlyData,
    topSuppliers,
    savingsData,
    frequentRoutes,
    statusData,
    driverStats,
    summary: { totalSpend: Math.round(totalSpend), totalSavings: Math.round(totalSavings), completedCount, cancelledCount, totalBookings: allBookings.length },
  }
}

const REPORT_KEY = 'dashboard-reports'
const CACHE_LIFETIME_MS = 26 * 60 * 60 * 1000 // a bit over a day, so a missed cron run doesn't blank the page

export async function generateReports(): Promise<{ data: DashboardReportData; generatedAt: string }> {
  const supabase = adminClient()
  const data = await computeDashboardReports()
  const generatedAt = new Date().toISOString()

  const { error } = await supabase.from('reports_cache').upsert(
    {
      report_key: REPORT_KEY,
      data,
      generated_at: generatedAt,
      expires_at: new Date(Date.now() + CACHE_LIFETIME_MS).toISOString(),
    },
    { onConflict: 'report_key' }
  )
  if (error) throw error

  return { data, generatedAt }
}

export async function getCachedReports(): Promise<{ data: DashboardReportData; generatedAt: string } | null> {
  const supabase = adminClient()
  const { data: row } = await supabase
    .from('reports_cache')
    .select('data, generated_at')
    .eq('report_key', REPORT_KEY)
    .maybeSingle()

  if (!row) return null
  return { data: row.data as DashboardReportData, generatedAt: row.generated_at as string }
}
