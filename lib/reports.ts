import { eq } from 'drizzle-orm'
import { db, schema } from '@/lib/db'

// Shared report-generation logic — used by the scheduled cron
// (app/api/cron/generate-reports), the manual "Regenerate now" button
// (app/api/reports/regenerate), and as a same-request fallback in
// app/(dashboard)/reports/page.tsx if the cache is empty. Keeping this in
// one place means the Reports page can read a pre-computed JSON blob from
// the (previously unused) reports_cache table instead of re-scanning and
// re-aggregating the entire bookings table on every page load.
//
// Talks directly to Postgres via Drizzle instead of PostgREST.

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
  const [bookings, suppliers, drivers] = await Promise.all([
    db.select().from(schema.bookings).orderBy(schema.bookings.createdAt),
    db.select().from(schema.suppliers),
    db.select({ id: schema.drivers.id, fullName: schema.drivers.fullName }).from(schema.drivers),
  ])

  const allBookings = bookings
  const allSuppliers = suppliers
  const allDrivers = drivers

  const costOf = (b: typeof allBookings[number]) =>
    b.finalCostUsd != null ? Number(b.finalCostUsd) : b.budgetUsd != null ? Number(b.budgetUsd) : 0

  // Monthly bookings & spend (last 12 months)
  const monthlyMap: Record<string, { bookings: number; spend: number }> = {}
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = d.toLocaleString('default', { month: 'short', year: '2-digit' })
    monthlyMap[key] = { bookings: 0, spend: 0 }
  }
  allBookings.forEach((b) => {
    const d = new Date(b.createdAt)
    const key = d.toLocaleString('default', { month: 'short', year: '2-digit' })
    if (key in monthlyMap) {
      monthlyMap[key].bookings++
      monthlyMap[key].spend += costOf(b)
    }
  })
  const monthlyData = Object.entries(monthlyMap).map(([month, data]) => ({ month, ...data, spend: Math.round(data.spend) }))

  // Top suppliers
  const supplierBookingCount: Record<string, { name: string; bookings: number; revenue: number; rating: number }> = {}
  allBookings.forEach((b) => {
    if (b.assignedSupplier) {
      const s = allSuppliers.find((sup) => sup.id === b.assignedSupplier)
      if (!supplierBookingCount[b.assignedSupplier]) {
        supplierBookingCount[b.assignedSupplier] = {
          name: s?.companyName ?? 'Unknown',
          bookings: 0,
          revenue: 0,
          rating: s?.rating != null ? Number(s.rating) : 0,
        }
      }
      supplierBookingCount[b.assignedSupplier].bookings++
      supplierBookingCount[b.assignedSupplier].revenue += costOf(b)
    }
  })
  const topSuppliers = Object.values(supplierBookingCount)
    .sort((a, b) => b.bookings - a.bookings)
    .slice(0, 8)
    .map((s) => ({ ...s, revenue: Math.round(s.revenue) }))

  // Cost savings (budget vs actual)
  const savingsData = allBookings
    .filter((b) => b.budgetUsd != null && b.finalCostUsd != null && b.status === 'completed')
    .map((b) => {
      const budget = Number(b.budgetUsd)
      const actual = Number(b.finalCostUsd)
      return {
        reference_number: b.referenceNumber,
        budget,
        actual,
        savings: budget - actual,
      }
    })
    .slice(-10)

  // Frequent routes
  const routeMap: Record<string, number> = {}
  allBookings.forEach((b) => {
    const key = `${b.pickupLocation} → ${b.dropoffLocation}`
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
    if (b.driverId) {
      const driver = allDrivers.find((d) => d.id === b.driverId)
      if (!driverMap[b.driverId]) {
        driverMap[b.driverId] = { name: driver?.fullName ?? 'Unknown', trips: 0, revenue: 0 }
      }
      driverMap[b.driverId].trips++
      driverMap[b.driverId].revenue += costOf(b)
    }
  })
  const driverStats = Object.values(driverMap)
    .sort((a, b) => b.trips - a.trips)
    .slice(0, 10)
    .map((d) => ({ ...d, revenue: Math.round(d.revenue) }))

  const totalSpend = allBookings.reduce((s, b) => s + costOf(b), 0)
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
  const data = await computeDashboardReports()
  const generatedAt = new Date().toISOString()

  await db
    .insert(schema.reportsCache)
    .values({
      reportKey: REPORT_KEY,
      data,
      generatedAt,
      expiresAt: new Date(Date.now() + CACHE_LIFETIME_MS).toISOString(),
    })
    .onConflictDoUpdate({
      target: schema.reportsCache.reportKey,
      set: {
        data,
        generatedAt,
        expiresAt: new Date(Date.now() + CACHE_LIFETIME_MS).toISOString(),
      },
    })

  return { data, generatedAt }
}

export async function getCachedReports(): Promise<{ data: DashboardReportData; generatedAt: string } | null> {
  const [row] = await db
    .select({ data: schema.reportsCache.data, generatedAt: schema.reportsCache.generatedAt })
    .from(schema.reportsCache)
    .where(eq(schema.reportsCache.reportKey, REPORT_KEY))
    .limit(1)

  if (!row) return null
  return { data: row.data as DashboardReportData, generatedAt: row.generatedAt }
}
