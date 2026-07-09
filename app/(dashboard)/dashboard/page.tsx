import { Suspense } from 'react'
import type { Metadata } from 'next'
import { and, asc, desc, eq, gte, inArray, ne } from 'drizzle-orm'
import { getProfile } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Topbar } from '@/components/layout/Topbar'
import { DashboardContent } from '@/components/dashboard/DashboardContent'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import { db, schema } from '@/lib/db'
import type { Booking } from '@/types'

export const metadata: Metadata = { title: 'Dashboard' }

// Trimmed from 8 separate round trips to Supabase down to 5: `pending`,
// `monthlyData`, and `needsDriverCount` were each re-querying data that the
// first `bookings` query (select('*') neq cancelled) already contains —
// now derived in JS from that single result instead of hitting the DB
// again for each one. The remaining queries (suppliers, upcoming w/ joins,
// recentBookings w/ joins, drivers) genuinely need their own trip since
// they're different tables or need joined columns the base query doesn't have.
//
// Now queries Postgres directly via Drizzle instead of PostgREST — same
// migration as the bookings list page. Result rows are reshaped back into
// the exact snake_case Booking shape DashboardContent.tsx already expects.
async function getDashboardData() {
  const now = new Date().toISOString()

  const [bookingRows, supplierRows, upcomingRows, recentRows, driverRows] = await Promise.all([
    db.select().from(schema.bookings).where(ne(schema.bookings.status, 'cancelled')),
    db.select({ id: schema.suppliers.id }).from(schema.suppliers).where(eq(schema.suppliers.isAvailable, true)),
    db
      .select({ b: schema.bookings, supplierCompanyName: schema.suppliers.companyName })
      .from(schema.bookings)
      .leftJoin(schema.suppliers, eq(schema.bookings.assignedSupplier, schema.suppliers.id))
      .where(
        and(
          inArray(schema.bookings.status, ['approved', 'quoted']),
          gte(schema.bookings.pickupDatetime, now)
        )
      )
      .orderBy(asc(schema.bookings.pickupDatetime))
      .limit(5),
    db
      .select({
        b: schema.bookings,
        creatorFullName: schema.profiles.fullName,
        supplierCompanyName: schema.suppliers.companyName,
      })
      .from(schema.bookings)
      .leftJoin(schema.profiles, eq(schema.bookings.createdBy, schema.profiles.id))
      .leftJoin(schema.suppliers, eq(schema.bookings.assignedSupplier, schema.suppliers.id))
      .orderBy(desc(schema.bookings.createdAt))
      .limit(8),
    db.select({ id: schema.drivers.id }).from(schema.drivers).where(eq(schema.drivers.isAvailable, true)),
  ])

  // Compute monthly spend from the bookings we already fetched above,
  // instead of a separate `monthlyData` query for the same table.
  const monthlySpend: Record<string, number> = {}
  const nowDate = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(nowDate.getFullYear(), nowDate.getMonth() - i, 1)
    const key = d.toLocaleString('default', { month: 'short' })
    monthlySpend[key] = 0
  }

  bookingRows.forEach((b) => {
    const d = new Date(b.createdAt)
    const monthKey = d.toLocaleString('default', { month: 'short' })
    const cost = b.finalCostUsd != null ? Number(b.finalCostUsd) : b.budgetUsd != null ? Number(b.budgetUsd) : 0
    if (monthKey in monthlySpend) {
      monthlySpend[monthKey] += cost
    }
  })

  const monthlySpendData = Object.entries(monthlySpend).map(([month, amount]) => ({
    month,
    amount: Math.round(amount),
  }))

  const totalSpend = bookingRows.reduce(
    (sum, b) => sum + (b.finalCostUsd != null ? Number(b.finalCostUsd) : b.budgetUsd != null ? Number(b.budgetUsd) : 0),
    0
  )

  // Status breakdown (also gives us pendingCount/quotedCount for free)
  const statusCounts: Record<string, number> = {}
  bookingRows.forEach((b) => {
    statusCounts[b.status] = (statusCounts[b.status] ?? 0) + 1
  })

  const needsDriverCount = bookingRows.filter(
    (b) =>
      b.driverRequired &&
      !b.driverId &&
      ['pending', 'quoted', 'approved'].includes(b.status)
  ).length

  // Reshaped to the exact snake_case shape DashboardContent.tsx expects (the
  // `Booking` type in types/index.ts) — only the fields actually rendered
  // there (guest_name, pickup/dropoff_location, pickup_datetime, status,
  // reference_number, profiles.full_name, vehicle_type) are populated with
  // real values; the rest follow the same reshape as the bookings list page.
  const reshapeBooking = (b: typeof schema.bookings.$inferSelect, creatorFullName?: string | null, supplierCompanyName?: string | null) => ({
    id: b.id,
    reference_number: b.referenceNumber,
    guest_name: b.guestName,
    guest_nationality: b.guestNationality,
    guest_count: b.guestCount,
    guest_phone: b.guestPhone,
    guest_email: b.guestEmail,
    guest_line_id: b.guestLineId,
    pickup_datetime: b.pickupDatetime,
    dropoff_datetime: b.dropoffDatetime,
    pickup_location: b.pickupLocation,
    dropoff_location: b.dropoffLocation,
    vehicle_type: b.vehicleType,
    driver_required: b.driverRequired,
    driver_id: b.driverId,
    vehicle_plate: b.vehiclePlate,
    vehicle_model: b.vehicleModel,
    budget_usd: b.budgetUsd != null ? Number(b.budgetUsd) : null,
    final_cost_usd: b.finalCostUsd != null ? Number(b.finalCostUsd) : null,
    status: b.status,
    notes: b.notes,
    special_requests: b.specialRequests,
    assigned_supplier: b.assignedSupplier,
    created_by: b.createdBy,
    approved_by: b.approvedBy,
    approved_at: b.approvedAt,
    completed_at: b.completedAt,
    cancelled_at: b.cancelledAt,
    cancellation_reason: b.cancellationReason,
    created_at: b.createdAt,
    updated_at: b.updatedAt,
    is_draft: b.isDraft,
    modification_status: b.modificationStatus,
    modification_pickup_datetime: b.modificationPickupDatetime,
    modification_pickup_location: b.modificationPickupLocation,
    modification_dropoff_location: b.modificationDropoffLocation,
    modification_notes: b.modificationNotes,
    modification_requested_at: b.modificationRequestedAt,
    profiles: creatorFullName != null ? { full_name: creatorFullName } : undefined,
    suppliers: supplierCompanyName != null ? { company_name: supplierCompanyName } : undefined,
  })

  return {
    totalBookings: bookingRows.length,
    pendingCount: statusCounts.pending ?? 0,
    monthlySpend: Math.round(totalSpend),
    supplierCount: supplierRows.length,
    // Cast rather than coerce nullable DB values to satisfy the (never
    // actually enforced pre-migration) Booking type — same rationale as the
    // bookings list page migration.
    upcomingBookings: upcomingRows.map(({ b, supplierCompanyName }) => reshapeBooking(b, undefined, supplierCompanyName)) as unknown as Booking[],
    recentBookings: recentRows.map(({ b, creatorFullName, supplierCompanyName }) => reshapeBooking(b, creatorFullName, supplierCompanyName)) as unknown as Booking[],
    monthlySpendData,
    statusCounts,
    quotedCount: statusCounts.quoted ?? 0,
    availableDriverCount: driverRows.length,
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
