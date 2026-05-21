'use client'

import { useState, useMemo, useEffect } from 'react'
import { Plus, Search, Filter, Download, RefreshCw, Trash2, XCircle, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn, formatDateTime, formatCurrency, vehicleLabels } from '@/lib/utils'
import { StatusBadge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSpinner'
import { BookingModal } from '@/components/bookings/BookingModal'
import { BookingDetailModal } from '@/components/bookings/BookingDetailModal'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import type { Booking, BookingStatus, Driver, Profile, Supplier, VehicleType } from '@/types'

interface Props {
  initialBookings: Booking[]
  suppliers: Supplier[]
  drivers: Driver[]
  profile: Profile
}

const STATUSES: BookingStatus[] = ['pending', 'quoted', 'approved', 'completed', 'cancelled']
const VEHICLES: VehicleType[] = ['sedan', 'suv', 'van', 'minibus', 'luxury', 'pickup']
const PAGE_SIZE = 25

export function BookingsClient({ initialBookings, suppliers, drivers, profile }: Props) {
  const { toast } = useToast()
  const [bookings, setBookings] = useState<Booking[]>(initialBookings)
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'all'>('all')
  const [vehicleFilter, setVehicleFilter] = useState<VehicleType | 'all'>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [cancelModal, setCancelModal] = useState<{ bookingId: string; ref: string } | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelLoading, setCancelLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [driverNeededFilter, setDriverNeededFilter] = useState(false)

  // Reset to page 1 whenever any filter changes
  useEffect(() => { setCurrentPage(1) }, [search, statusFilter, vehicleFilter, dateFrom, dateTo, driverNeededFilter])

  const filtered = useMemo(() => {
    const fromMs = dateFrom ? new Date(dateFrom).getTime() : null
    const toMs = dateTo ? new Date(dateTo + 'T23:59:59').getTime() : null
    return bookings.filter((b) => {
      const q = search.toLowerCase()
      const matchesSearch =
        !q ||
        b.guest_name.toLowerCase().includes(q) ||
        b.reference_number.toLowerCase().includes(q) ||
        b.pickup_location.toLowerCase().includes(q) ||
        b.dropoff_location.toLowerCase().includes(q) ||
        b.guest_nationality.toLowerCase().includes(q)
      const matchesStatus = statusFilter === 'all' || b.status === statusFilter
      const matchesVehicle = vehicleFilter === 'all' || b.vehicle_type === vehicleFilter
      const pickupMs = b.pickup_datetime ? new Date(b.pickup_datetime).getTime() : null
      const matchesFrom = !fromMs || (pickupMs != null && pickupMs >= fromMs)
      const matchesTo = !toMs || (pickupMs != null && pickupMs <= toMs)
      // "Driver needed" = driver is required but not yet assigned
      const matchesDriverNeeded = !driverNeededFilter || (b.driver_required && !b.driver_id)
      return matchesSearch && matchesStatus && matchesVehicle && matchesFrom && matchesTo && matchesDriverNeeded
    })
  }, [bookings, search, statusFilter, vehicleFilter, dateFrom, dateTo, driverNeededFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  async function refresh() {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('bookings')
      .select('*, profiles!bookings_created_by_fkey(full_name), suppliers(company_name), drivers(id,full_name,phone,license_number)')
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

  function handleDelete(bookingId: string) {
    const booking = bookings.find((b) => b.id === bookingId)
    setCancelReason('')
    setCancelModal({ bookingId, ref: booking?.reference_number ?? bookingId })
  }

  async function confirmCancel() {
    if (!cancelModal || !cancelReason.trim()) return
    setCancelLoading(true)
    try {
      const res = await fetch(`/api/bookings/${cancelModal.bookingId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancelReason.trim() }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Request failed')
      }
      toast('Booking cancelled', 'success')
      // Optimistically mark as cancelled in local state so it doesn't reappear
      setBookings((prev) =>
        prev.map((b) =>
          b.id === cancelModal.bookingId
            ? { ...b, status: 'cancelled' as BookingStatus, cancellation_reason: cancelReason.trim() }
            : b
        )
      )
      setCancelModal(null)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Something went wrong', 'error')
    } finally {
      setCancelLoading(false)
    }
  }

  async function handlePermanentDelete(bookingId: string) {
    const res = await fetch(`/api/bookings/${bookingId}`, { method: 'DELETE' })
    const result = await res.json()
    const error = res.ok ? null : result.error
    if (error) {
      toast(typeof error === 'string' ? error : 'Failed to delete booking', 'error')
    } else {
      toast('Booking deleted', 'success')
      setConfirmDeleteId(null)
      setBookings((prev) => prev.filter((b) => b.id !== bookingId))
    }
  }

  function exportCSV() {
    // Properly escape a field value for CSV (RFC 4180)
    function esc(val: string | number | null | undefined): string {
      if (val == null) return ''
      const s = String(val)
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s
    }

    const headers = [
      'Reference', 'Guest Name', 'Nationality', 'Guests',
      'Vehicle', 'Driver Required', 'Assigned Driver',
      'Pickup Location', 'Dropoff Location',
      'Pickup Date/Time', 'Dropoff Date/Time',
      'Budget (USD)', 'Final Cost (USD)',
      'Supplier', 'Status',
      'Special Requests', 'Cancellation Reason',
      'Created At',
    ]

    const rows = filtered.map((b) => {
      const supplier = b.suppliers as { company_name?: string } | undefined
      const driver = b.drivers as { full_name?: string } | undefined
      return [
        b.reference_number,
        b.guest_name,
        b.guest_nationality,
        b.guest_count,
        vehicleLabels[b.vehicle_type],
        b.driver_required ? 'Yes' : 'No',
        driver?.full_name ?? '',
        b.pickup_location,
        b.dropoff_location,
        b.pickup_datetime ? formatDateTime(b.pickup_datetime) : '',
        b.dropoff_datetime ? formatDateTime(b.dropoff_datetime) : '',
        b.budget_usd ?? '',
        b.final_cost_usd ?? '',
        supplier?.company_name ?? '',
        b.status,
        b.special_requests ?? '',
        b.cancellation_reason ?? '',
        b.created_at ? formatDateTime(b.created_at) : '',
      ].map(esc)
    })

    // UTF-8 BOM ensures Excel opens the file with correct encoding
    const csv = '﻿' + [headers.map(esc), ...rows].map((r) => r.join(',')).join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const date = new Date().toISOString().slice(0, 10)
    a.href = url
    a.download = `bookings-${date}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const canCreate = ['admin', 'staff', 'manager'].includes(profile.role)

  return (
    <>
      {/* Header actions */}
      <div className="flex flex-col gap-3 mb-5">
        {/* Row 1: search + action buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by guest, reference, location…"
              className="input-dark pl-10 w-full"
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={refresh} className="btn-secondary p-2.5" title="Refresh">
              <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            </button>
            <button onClick={exportCSV} className="btn-secondary p-2.5" title="Export filtered results as CSV">
              <Download className="w-4 h-4" />
            </button>
            {canCreate && (
              <button onClick={() => { setSelectedBooking(null); setShowModal(true) }} className="btn-primary">
                <Plus className="w-4 h-4" /> New Booking
              </button>
            )}
          </div>
        </div>

        {/* Row 2: status + vehicle + date range filters */}
        <div className="flex flex-wrap items-center gap-2">
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

          {/* Driver needed quick-filter */}
          <button
            onClick={() => setDriverNeededFilter((v) => !v)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all',
              driverNeededFilter
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/8'
            )}
            title="Show only bookings that need a driver assigned"
          >
            🧑‍✈️ Driver needed
            {driverNeededFilter && (
              <span className="ml-0.5 text-amber-400/70">✕</span>
            )}
          </button>

          {/* Date range */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="input-dark py-2 text-xs w-36"
              title="Pickup from"
            />
            <span className="text-slate-600 text-xs">–</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="input-dark py-2 text-xs w-36"
              title="Pickup to"
            />
            {(dateFrom || dateTo) && (
              <button
                onClick={() => { setDateFrom(''); setDateTo('') }}
                className="text-slate-500 hover:text-slate-300 transition-colors text-xs px-2 py-1 rounded-lg hover:bg-white/5"
                title="Clear date filter"
              >
                ✕
              </button>
            )}
          </div>

          {/* Active filter count */}
          {(dateFrom || dateTo || statusFilter !== 'all' || vehicleFilter !== 'all' || search) && (
            <span className="text-[11px] text-slate-500">
              {filtered.length} result{filtered.length !== 1 ? 's' : ''}
            </span>
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
                {paginated.map((booking) => {
                  const profiles = booking.profiles as { full_name?: string } | undefined
                  return (
                    <tr
                      key={booking.id}
                      className="table-row-hover cursor-pointer"
                      onClick={() => handleRowClick(booking)}
                    >
                      <td className="px-4 py-3.5">
                        <span className="font-mono text-xs text-fleet-400 font-semibold">{booking.reference_number}</span>
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
                        {booking.driver_required && (
                          booking.drivers
                            ? <span className="ml-1 text-[10px] text-emerald-400">🧑‍✈️ {(booking.drivers as { full_name?: string }).full_name}</span>
                            : <span className="ml-1 text-[10px] text-amber-400">+ driver needed</span>
                        )}
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
                          {profile.role === 'admin' && (
                            confirmDeleteId === booking.id ? (
                              <div className="flex items-center gap-1">
                                <span className="text-[11px] text-red-400">Delete?</span>
                                <button
                                  onClick={() => handlePermanentDelete(booking.id)}
                                  className="text-[11px] px-2 py-0.5 rounded bg-red-500 hover:bg-red-600 text-white font-semibold transition-colors"
                                >
                                  Yes
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="text-[11px] px-2 py-0.5 rounded bg-white/10 hover:bg-white/15 text-slate-400 transition-colors"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmDeleteId(booking.id)}
                                className="p-1 rounded-lg hover:bg-red-500/10 text-slate-600 hover:text-red-400 transition-colors"
                                title="Delete booking"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-xs text-slate-500">
          <span>
            Showing {((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg hover:bg-white/8 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
              .reduce<(number | '…')[]>((acc, p, idx, arr) => {
                if (idx > 0 && typeof arr[idx - 1] === 'number' && (arr[idx - 1] as number) + 1 < p) acc.push('…')
                acc.push(p)
                return acc
              }, [])
              .map((item, idx) =>
                item === '…' ? (
                  <span key={`ellipsis-${idx}`} className="px-1">…</span>
                ) : (
                  <button
                    key={item}
                    onClick={() => setCurrentPage(item as number)}
                    className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${
                      currentPage === item ? 'bg-fleet-600 text-white' : 'hover:bg-white/8 text-slate-400 hover:text-white'
                    }`}
                  >
                    {item}
                  </button>
                )
              )}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg hover:bg-white/8 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

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
          drivers={drivers}
          profile={profile}
          onEdit={() => handleEdit(selectedBooking)}
          onRefresh={refresh}
          onCancelled={(bookingId, reason) => {
            setBookings((prev) =>
              prev.map((b) =>
                b.id === bookingId
                  ? { ...b, status: 'cancelled' as BookingStatus, cancellation_reason: reason }
                  : b
              )
            )
          }}
        />
      )}

      {/* Cancel booking modal */}
      {cancelModal && (
        <Modal
          open={!!cancelModal}
          onClose={() => setCancelModal(null)}
          title="Cancel Booking"
          subtitle={`Reference: ${cancelModal.ref}`}
          size="sm"
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-3">
              <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-300 leading-relaxed">
                This will cancel the booking and notify the guest by email if an address is on file. This action cannot be undone.
              </p>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block font-medium">
                Cancellation Reason <span className="text-red-400">*</span>
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Please provide a reason for cancellation…"
                rows={3}
                className="input-dark resize-none"
                autoFocus
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setCancelModal(null)} className="btn-secondary">
                Keep Booking
              </button>
              <button
                onClick={confirmCancel}
                disabled={cancelLoading || !cancelReason.trim()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50"
              >
                {cancelLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                Confirm Cancellation
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
