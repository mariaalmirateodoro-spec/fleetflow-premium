'use client'

import { useState, useMemo } from 'react'
import { Plus, Search, Filter, Download, RefreshCw } from 'lucide-react'
import { cn, formatDateTime, formatCurrency, vehicleLabels } from '@/lib/utils'
import { StatusBadge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSpinner'
import { BookingModal } from '@/components/bookings/BookingModal'
import { BookingDetailModal } from '@/components/bookings/BookingDetailModal'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import type { Booking, BookingStatus, Profile, Supplier, VehicleType } from '@/types'

interface Props {
  initialBookings: Booking[]
  suppliers: Supplier[]
  profile: Profile
}

const STATUSES: BookingStatus[] = ['pending', 'quoted', 'approved', 'completed', 'cancelled']
const VEHICLES: VehicleType[] = ['sedan', 'suv', 'van', 'minibus', 'luxury', 'pickup']

export function BookingsClient({ initialBookings, suppliers, profile }: Props) {
  const { toast } = useToast()
  const [bookings, setBookings] = useState<Booking[]>(initialBookings)
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'all'>('all')
  const [vehicleFilter, setVehicleFilter] = useState<VehicleType | 'all'>('all')

  const filtered = useMemo(() => {
    return bookings.filter((b) => {
      const q = search.toLowerCase()
      const matchesSearch =
        !q ||
        b.guest_name.toLowerCase().includes(q) ||
        b.reference.toLowerCase().includes(q) ||
        b.pickup_location.toLowerCase().includes(q) ||
        b.dropoff_location.toLowerCase().includes(q) ||
        b.guest_nationality.toLowerCase().includes(q)
      const matchesStatus = statusFilter === 'all' || b.status === statusFilter
      const matchesVehicle = vehicleFilter === 'all' || b.vehicle_type === vehicleFilter
      return matchesSearch && matchesStatus && matchesVehicle
    })
  }, [bookings, search, statusFilter, vehicleFilter])

  async function refresh() {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('bookings')
      .select('*, profiles!bookings_created_by_fkey(full_name,email), suppliers(company_name)')
      .order('created_at', { ascending: false })
    if (data) setBookings(data)
    setLoading(false)
  }

  function handleRowClick(booking: Booking) {
    setSelectedBooking(booking)
    setShowDetail(true)
  }

  function handleEdit(booking: Booking) {
    setSelectedBooking(booking)
    setShowDetail(false)
    setShowModal(true)
  }

  async function handleDelete(bookingId: string) {
    if (!confirm('Cancel this booking?')) return
    const supabase = createClient()
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('id', bookingId)
    if (error) {
      toast('Failed to cancel booking', 'error')
    } else {
      toast('Booking cancelled', 'success')
      await refresh()
    }
  }

  function exportCSV() {
    const headers = ['Reference', 'Guest', 'Nationality', 'Pickup', 'Dropoff', 'Vehicle', 'Driver', 'Budget', 'Status']
    const rows = filtered.map((b) => [
      b.reference, b.guest_name, b.guest_nationality,
      b.pickup_location, b.dropoff_location,
      vehicleLabels[b.vehicle_type], b.driver_required ? 'Yes' : 'No',
      b.budget_usd ?? '', b.status,
    ])
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'bookings.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const canCreate = ['admin', 'staff', 'manager'].includes(profile.role)

  return (
    <>
      {/* Header actions */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by guest, reference, location…"
            className="input-dark pl-10 w-full"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as BookingStatus | 'all')}
            className="input-dark py-2 text-xs pr-8"
          >
            <option value="all">All Status</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>

          <select
            value={vehicleFilter}
            onChange={(e) => setVehicleFilter(e.target.value as VehicleType | 'all')}
            className="input-dark py-2 text-xs pr-8"
          >
            <option value="all">All Vehicles</option>
            {VEHICLES.map((v) => <option key={v} value={v}>{vehicleLabels[v]}</option>)}
          </select>

          <button onClick={refresh} className="btn-secondary p-2.5" title="Refresh">
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>

          <button onClick={exportCSV} className="btn-secondary p-2.5" title="Export CSV">
            <Download className="w-4 h-4" />
          </button>

          {canCreate && (
            <button onClick={() => { setSelectedBooking(null); setShowModal(true) }} className="btn-primary">
              <Plus className="w-4 h-4" /> New Booking
            </button>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex gap-3 mb-4 text-xs">
        {STATUSES.map((s) => {
          const count = bookings.filter((b) => b.status === s).length
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(statusFilter === s ? 'all' : s)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all',
                statusFilter === s ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'
              )}
            >
              <span className={cn('w-1.5 h-1.5 rounded-full', {
                'bg-amber-400': s === 'pending',
                'bg-blue-400': s === 'quoted',
                'bg-emerald-400': s === 'approved',
                'bg-purple-400': s === 'completed',
                'bg-red-400': s === 'cancelled',
              })} />
              {s} <span className="font-semibold">{count}</span>
            </button>
          )
        })}
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="p-6"><TableSkeleton rows={6} /></div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="🚗"
            title="No bookings found"
            description={search || statusFilter !== 'all' ? 'Try adjusting your filters.' : 'Create the first booking to get started.'}
            action={canCreate ? (
              <button onClick={() => { setSelectedBooking(null); setShowModal(true) }} className="btn-primary">
                <Plus className="w-4 h-4" /> New Booking
              </button>
            ) : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8 text-xs text-slate-500 uppercase tracking-wider">
                  <th className="px-4 py-3 text-left font-medium">Reference</th>
                  <th className="px-4 py-3 text-left font-medium">Guest</th>
                  <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Route</th>
                  <th className="px-4 py-3 text-left font-medium hidden lg:table-cell">Vehicle</th>
                  <th className="px-4 py-3 text-left font-medium hidden xl:table-cell">Pickup</th>
                  <th className="px-4 py-3 text-left font-medium">Budget</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map((booking) => {
                  const profiles = booking.profiles as { full_name?: string } | undefined
                  return (
                    <tr
                      key={booking.id}
                      className="table-row-hover cursor-pointer"
                      onClick={() => handleRowClick(booking)}
                    >
                      <td className="px-4 py-3.5">
                        <span className="font-mono text-xs text-fleet-400 font-semibold">{booking.reference}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div>
                          <p className="font-medium text-slate-200 text-xs">{booking.guest_name}</p>
                          <p className="text-slate-500 text-[11px]">{booking.guest_nationality} · {booking.guest_count} guest{booking.guest_count > 1 ? 's' : ''}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 hidden md:table-cell">
                        <p className="text-xs text-slate-400 max-w-[160px] truncate">{booking.pickup_location}</p>
                        <p className="text-[11px] text-slate-600 truncate">→ {booking.dropoff_location}</p>
                      </td>
                      <td className="px-4 py-3.5 hidden lg:table-cell">
                        <span className="text-xs text-slate-400">{vehicleLabels[booking.vehicle_type]}</span>
                        {booking.driver_required && <span className="ml-1 text-[10px] text-amber-400">+ driver</span>}
                      </td>
                      <td className="px-4 py-3.5 hidden xl:table-cell text-xs text-slate-400">
                        {formatDateTime(booking.pickup_datetime)}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-300 font-medium">
                        {formatCurrency(booking.final_cost_usd ?? booking.budget_usd)}
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={booking.status} />
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          {canCreate && booking.status === 'pending' && (
                            <button
                              onClick={() => handleEdit(booking)}
                              className="text-xs px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                            >
                              Edit
                            </button>
                          )}
                          {profile.role === 'admin' && booking.status !== 'cancelled' && booking.status !== 'completed' && (
                            <button
                              onClick={() => handleDelete(booking.id)}
                              className="text-xs px-2 py-1 rounded-lg bg-red-500/5 hover:bg-red-500/15 text-red-500 hover:text-red-400 transition-colors"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {showModal && (
        <BookingModal
          open={showModal}
          onClose={() => { setShowModal(false); setSelectedBooking(null) }}
          booking={selectedBooking}
          suppliers={suppliers}
          profile={profile}
          onSuccess={async () => { setShowModal(false); await refresh(); toast(selectedBooking ? 'Booking updated!' : 'Booking created!', 'success') }}
        />
      )}

      {showDetail && selectedBooking && (
        <BookingDetailModal
          open={showDetail}
          onClose={() => { setShowDetail(false); setSelectedBooking(null) }}
          booking={selectedBooking}
          suppliers={suppliers}
          profile={profile}
          onEdit={() => handleEdit(selectedBooking)}
          onRefresh={refresh}
        />
      )}
    </>
  )
}
