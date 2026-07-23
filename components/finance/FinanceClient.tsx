'use client'

import { useState, useMemo } from 'react'
import {
  DollarSign, CheckCircle2, Clock, AlertCircle,
  Search, X, Loader2, ChevronDown, CalendarDays, FileText, TrendingUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Profile } from '@/types'

type PaymentStatus = 'unpaid' | 'partial' | 'paid'

interface FinanceBooking {
  id: string
  reference_number: string
  guest_name: string
  pickup_datetime: string
  dropoff_datetime: string | null
  pickup_location: string
  dropoff_location: string
  vehicle_type: string
  budget_usd: number | null
  final_cost_usd: number | null
  status: string
  payment_status: PaymentStatus
  payment_amount: number | null
  paid_at: string | null
  payment_notes: string | null
  profiles?: { full_name: string } | null
  suppliers?: { company_name: string } | null
}

interface PaymentModalState {
  booking: FinanceBooking
  payment_status: PaymentStatus
  payment_amount: string
  paid_at: string
  payment_notes: string
}

const PAYMENT_BADGE: Record<PaymentStatus, { label: string; classes: string; icon: typeof CheckCircle2 }> = {
  unpaid:  { label: 'Unpaid',  classes: 'bg-red-500/15 text-red-400 border border-red-500/25',      icon: AlertCircle },
  partial: { label: 'Partial', classes: 'bg-amber-500/15 text-amber-400 border border-amber-500/25', icon: Clock },
  paid:    { label: 'Paid',    classes: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25', icon: CheckCircle2 },
}

function fmt(amount: number | null) {
  if (amount == null) return '—'
  return `₱${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

interface FinanceClientProps {
  initialBookings: FinanceBooking[]
  profile: Profile
}

export function FinanceClient({ initialBookings, profile }: FinanceClientProps) {
  const [bookings, setBookings] = useState<FinanceBooking[]>(initialBookings)
  const [tab, setTab] = useState<PaymentStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<PaymentModalState | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // ── Summary stats ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    let outstanding = 0
    let paidThisMonth = 0
    let totalPaid = 0
    let unpaidCount = 0
    let partialCount = 0
    let paidCount = 0

    for (const b of bookings) {
      const cost = b.final_cost_usd ?? b.budget_usd ?? 0
      const paidAmt = b.payment_amount ?? 0

      if (b.payment_status === 'unpaid') {
        outstanding += cost
        unpaidCount++
      } else if (b.payment_status === 'partial') {
        outstanding += cost - paidAmt
        partialCount++
      } else {
        paidCount++
        totalPaid += b.payment_amount ?? cost
        if (b.paid_at && b.paid_at >= monthStart) {
          paidThisMonth += b.payment_amount ?? cost
        }
      }
    }

    return { outstanding, paidThisMonth, totalPaid, unpaidCount, partialCount, paidCount }
  }, [bookings])

  // ── Filtered list ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return bookings.filter((b) => {
      if (tab !== 'all' && b.payment_status !== tab) return false
      if (search) {
        const q = search.toLowerCase()
        if (
          !b.reference_number.toLowerCase().includes(q) &&
          !b.guest_name.toLowerCase().includes(q) &&
          !(b.suppliers?.company_name ?? '').toLowerCase().includes(q)
        ) return false
      }
      return true
    })
  }, [bookings, tab, search])

  // ── Open payment modal ─────────────────────────────────────────────────────
  function openModal(booking: FinanceBooking) {
    const cost = booking.final_cost_usd ?? booking.budget_usd ?? 0
    setModal({
      booking,
      payment_status: booking.payment_status === 'paid' ? 'paid' : 'paid',
      payment_amount: String(cost),
      paid_at: booking.paid_at ? booking.paid_at.split('T')[0] : todayISO(),
      payment_notes: booking.payment_notes ?? '',
    })
    setError('')
  }

  // ── Save payment ───────────────────────────────────────────────────────────
  async function savePayment() {
    if (!modal) return
    setSaving(true)
    setError('')

    const res = await fetch('/api/finance', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingId: modal.booking.id,
        payment_status: modal.payment_status,
        payment_amount: modal.payment_amount ? Number(modal.payment_amount) : null,
        paid_at: modal.paid_at ? new Date(modal.paid_at).toISOString() : null,
        payment_notes: modal.payment_notes || null,
      }),
    })

    const json = await res.json()
    if (!res.ok) {
      setError(json.error ?? 'Failed to save')
      setSaving(false)
      return
    }

    // Update local state
    setBookings((prev) =>
      prev.map((b) =>
        b.id === modal.booking.id
          ? { ...b, ...json.data }
          : b
      )
    )
    setModal(null)
    setSaving(false)
  }

  // ── Mark as unpaid ─────────────────────────────────────────────────────────
  async function markUnpaid(bookingId: string) {
    const res = await fetch('/api/finance', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingId,
        payment_status: 'unpaid',
        payment_amount: null,
        paid_at: null,
        payment_notes: null,
      }),
    })
    if (res.ok) {
      const json = await res.json()
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, ...json.data } : b))
      )
    }
  }

  const canEdit = ['admin', 'finance'].includes(profile.role)

  return (
    <div className="space-y-6">
      {/* ── Summary cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <SummaryCard
          icon={AlertCircle}
          iconClass="text-red-400"
          label="Outstanding"
          value={fmt(stats.outstanding)}
          sub={`${stats.unpaidCount + stats.partialCount} booking${stats.unpaidCount + stats.partialCount !== 1 ? 's' : ''}`}
          accent="red"
        />
        <SummaryCard
          icon={TrendingUp}
          iconClass="text-amber-400"
          label="Paid This Month"
          value={fmt(stats.paidThisMonth)}
          sub="current month"
          accent="amber"
        />
        <SummaryCard
          icon={DollarSign}
          iconClass="text-emerald-400"
          label="Total Paid"
          value={fmt(stats.totalPaid)}
          sub="all time"
          accent="emerald"
        />
        <SummaryCard
          icon={FileText}
          iconClass="text-fleet-400"
          label="Total Invoices"
          value={String(bookings.length)}
          sub={`${stats.paidCount} paid · ${stats.partialCount} partial · ${stats.unpaidCount} unpaid`}
          accent="fleet"
        />
      </div>

      {/* ── Filters ───────────────────────────────────────────────────── */}
      <div className="glass rounded-2xl border border-white/8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 border-b border-white/8">
          {/* Tabs */}
          <div className="flex gap-1 bg-white/5 rounded-xl p-1">
            {(['all', 'unpaid', 'partial', 'paid'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  tab === t
                    ? 'bg-fleet-600/30 text-fleet-300 border border-fleet-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                )}
              >
                {t === 'all' ? 'All' : PAYMENT_BADGE[t].label}
                {t !== 'all' && (
                  <span className="ml-1.5 text-[10px] opacity-60">
                    {t === 'unpaid' ? stats.unpaidCount : t === 'partial' ? stats.partialCount : stats.paidCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reference, guest, supplier…"
              className="input-dark pl-9 py-2 text-sm w-full"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* ── Table ─────────────────────────────────────────────────── */}
        <div className="overflow-x-auto">
          {filtered.length === 0 ? (
            <div className="py-16 text-center text-slate-500 text-sm">
              No bookings found
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8 text-[11px] text-slate-500 uppercase tracking-wider">
                  <th className="text-left px-4 py-3 font-medium">Reference</th>
                  <th className="text-left px-4 py-3 font-medium">Guest</th>
                  <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Pickup</th>
                  <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Supplier</th>
                  <th className="text-right px-4 py-3 font-medium">Amount</th>
                  <th className="text-right px-4 py-3 font-medium hidden sm:table-cell">Paid</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium hidden xl:table-cell">Paid On</th>
                  {canEdit && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map((b) => {
                  const cost = b.final_cost_usd ?? b.budget_usd
                  const badge = PAYMENT_BADGE[b.payment_status]
                  const BadgeIcon = badge.icon
                  const remaining =
                    b.payment_status === 'partial' && cost != null && b.payment_amount != null
                      ? cost - b.payment_amount
                      : null

                  return (
                    <tr key={b.id} className="hover:bg-white/3 transition-colors group">
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-fleet-300 font-medium">
                          {b.reference_number}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-slate-200 font-medium truncate max-w-[140px]">{b.guest_name}</p>
                        <p className="text-[11px] text-slate-500 capitalize">{b.vehicle_type}</p>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <p className="text-slate-300 text-xs">{fmtDateTime(b.pickup_datetime)}</p>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <p className="text-slate-400 text-xs truncate max-w-[120px]">
                          {b.suppliers?.company_name ?? '—'}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <p className="text-slate-200 font-semibold tabular-nums">{fmt(cost)}</p>
                        {b.status === 'approved' && (
                          <p className="text-[10px] text-amber-500/70">Estimated</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right hidden sm:table-cell">
                        {b.payment_status === 'paid' && (
                          <p className="text-emerald-400 font-semibold tabular-nums">{fmt(b.payment_amount ?? cost)}</p>
                        )}
                        {b.payment_status === 'partial' && (
                          <div>
                            <p className="text-amber-400 font-semibold tabular-nums">{fmt(b.payment_amount)}</p>
                            {remaining != null && (
                              <p className="text-[10px] text-red-400/70">{fmt(remaining)} left</p>
                            )}
                          </div>
                        )}
                        {b.payment_status === 'unpaid' && (
                          <p className="text-slate-600 text-xs">—</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium', badge.classes)}>
                          <BadgeIcon className="w-3 h-3" />
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden xl:table-cell text-xs text-slate-500">
                        {fmtDate(b.paid_at)}
                      </td>
                      {canEdit && (
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 justify-end">
                            {b.payment_status !== 'paid' && (
                              <button
                                onClick={() => openModal(b)}
                                className="px-2.5 py-1 rounded-lg bg-fleet-600/20 text-fleet-300 border border-fleet-500/20 text-[11px] font-medium hover:bg-fleet-600/30 transition-colors whitespace-nowrap"
                              >
                                Record Payment
                              </button>
                            )}
                            {b.payment_status === 'paid' && (
                              <button
                                onClick={() => markUnpaid(b.id)}
                                className="px-2.5 py-1 rounded-lg bg-white/5 text-slate-400 border border-white/10 text-[11px] font-medium hover:bg-white/10 transition-colors whitespace-nowrap"
                              >
                                Undo
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-white/8 text-xs text-slate-500">
            Showing {filtered.length} of {bookings.length} bookings
          </div>
        )}
      </div>

      {/* ── Payment Modal ─────────────────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setModal(null)} />
          <div className="relative glass border border-white/12 rounded-2xl w-full max-w-md shadow-2xl p-6 animate-slide-up">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base font-semibold text-white">Record Payment</h3>
                <p className="text-xs text-slate-400 mt-0.5 font-mono">{modal.booking.reference_number}</p>
              </div>
              <button onClick={() => setModal(null)} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Booking summary */}
            <div className="bg-white/5 rounded-xl p-3 mb-5 text-sm">
              <div className="flex justify-between mb-1">
                <span className="text-slate-400">Guest</span>
                <span className="text-slate-200 font-medium">{modal.booking.guest_name}</span>
              </div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-400">Total Cost</span>
                <span className="text-slate-200 font-semibold">
                  {fmt(modal.booking.final_cost_usd ?? modal.booking.budget_usd)}
                </span>
              </div>
              {modal.booking.suppliers?.company_name && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Supplier</span>
                  <span className="text-slate-300">{modal.booking.suppliers.company_name}</span>
                </div>
              )}
            </div>

            <div className="space-y-4">
              {/* Payment status */}
              <div>
                <label className="text-xs text-slate-400 font-medium mb-1.5 block">Payment Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['partial', 'paid'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setModal((m) => {
                          if (!m) return m
                          const fullCost = m.booking.final_cost_usd ?? m.booking.budget_usd ?? 0
                          return {
                            ...m,
                            payment_status: s,
                            payment_amount: s === 'paid' ? String(fullCost) : m.payment_amount,
                          }
                        })
                      }}
                      className={cn(
                        'py-2 rounded-xl text-sm font-medium border transition-all',
                        modal.payment_status === s
                          ? s === 'paid'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'
                      )}
                    >
                      {s === 'paid' ? 'Fully Paid' : 'Partial Payment'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount paid */}
              <div>
                <label className="text-xs text-slate-400 font-medium mb-1.5 block">
                  {modal.payment_status === 'partial' ? 'Amount Paid (₱)' : 'Amount (₱)'}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₱</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={modal.payment_amount}
                    onChange={(e) => setModal((m) => m ? { ...m, payment_amount: e.target.value } : m)}
                    className="input-dark pl-7 w-full"
                    placeholder="0.00"
                  />
                </div>
                {modal.payment_status === 'partial' && modal.payment_amount && (
                  (() => {
                    const cost = modal.booking.final_cost_usd ?? modal.booking.budget_usd ?? 0
                    const remaining = cost - Number(modal.payment_amount)
                    return remaining > 0 ? (
                      <p className="text-[11px] text-red-400/70 mt-1">Remaining: {fmt(remaining)}</p>
                    ) : null
                  })()
                )}
              </div>

              {/* Date paid */}
              <div>
                <label className="text-xs text-slate-400 font-medium mb-1.5 block flex items-center gap-1.5">
                  <CalendarDays className="w-3 h-3" /> Date Paid
                </label>
                <input
                  type="date"
                  value={modal.paid_at}
                  onChange={(e) => setModal((m) => m ? { ...m, paid_at: e.target.value } : m)}
                  className="input-dark w-full"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs text-slate-400 font-medium mb-1.5 block">Notes (optional)</label>
                <textarea
                  value={modal.payment_notes}
                  onChange={(e) => setModal((m) => m ? { ...m, payment_notes: e.target.value } : m)}
                  placeholder="e.g. Paid via bank transfer, ref #12345"
                  rows={2}
                  className="input-dark w-full resize-none"
                />
              </div>

              {error && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setModal(null)}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/5 text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={savePayment}
                  disabled={saving || !modal.payment_amount}
                  className="flex-1 btn-primary py-2.5 text-sm font-medium flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {saving ? 'Saving…' : 'Save Payment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Summary card sub-component ──────────────────────────────────────────────
function SummaryCard({
  icon: Icon,
  iconClass,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.FC<{ className?: string }>
  iconClass: string
  label: string
  value: string
  sub: string
  accent: 'red' | 'amber' | 'emerald' | 'fleet'
}) {
  const glowMap = {
    red: 'shadow-[0_0_30px_rgba(239,68,68,0.08)]',
    amber: 'shadow-[0_0_30px_rgba(245,158,11,0.08)]',
    emerald: 'shadow-[0_0_30px_rgba(16,185,129,0.08)]',
    fleet: 'shadow-[0_0_30px_rgba(99,102,241,0.08)]',
  }

  return (
    <div className={cn('glass rounded-2xl border border-white/8 p-5', glowMap[accent])}>
      <div className="flex items-start justify-between mb-3">
        <Icon className={cn('w-5 h-5', iconClass)} />
      </div>
      <p className="text-2xl font-bold text-white font-display tabular-nums">{value}</p>
      <p className="text-xs text-slate-400 font-medium mt-0.5">{label}</p>
      <p className="text-[11px] text-slate-600 mt-1">{sub}</p>
    </div>
  )
}
