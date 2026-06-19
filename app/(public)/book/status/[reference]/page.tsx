import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Metadata } from 'next'
import type { Booking, BookingStatus } from '@/types'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import ModificationRequestModal from '@/components/bookings/ModificationRequestModal'

function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// ─── Metadata ────────────────────────────────────────────────
export async function generateMetadata({
  params,
}: {
  params: { reference: string }
}): Promise<Metadata> {
  return {
    title: `Booking ${params.reference} | FleetFlow Premium`,
  }
}

// ─── Helpers ─────────────────────────────────────────────────

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-PH', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Manila',
  })
}

function formatVehicle(v: string) {
  const map: Record<string, string> = {
    sedan: 'Sedan',
    suv: 'SUV',
    van: 'Van',
    minibus: 'Minibus',
    luxury: 'Luxury',
    pickup: 'Pickup Truck',
  }
  return map[v] ?? v
}

// ─── Status config ────────────────────────────────────────────

type StatusConfig = {
  label: string
  emoji: string
  badgeCls: string
  headline: string
  body: string
}

function getStatusConfig(booking: Booking): StatusConfig {
  switch (booking.status) {
    case 'pending':
      return {
        label: 'Under Review',
        emoji: '⏳',
        badgeCls: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
        headline: 'Your request is being reviewed',
        body: 'Our team has received your booking and is checking vehicle availability. We typically respond within 1 hour during business hours.',
      }
    case 'quoted':
      return {
        label: 'Quote Sent',
        emoji: '📋',
        badgeCls: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
        headline: 'A quote has been prepared',
        body: 'Our team has reviewed your request and sent a quote. Please check your email or contact us to confirm.',
      }
    case 'approved':
      return {
        label: 'Confirmed',
        emoji: '✅',
        badgeCls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
        headline: 'Your booking is confirmed!',
        body: 'Great news — your booking has been approved. Your vehicle and driver will be ready at the pickup location on time.',
      }
    case 'completed':
      return {
        label: 'Completed',
        emoji: '🏁',
        badgeCls: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
        headline: 'Trip completed',
        body: 'Your trip has been completed. Thank you for choosing FleetFlow Premium. We hope to serve you again soon!',
      }
    case 'cancelled':
      return {
        label: 'Cancelled',
        emoji: '✖',
        badgeCls: 'bg-red-500/15 text-red-300 border-red-500/30',
        headline: 'Booking cancelled',
        body: booking.cancellation_reason
          ? `This booking was cancelled. Reason: ${booking.cancellation_reason}`
          : 'This booking has been cancelled. Please contact us if you have any questions.',
      }
    default:
      return {
        label: booking.status,
        emoji: '📄',
        badgeCls: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
        headline: 'Booking status',
        body: 'Please contact our team for more details about your booking.',
      }
  }
}

// ─── Timeline steps ───────────────────────────────────────────

type Step = { label: string; done: boolean; active: boolean; time?: string | null }

function buildTimeline(booking: Booking): Step[] {
  const order: BookingStatus[] = ['pending', 'quoted', 'approved', 'completed']
  const cancelled = booking.status === 'cancelled'
  const currentIdx = order.indexOf(booking.status as BookingStatus)

  if (cancelled) {
    return [
      { label: 'Request submitted', done: true, active: false, time: booking.created_at },
      { label: 'Booking cancelled', done: true, active: true, time: booking.cancelled_at },
    ]
  }

  return [
    { label: 'Request submitted', done: true, active: currentIdx === 0, time: booking.created_at },
    {
      label: 'Quote / review',
      done: currentIdx >= 1,
      active: currentIdx === 1,
      time: null,
    },
    {
      label: 'Booking confirmed',
      done: currentIdx >= 2,
      active: currentIdx === 2,
      time: booking.approved_at,
    },
    {
      label: 'Trip completed',
      done: currentIdx >= 3,
      active: currentIdx === 3,
      time: booking.completed_at,
    },
  ]
}

// ─── Page ─────────────────────────────────────────────────────

export default async function BookingStatusPage({
  params,
}: {
  params: { reference: string }
}) {
  const supabase = createClient()

  const { data: booking, error } = await supabase
    .from('bookings')
    .select('*, suppliers(company_name, contact_person, phone)')
    .eq('reference_number', params.reference.toUpperCase())
    .single()

  if (error || !booking) notFound()

  // Use admin client to bypass RLS for drivers + approvals (anon key can't read these tables)
  const admin = createAdminClient()

  // Auto-complete: if booking is approved and pickup time has already passed, mark it completed
  if (booking.status === 'approved' && booking.pickup_datetime && new Date(booking.pickup_datetime) < new Date()) {
    await admin
      .from('bookings')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', booking.id)
    booking.status = 'completed'
  }

  // Fetch assigned driver
  const driverData = booking.driver_id
    ? await admin
        .from('drivers')
        .select('full_name, phone')
        .eq('id', booking.driver_id)
        .single()
        .then((r) => r.data as { full_name: string; phone: string | null } | null)
    : null

  // Fetch approval notes
  const { data: approvalRecords } = await admin
    .from('approvals')
    .select('action, comments, created_at')
    .eq('booking_id', booking.id)
    .eq('action', 'approved')
    .not('comments', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)

  const approvalNotes = approvalRecords?.[0]?.comments ?? null

  const cfg = getStatusConfig(booking as Booking)
  const timeline = buildTimeline(booking as Booking)

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-6 py-20">
      <div className="max-w-xl w-full space-y-6">

        {/* Header card */}
        <div className="rounded-2xl border border-white/8 bg-white/3 p-7 text-center">
          <p className="text-slate-500 text-xs uppercase tracking-widest font-medium mb-1">
            Reference number
          </p>
          <p className="font-display font-bold text-2xl text-fleet-300 tracking-wider mb-5">
            {booking.reference_number}
          </p>

          {/* Status badge */}
          <span
            className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-sm font-semibold ${cfg.badgeCls}`}
          >
            <span>{cfg.emoji}</span>
            {cfg.label}
          </span>

          <h1 className="font-display font-extrabold text-xl text-white mt-5 mb-2">
            {cfg.headline}
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed">{cfg.body}</p>

          {/* Final cost — show if approved/completed */}
          {(booking.status === 'approved' || booking.status === 'completed') &&
            booking.final_cost_usd && (
              <div className="mt-5 inline-flex flex-col items-center gap-0.5 px-6 py-3 rounded-xl bg-fleet-500/10 border border-fleet-500/20">
                <span className="text-xs text-slate-400 uppercase tracking-widest">
                  Total cost
                </span>
                <span className="font-display font-bold text-2xl text-fleet-300">
                  PHP {booking.final_cost_usd.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
        </div>

        {/* Notes from our team — show when approval comments exist */}
        {approvalNotes && (
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-amber-400 text-base">📝</span>
              <h2 className="font-semibold text-amber-300 text-sm">Notes from our team</h2>
            </div>
            <p className="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap">{approvalNotes}</p>
          </div>
        )}

        {/* Supplier card — show whenever a supplier is assigned */}
        {booking.suppliers && (() => {
          const supplier = booking.suppliers as { company_name?: string; contact_person?: string; phone?: string }
          return supplier.company_name ? (
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-emerald-400 text-base">🚐</span>
                <h2 className="font-semibold text-emerald-300 text-sm">Your Transport Provider</h2>
              </div>
              <dl className="space-y-2">
                <div className="flex justify-between">
                  <dt className="text-slate-500 text-xs uppercase tracking-wider">Company</dt>
                  <dd className="text-slate-200 text-sm font-medium">{supplier.company_name}</dd>
                </div>
                {supplier.contact_person && (
                  <div className="flex justify-between">
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Contact</dt>
                    <dd className="text-slate-200 text-sm">{supplier.contact_person}</dd>
                  </div>
                )}
                {supplier.phone && (
                  <div className="flex justify-between">
                    <dt className="text-slate-500 text-xs uppercase tracking-wider">Phone</dt>
                    <dd className="text-slate-200 text-sm">
                      <a href={`tel:${supplier.phone}`} className="text-emerald-400 hover:underline">{supplier.phone}</a>
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          ) : null
        })()}

        {/* Driver card — show whenever a driver is assigned */}
        {driverData?.full_name && (
          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-blue-400 text-base">🧑‍✈️</span>
              <h2 className="font-semibold text-blue-300 text-sm">Your Driver</h2>
            </div>
            <dl className="space-y-2">
              <div className="flex justify-between">
                <dt className="text-slate-500 text-xs uppercase tracking-wider">Name</dt>
                <dd className="text-slate-200 text-sm font-medium">{driverData.full_name}</dd>
              </div>
              {driverData.phone && (
                <div className="flex justify-between">
                  <dt className="text-slate-500 text-xs uppercase tracking-wider">Phone</dt>
                  <dd className="text-slate-200 text-sm">
                    <a href={`tel:${driverData.phone}`} className="text-blue-400 hover:underline">{driverData.phone}</a>
                  </dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {/* Vehicle card — show when plate or model is set */}
        {(booking.vehicle_plate || booking.vehicle_model) && (
          <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-violet-400 text-base">🚗</span>
              <h2 className="font-semibold text-violet-300 text-sm">Your Vehicle</h2>
            </div>
            <dl className="space-y-2">
              {booking.vehicle_model && (
                <div className="flex justify-between">
                  <dt className="text-slate-500 text-xs uppercase tracking-wider">Model</dt>
                  <dd className="text-slate-200 text-sm font-medium">{booking.vehicle_model}</dd>
                </div>
              )}
              {booking.vehicle_plate && (
                <div className="flex justify-between">
                  <dt className="text-slate-500 text-xs uppercase tracking-wider">Plate No.</dt>
                  <dd className="text-slate-200 text-sm font-medium tracking-wider">{booking.vehicle_plate}</dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {/* Trip details */}
        <div className="rounded-2xl border border-white/8 bg-white/3 p-6">
          <h2 className="font-semibold text-white text-sm mb-4">Trip details</h2>
          <dl className="space-y-3">
            {(() => {
              const driverValue = !booking.driver_required
                ? 'Self-drive'
                : driverData?.full_name
                ? `${driverData.full_name}${driverData.phone ? ` · ${driverData.phone}` : ''}`
                : 'Yes — included (driver TBA)'

              return [
                { label: 'Guest name', value: booking.guest_name },
                { label: 'Passengers', value: `${booking.guest_count} person${booking.guest_count !== 1 ? 's' : ''}` },
                { label: 'Vehicle', value: formatVehicle(booking.vehicle_type) },
                { label: 'Driver', value: driverValue },
                { label: 'Pickup', value: formatDate(booking.pickup_datetime) },
                { label: 'Drop-off', value: formatDate(booking.dropoff_datetime) },
                { label: 'From', value: booking.pickup_location },
                { label: 'To', value: booking.dropoff_location },
                { label: 'Special requests', value: booking.special_requests || '—' },
              ]
            })().map(({ label, value }) => (
              <div key={label} className="flex flex-col sm:flex-row sm:justify-between gap-1">
                <dt className="text-slate-500 text-xs uppercase tracking-wider font-medium w-32 flex-shrink-0">
                  {label}
                </dt>
                <dd className="text-slate-200 text-sm text-left sm:text-right">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Timeline */}
        <div className="rounded-2xl border border-white/8 bg-white/3 p-6">
          <h2 className="font-semibold text-white text-sm mb-5">Progress</h2>
          <ol className="space-y-0">
            {timeline.map((step, i) => (
              <li key={i} className="flex gap-4">
                {/* Connector */}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 z-10 ${
                      step.active
                        ? 'border-fleet-400 bg-fleet-500/30'
                        : step.done
                        ? 'border-emerald-500 bg-emerald-500/20'
                        : 'border-white/15 bg-white/5'
                    }`}
                  >
                    {step.done && !step.active ? (
                      <svg className="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    ) : step.active ? (
                      <div className="w-2 h-2 rounded-full bg-fleet-400 animate-pulse" />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-slate-600" />
                    )}
                  </div>
                  {i < timeline.length - 1 && (
                    <div className={`w-0.5 h-8 mt-1 ${step.done ? 'bg-emerald-500/40' : 'bg-white/8'}`} />
                  )}
                </div>

                {/* Label */}
                <div className="pb-6 last:pb-0 pt-0.5">
                  <p
                    className={`text-sm font-medium ${
                      step.active ? 'text-fleet-300' : step.done ? 'text-slate-200' : 'text-slate-500'
                    }`}
                  >
                    {step.label}
                  </p>
                  {step.time && (
                    <p className="text-slate-500 text-xs mt-0.5">{formatDate(step.time)}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* Modification Request */}
        <ModificationRequestModal
          referenceNumber={booking.reference_number}
          bookingStatus={booking.status}
          hasExistingRequest={booking.modification_status === 'pending'}
        />

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/book"
            className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-fleet text-white text-sm font-semibold shadow-fleet hover:shadow-fleet-lg transition-all text-center"
          >
            Make a new booking
          </Link>
          <Link
            href="/fleet"
            className="flex-1 py-2.5 px-4 rounded-xl border border-white/10 bg-white/5 text-white text-sm font-medium hover:bg-white/10 transition-colors text-center"
          >
            Browse vehicles
          </Link>
        </div>

        <p className="text-center text-slate-600 text-xs">
          Questions? Contact us and quote reference <span className="text-slate-400">{booking.reference_number}</span>
        </p>
      </div>
    </div>
  )
}
