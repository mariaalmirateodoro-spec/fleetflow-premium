import type { Metadata } from 'next'
import { desc, eq } from 'drizzle-orm'
import { getProfile } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Topbar } from '@/components/layout/Topbar'
import { BookingsClient } from '@/components/bookings/BookingsClient'
import { db, schema } from '@/lib/db'
import type { Booking, Supplier, Driver } from '@/types'

export const metadata: Metadata = { title: 'Bookings' }

// This page used to fetch via supabase-js/PostgREST with a `feedback` embed
// join, but that specific relationship repeatedly went "missing from the
// schema cache" in production (ticket SU-415685), silently zeroing out this
// entire page's data both times, even though the FK provably existed in the
// DB. It was worked around by fetching feedback as a separate plain query
// and merging in JS. Now that this page queries Postgres directly via
// Drizzle (see lib/db), the join is done for real again (profiles/
// suppliers/drivers, via leftJoin below) — feedback is still fetched
// separately and merged in JS purely because it's a one-to-many relation
// (a booking can have more than one feedback row) that doesn't fit cleanly
// into one flat joined row, not because of any lingering cache-bug concern.
export default async function BookingsPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  const [bookingRows, supplierRows, driverRows, feedbackRows] = await Promise.all([
    db
      .select({
        b: schema.bookings,
        creatorFullName: schema.profiles.fullName,
        supplierCompanyName: schema.suppliers.companyName,
        driver: {
          id: schema.drivers.id,
          fullName: schema.drivers.fullName,
          phone: schema.drivers.phone,
          licenseNumber: schema.drivers.licenseNumber,
        },
      })
      .from(schema.bookings)
      .leftJoin(schema.profiles, eq(schema.bookings.createdBy, schema.profiles.id))
      .leftJoin(schema.suppliers, eq(schema.bookings.assignedSupplier, schema.suppliers.id))
      .leftJoin(schema.drivers, eq(schema.bookings.driverId, schema.drivers.id))
      .orderBy(desc(schema.bookings.createdAt)),
    db.select().from(schema.suppliers).where(eq(schema.suppliers.isAvailable, true)).orderBy(schema.suppliers.companyName),
    db.select().from(schema.drivers).orderBy(schema.drivers.fullName),
    db.select({ bookingId: schema.feedback.bookingId, rating: schema.feedback.rating, comment: schema.feedback.comment }).from(schema.feedback),
  ])

  const feedbackByBooking = new Map<string, { rating: number; comment: string | null }[]>()
  feedbackRows.forEach((f) => {
    const list = feedbackByBooking.get(f.bookingId) ?? []
    list.push({ rating: f.rating, comment: f.comment })
    feedbackByBooking.set(f.bookingId, list)
  })

  // Reshaped to the exact snake_case shape components/bookings/BookingsClient.tsx
  // and the rest of the dashboard already expect (the `Booking` type in
  // types/index.ts) — so this migration only changes how the data is
  // fetched, not any frontend code. Values are kept as their real nullable
  // DB value (not coerced to '' etc.) to match exactly what the old
  // supabase-js query returned — that query was untyped (`any`), so the
  // `Booking` type was never actually enforced against the real shape here;
  // the cast below preserves that same (pre-existing) looseness rather than
  // silently changing runtime values (e.g. null pickup_datetime on a draft)
  // to satisfy stricter typing.
  const bookingsWithFeedback = bookingRows.map(({ b, creatorFullName, supplierCompanyName, driver }) => ({
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
    // Original embed (`profiles!bookings_created_by_fkey(full_name)`) only
    // ever selected full_name too, not the full Profile shape.
    profiles: creatorFullName != null ? { full_name: creatorFullName } : undefined,
    // Original embed only selected company_name too.
    suppliers: supplierCompanyName != null ? { company_name: supplierCompanyName } : undefined,
    drivers: driver && driver.id != null
      ? { id: driver.id, full_name: driver.fullName, phone: driver.phone, license_number: driver.licenseNumber }
      : undefined,
    feedback: feedbackByBooking.get(b.id) ?? [],
  })) as unknown as Booking[]

  const suppliers: Supplier[] = supplierRows.map((s) => ({
    id: s.id,
    company_name: s.companyName,
    contact_person: s.contactPerson,
    phone: s.phone,
    email: s.email,
    address: s.address,
    vehicle_types: s.vehicleTypes,
    base_rate_usd: s.baseRateUsd != null ? Number(s.baseRateUsd) : null,
    rating: s.rating != null ? Number(s.rating) : 0,
    total_bookings: s.totalBookings,
    is_available: s.isAvailable,
    is_preferred: s.isPreferred,
    notes: s.notes,
    created_by: s.createdBy,
    created_at: s.createdAt,
    updated_at: s.updatedAt,
  }))

  const drivers: Driver[] = driverRows.map((d) => ({
    id: d.id,
    full_name: d.fullName,
    phone: d.phone,
    license_number: d.licenseNumber,
    license_expiry: d.licenseExpiry,
    vehicle_types: d.vehicleTypes,
    is_available: d.isAvailable,
    assigned_supplier_id: d.assignedSupplierId,
    notes: d.notes,
    created_by: d.createdBy,
    created_at: d.createdAt,
    updated_at: d.updatedAt,
  }))

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar profile={profile} title="Bookings" subtitle="Manage all guest transport requests" />
      <div className="flex-1 overflow-y-auto p-6">
        <BookingsClient
          initialBookings={bookingsWithFeedback}
          suppliers={suppliers}
          drivers={drivers}
          profile={profile}
        />
      </div>
    </div>
  )
}
