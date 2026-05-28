'use client'

import { useState, useEffect } from 'react'
import { Edit2, Mail, Plus, Star, Loader2, Sparkles, Check, Copy, Send, XCircle, CheckCircle2, PencilLine, UserCheck, UserX } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { StatusBadge, Badge } from '@/components/ui/Badge'
import { formatDateTime, formatCurrency, vehicleLabels } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import type { Booking, Driver, Profile, Quote, Supplier } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  booking: Booking
  suppliers: Supplier[]
  drivers: Driver[]
  profile: Profile
  onEdit: () => void
  onRefresh: () => void
  onCancelled?: (bookingId: string, reason: string) => void
}

export function BookingDetailModal({ open, onClose, booking, suppliers, drivers, profile, onEdit, onRefresh, onCancelled }: Props) {
  const { toast } = useToast()
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [showAddQuote, setShowAddQuote] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [addingQuote, setAddingQuote] = useState(false)

  // Driver assignment state
  const [assignedDriverId, setAssignedDriverId] = useState<string | null>(booking.driver_id ?? null)
  const [driverLoading, setDriverLoading] = useState(false)
  const [conflictWarning, setConflictWarning] = useState<{
    conflicts: Array<{ reference_number: string; guest_name: string; pickup_datetime: string; dropoff_datetime: string | null }>
    driverId: string
  } | null>(null)

  // Cancellation state
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelLoading, setCancelLoading] = useState(false)

  // Completion state
  const [showCompleteModal, setShowCompleteModal] = useState(false)
  const [completeLoading, setCompleteLoading] = useState(false)

  // Final cost editing
  const [editingCost, setEditingCost] = useState(false)
  const [costValue, setCostValue] = useState('')
  const [costLoading, setCostLoading] = useState(false)

  // Guest notification state
  const [guestEmailDraft, setGuestEmailDraft] = useState('')
  const [guestEmailLoading, setGuestEmailLoading] = useState(false)
  const [showNotifyReminder, setShowNotifyReminder] = useState(false)
  const [guestViberDraft, setGuestViberDraft] = useState('')
  const [guestViberLoading, setGuestViberLoading] = useState(false)
  const [guestLineDraft, setGuestLineDraft] = useState('')
  const [guestLineLoading, setGuestLineLoading] = useState(false)

  // Contact supplier state
  const [contactTab, setContactTab] = useState<'email' | 'viber'>('email')
  const [selectedSupplierId, setSelectedSupplierId] = useState(suppliers[0]?.id ?? '')
  const [emailDraft, setEmailDraft] = useState('')
  const [viberDraft, setViberDraft] = useState('')

  const [newQuote, setNewQuote] = useState({
    supplier_id: suppliers[0]?.id ?? '',
    total_amount: 0,
    includes_driver: false,
    vehicle_model: '',
    notes: '',
  })

  useEffect(() => {
    if (open) loadQuotes()
  }, [open, booking.id])

  // Sync assigned driver when booking prop changes
  useEffect(() => {
    setAssignedDriverId(booking.driver_id ?? null)
  }, [booking.driver_id])

  // Reset drafts when supplier changes
  useEffect(() => {
    setEmailDraft('')
    setViberDraft('')
  }, [selectedSupplierId])

  async function loadQuotes() {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('quotes')
      .select('*')
      .eq('booking_id', booking.id)
      .order('total_amount', { ascending: true })
    if (error) console.error('[loadQuotes]', error)
    if (data) setQuotes(data)
  }

  async function doAssignDriver(driverId: string | null) {
    setDriverLoading(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('bookings')
      .update({ driver_id: driverId })
      .eq('id', booking.id)
    if (error) {
      toast(`Failed to update driver: ${error.message}`, 'error')
    } else {
      setAssignedDriverId(driverId)
      toast(driverId ? 'Driver assigned!' : 'Driver removed', 'success')
      onRefresh()
    }
    setDriverLoading(false)
  }

  async function checkAndAssignDriver(driverId: string) {
    setDriverLoading(true)
    const supabase = createClient()

    // Fetch other active bookings assigned to this driver
    const { data: existing, error } = await supabase
      .from('bookings')
      .select('id, reference_number, guest_name, pickup_datetime, dropoff_datetime')
      .eq('driver_id', driverId)
      .neq('id', booking.id)
      .in('status', ['pending', 'quoted', 'approved'])

    if (error) {
      toast(`Could not check conflicts: ${error.message}`, 'error')
      setDriverLoading(false)
      return
    }

    // Time-overlap check: treats null dropoff as pickup + 4 hours
    const thisPickup = new Date(booking.pickup_datetime).getTime()
    const thisDropoff = booking.dropoff_datetime
      ? new Date(booking.dropoff_datetime).getTime()
      : thisPickup + 4 * 60 * 60 * 1000

    const conflicting = (existing ?? []).filter((b) => {
      const otherPickup = new Date(b.pickup_datetime).getTime()
      const otherDropoff = b.dropoff_datetime
        ? new Date(b.dropoff_datetime).getTime()
        : otherPickup + 4 * 60 * 60 * 1000
      return thisPickup < otherDropoff && thisDropoff > otherPickup
    })

    setDriverLoading(false)

    if (conflicting.length > 0) {
      setConflictWarning({ conflicts: conflicting, driverId })
    } else {
      await doAssignDriver(driverId)
    }
  }

  async function handleSelectQuote(quoteId: string) {
    const supabase = createClient()
    await supabase.from('quotes').update({ is_selected: false }).eq('booking_id', booking.id)
    const quote = quotes.find((q) => q.id === quoteId)
    await supabase.from('quotes').update({ is_selected: true }).eq('id', quoteId)
    await supabase.from('bookings').update({
      status: 'quoted',
      assigned_supplier: quote?.supplier_id,
    }).eq('id', booking.id)
    toast('Quote selected!', 'success')
    await loadQuotes()
    onRefresh()
    if (booking.guest_email) setShowNotifyReminder(true)
  }

  async function handleAddQuote() {
    setAddingQuote(true)
    const supabase = createClient()
    const { error } = await supabase.from('quotes').insert({
      booking_id: booking.id,
      supplier_id: newQuote.supplier_id,
      total_amount: newQuote.total_amount,
      includes_driver: newQuote.includes_driver,
      vehicle_model: newQuote.vehicle_model || null,
      notes: newQuote.notes || null,
      created_by: profile.id,
    })
    if (error) {
      console.error('[handleAddQuote]', error)
      toast(`Failed to save quote: ${error.message}`, 'error')
      setAddingQuote(false)
      return
    }
    toast('Quote added!', 'success')
    setShowAddQuote(false)
    await loadQuotes()
    setAddingQuote(false)
  }

  async function generateDrafts() {
    setAiLoading(true)
    const supplier = suppliers.find((s) => s.id === selectedSupplierId) ?? suppliers[0]
    if (!supplier) { setAiLoading(false); return }
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'draft_email', booking, supplier }),
      })
      const data = await res.json()
      setEmailDraft(data.email ?? '')

      const vRes = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'viber_message', booking, supplier }),
      })
      const vData = await vRes.json()
      setViberDraft(vData.message ?? '')
    } catch {
      setEmailDraft('Failed to generate. Please try again.')
    }
    setAiLoading(false)
  }

  async function summarizeBooking() {
    setAiLoading(true)
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'summarize', booking }),
      })
      const data = await res.json()
      toast(data.summary ?? 'Summary ready', 'info')
    } catch { /* ignore */ }
    setAiLoading(false)
  }

  function sendViaEmail() {
    const supplier = suppliers.find((s) => s.id === selectedSupplierId)
    if (!supplier || !emailDraft) return
    const lines = emailDraft.split('\n')
    const subjectLine = lines[0].replace('Subject: ', '')
    const body = lines.slice(2).join('\n')
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(supplier.email)}&su=${encodeURIComponent(subjectLine)}&body=${encodeURIComponent(body)}`
    window.open(gmailUrl, '_blank')
  }

  async function openViber() {
    const supplier = suppliers.find((s) => s.id === selectedSupplierId)
    if (!supplier) return
    const phone = supplier.phone.replace(/[\s\-\(\)]/g, '')

    if (viberDraft) {
      try {
        // Call local FleetFlow server — auto-pastes & sends in Viber via AutoHotkey
        const res = await fetch(
          `http://localhost:9876/send?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(viberDraft)}`,
          { signal: AbortSignal.timeout(3000) }
        )
        if (res.ok) {
          toast('Sending via Viber…', 'success')
          return
        }
      } catch {
        // Local server not running — fall back to clipboard + deep link
        navigator.clipboard.writeText(viberDraft).catch(() => {})
        toast('Message copied — press Ctrl+V in Viber to paste', 'info')
      }
    }

    // Open Viber chat (fallback path)
    const a = document.createElement('a')
    a.href = `viber://chat?number=${encodeURIComponent(phone)}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  async function generateGuestEmail() {
    setGuestEmailLoading(true)
    const selectedQuote = quotes.find((q) => q.is_selected) ?? null
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'guest_email', booking, selectedQuote }),
      })
      const data = await res.json()
      setGuestEmailDraft(data.email ?? '')
    } catch {
      setGuestEmailDraft('Failed to generate. Please try again.')
    }
    setGuestEmailLoading(false)
  }

  async function generateGuestViberDraft() {
    setGuestViberLoading(true)
    const selectedQuote = quotes.find((q) => q.is_selected) ?? null
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'guest_viber_message', booking, selectedQuote }),
      })
      const data = await res.json()
      setGuestViberDraft(data.message ?? '')
    } catch {
      setGuestViberDraft('Failed to generate. Please try again.')
    }
    setGuestViberLoading(false)
  }

  async function openGuestViber() {
    if (!booking.guest_phone) return
    const phone = booking.guest_phone.replace(/[\s\-\(\)]/g, '')
    if (guestViberDraft) {
      try {
        const res = await fetch(
          `http://localhost:9876/send?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(guestViberDraft)}`,
          { signal: AbortSignal.timeout(3000) }
        )
        if (res.ok) {
          toast('Sending via Viber…', 'success')
          return
        }
      } catch {
        navigator.clipboard.writeText(guestViberDraft).catch(() => {})
        toast('Message copied — press Ctrl+V in Viber to paste', 'info')
      }
    }
    const a = document.createElement('a')
    a.href = `viber://chat?number=${encodeURIComponent(phone)}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }


  async function generateGuestLineDraft() {
    setGuestLineLoading(true)
    const selectedQuote = quotes.find((q) => q.is_selected) ?? null
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'guest_line_message', booking, selectedQuote }),
      })
      const data = await res.json()
      setGuestLineDraft(data.message ?? '')
    } catch {
      setGuestLineDraft('Failed to generate. Please try again.')
    }
    setGuestLineLoading(false)
  }

  function openGuestLine() {
    if (!guestLineDraft) return
    // Always copy to clipboard first so the message is ready to paste
    navigator.clipboard.writeText(guestLineDraft).catch(() => {})
    // Try the LINE desktop/mobile URL scheme — works when LINE app is installed
    const encoded = encodeURIComponent(guestLineDraft)
    window.open(`https://line.me/R/msg/text/?${encoded}`, '_blank')
    toast('Message copied! LINE opened — paste and send to the guest.', 'success')
  }
  function sendGuestEmail() {
    if (!booking.guest_email || !guestEmailDraft) return
    const lines = guestEmailDraft.split('\n')
    const subjectLine = lines[0].replace('Subject: ', '')
    const body = lines.slice(2).join('\n')
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(booking.guest_email)}&su=${encodeURIComponent(subjectLine)}&body=${encodeURIComponent(body)}`
    window.open(gmailUrl, '_blank')
  }

  async function handleCancel() {
    if (!cancelReason.trim()) return
    setCancelLoading(true)
    try {
      const res = await fetch(`/api/bookings/${booking.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancelReason.trim() }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Request failed')
      }
      toast('Booking cancelled', 'success')
      setShowCancelModal(false)
      const reason = cancelReason.trim()
      setCancelReason('')
      // Use optimistic update if available, otherwise full refresh
      if (onCancelled) {
        onCancelled(booking.id, reason)
      } else {
        onRefresh()
      }
      onClose()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Something went wrong', 'error')
    } finally {
      setCancelLoading(false)
    }
  }

  async function handleComplete() {
    setCompleteLoading(true)
    try {
      const res = await fetch(`/api/bookings/${booking.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Request failed')
      }
      toast('Booking marked as completed!', 'success')
      setShowCompleteModal(false)
      onRefresh()
      onClose()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Something went wrong', 'error')
    } finally {
      setCompleteLoading(false)
    }
  }

  async function handleSaveCost() {
    const parsed = parseFloat(costValue)
    if (isNaN(parsed) || parsed < 0) {
      toast('Please enter a valid amount', 'error')
      return
    }
    setCostLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('bookings')
        .update({ final_cost_usd: parsed })
        .eq('id', booking.id)
      if (error) throw new Error(error.message)
      toast('Final cost updated', 'success')
      setEditingCost(false)
      onRefresh()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Something went wrong', 'error')
    } finally {
      setCostLoading(false)
    }
  }

  const cheapest = quotes.length > 0 ? quotes[0] : null
  const bestValue = quotes.length > 1
    ? quotes.reduce((best, q) => {
        const bSupplier = suppliers.find((s) => s.id === best.supplier_id)
        const qSupplier = suppliers.find((s) => s.id === q.supplier_id)
        const bScore = (bSupplier?.rating ?? 0) / 5 * 0.5 + (1 - best.total_amount / (cheapest?.total_amount || 1)) * 0.5
        const qScore = (qSupplier?.rating ?? 0) / 5 * 0.5 + (1 - q.total_amount / (cheapest?.total_amount || 1)) * 0.5
        return qScore > bScore ? q : best
      })
    : null

  const canEdit = profile.role !== 'finance'
  const canManageQuotes = ['admin', 'manager', 'staff'].includes(profile.role)
  const canCancel = ['admin', 'manager', 'staff'].includes(profile.role) &&
    booking.status !== 'cancelled' && booking.status !== 'completed'
  const canComplete = ['admin', 'manager', 'staff'].includes(profile.role) &&
    booking.status === 'approved'
  const canEditCost = ['admin', 'manager', 'staff'].includes(profile.role) &&
    (booking.status === 'approved' || booking.status === 'completed')
  const canAssignDriver = ['admin', 'manager', 'staff'].includes(profile.role) &&
    booking.driver_required &&
    booking.status !== 'cancelled' && booking.status !== 'completed'
  const assignedDriver = drivers.find((d) => d.id === assignedDriverId) ?? null
  const selectedSupplier = suppliers.find((s) => s.id === selectedSupplierId)
  const currentDraft = contactTab === 'email' ? emailDraft : viberDraft

  return (
    <Modal open={open} onClose={onClose} title={`Booking ${booking.reference_number}`} subtitle={`${booking.guest_name} · ${booking.guest_nationality}`} size="2xl">
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        {/* Status + actions */}
        <div className="flex items-center justify-between">
          <StatusBadge status={booking.status} />
          <div className="flex gap-2">
            <button onClick={summarizeBooking} disabled={aiLoading} className="btn-secondary text-xs py-1.5 px-3">
              <Sparkles className="w-3.5 h-3.5" /> AI Summary
            </button>
            {canEdit && booking.status === 'pending' && (
              <button onClick={onEdit} className="btn-secondary text-xs py-1.5 px-3">
                <Edit2 className="w-3.5 h-3.5" /> Edit
              </button>
            )}
            {canCancel && (
              <button
                onClick={() => { setCancelReason(''); setShowCancelModal(true) }}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
              >
                <XCircle className="w-3.5 h-3.5" /> Cancel
              </button>
            )}
            {canComplete && (
              <button
                onClick={() => setShowCompleteModal(true)}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Complete
              </button>
            )}
          </div>
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          {[
            ['Guest', booking.guest_name],
            ['Nationality', booking.guest_nationality],
            ['Guest Count', `${booking.guest_count} pax`],
            ['Vehicle', vehicleLabels[booking.vehicle_type]],
            ['Budget', formatCurrency(booking.budget_usd)],
            ['Pickup', formatDateTime(booking.pickup_datetime)],
            ['Dropoff', booking.dropoff_datetime ? formatDateTime(booking.dropoff_datetime) : '—'],
            ['Pickup Location', booking.pickup_location],
            ['Dropoff Location', booking.dropoff_location],
          ].map(([label, value]) => (
            <div key={label} className="bg-white/[0.03] rounded-xl px-3 py-2.5">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">{label}</p>
              <p className="text-xs text-slate-200 font-medium">{value}</p>
            </div>
          ))}

          {/* Driver cell — spans full width to show assignment info */}
          <div className="col-span-2 bg-white/[0.03] rounded-xl px-3 py-2.5">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Driver</p>
            {!booking.driver_required ? (
              <p className="text-xs text-slate-500">Not required for this booking</p>
            ) : assignedDriver ? (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <div>
                    <p className="text-xs text-slate-200 font-medium">{assignedDriver.full_name}</p>
                    <p className="text-[11px] text-slate-500">{assignedDriver.phone} · {assignedDriver.license_number}</p>
                  </div>
                </div>
                {canAssignDriver && (
                  <button
                    onClick={() => doAssignDriver(null)}
                    disabled={driverLoading}
                    className="shrink-0 text-[11px] text-slate-500 hover:text-red-400 transition-colors disabled:opacity-40"
                    title="Remove driver"
                  >
                    {driverLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserX className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <UserX className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <p className="text-xs text-amber-300">Required — no driver assigned yet</p>
              </div>
            )}
          </div>

          {/* Final Cost — editable for approved/completed bookings */}
          <div className="bg-white/[0.03] rounded-xl px-3 py-2.5">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Final Cost</p>
            {editingCost ? (
              <div className="flex items-center gap-1.5 mt-1">
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={costValue}
                  onChange={(e) => setCostValue(e.target.value)}
                  placeholder="0.00"
                  className="input-dark text-xs py-1 px-2 flex-1 min-w-0"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveCost()
                    if (e.key === 'Escape') setEditingCost(false)
                  }}
                />
                <button
                  onClick={handleSaveCost}
                  disabled={costLoading}
                  className="text-emerald-400 hover:text-emerald-300 disabled:opacity-50 shrink-0"
                  title="Save"
                >
                  {costLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => setEditingCost(false)}
                  className="text-slate-500 hover:text-slate-300 shrink-0"
                  title="Cancel"
                >
                  <XCircle className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <p className="text-xs text-slate-200 font-medium">{formatCurrency(booking.final_cost_usd)}</p>
                {canEditCost && (
                  <button
                    onClick={() => {
                      setCostValue(booking.final_cost_usd != null ? String(booking.final_cost_usd) : '')
                      setEditingCost(true)
                    }}
                    className="text-slate-600 hover:text-slate-400 transition-colors"
                    title="Edit final cost"
                  >
                    <PencilLine className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {(booking.notes || booking.special_requests) && (
          <div className="space-y-2">
            {booking.notes && (
              <div className="bg-white/[0.03] rounded-xl px-3 py-2.5">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Notes</p>
                <p className="text-xs text-slate-300">{booking.notes}</p>
              </div>
            )}
            {booking.special_requests && (
              <div className="bg-white/[0.03] rounded-xl px-3 py-2.5">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Special Requests</p>
                <p className="text-xs text-slate-300">{booking.special_requests}</p>
              </div>
            )}
          </div>
        )}

        {/* Driver picker — shown when driver is required and user can assign */}
        {canAssignDriver && !assignedDriver && (
          <div className="border border-amber-500/20 bg-amber-500/5 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-amber-500/15 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-amber-400" />
              <div>
                <h4 className="text-sm font-semibold text-amber-300">Assign Driver</h4>
                <p className="text-[11px] text-amber-400/70 mt-0.5">This booking requires a driver — select one from available drivers</p>
              </div>
            </div>
            <div className="p-3 space-y-1.5 max-h-52 overflow-y-auto">
              {drivers.filter((d) => d.is_available).length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-3">No available drivers. Mark a driver as available in the Drivers module first.</p>
              ) : (
                drivers.filter((d) => d.is_available).map((driver) => (
                  <button
                    key={driver.id}
                    onClick={() => checkAndAssignDriver(driver.id)}
                    disabled={driverLoading}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-white/8 bg-white/[0.02] hover:border-emerald-500/30 hover:bg-emerald-500/5 text-left transition-all disabled:opacity-40 group"
                  >
                    <div className="w-7 h-7 rounded-full bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center shrink-0">
                      <span className="text-[11px] font-bold text-emerald-400">
                        {driver.full_name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-200 group-hover:text-white transition-colors">{driver.full_name}</p>
                      <p className="text-[11px] text-slate-500 truncate">{driver.phone} · {driver.license_number}</p>
                    </div>
                    {driverLoading
                      ? <Loader2 className="w-3.5 h-3.5 text-slate-500 animate-spin shrink-0" />
                      : <Check className="w-3.5 h-3.5 text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    }
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* Quotes section */}
        {canManageQuotes && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-white">Supplier Quotes ({quotes.length})</h4>
              {booking.status !== 'completed' && booking.status !== 'cancelled' && (
                <button onClick={() => setShowAddQuote(!showAddQuote)} className="btn-secondary text-xs py-1.5 px-3">
                  <Plus className="w-3.5 h-3.5" /> Add Quote
                </button>
              )}
            </div>

            {showAddQuote && (
              <div className="glass rounded-xl p-4 mb-3 border border-white/10 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 mb-1 block">Supplier</label>
                    <select value={newQuote.supplier_id} onChange={(e) => setNewQuote((p) => ({ ...p, supplier_id: e.target.value }))} className="input-dark text-xs">
                      {suppliers.map((s) => <option key={s.id} value={s.id}>{s.company_name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 mb-1 block">Amount (PHP) *</label>
                    <input type="number" min={0} value={newQuote.total_amount} onChange={(e) => setNewQuote((p) => ({ ...p, total_amount: +e.target.value }))}
                      className="input-dark text-xs" />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 mb-1 block">Vehicle Model</label>
                    <input value={newQuote.vehicle_model} onChange={(e) => setNewQuote((p) => ({ ...p, vehicle_model: e.target.value }))}
                      placeholder="e.g. Toyota Camry" className="input-dark text-xs" />
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-400">
                      <input type="checkbox" checked={newQuote.includes_driver} onChange={(e) => setNewQuote((p) => ({ ...p, includes_driver: e.target.checked }))} />
                      Includes driver
                    </label>
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowAddQuote(false)} className="btn-secondary text-xs py-1.5 px-3">Cancel</button>
                  <button onClick={handleAddQuote} disabled={addingQuote || !newQuote.total_amount} className="btn-primary text-xs py-1.5 px-3">
                    {addingQuote ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    Save Quote
                  </button>
                </div>
              </div>
            )}

            {quotes.length === 0 ? (
              <p className="text-xs text-slate-500 py-3 text-center">No quotes added yet.</p>
            ) : (
              <div className="space-y-2">
                {quotes.map((q) => {
                  const supplier = suppliers.find((s) => s.id === q.supplier_id)
                  const isCheapest = q.id === cheapest?.id
                  const isBestValue = q.id === bestValue?.id
                  return (
                    <div key={q.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${q.is_selected ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-white/8 bg-white/[0.02]'}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-xs font-semibold text-slate-200">{supplier?.company_name ?? 'Unknown'}</p>
                          {isCheapest && <Badge variant="success" className="text-[10px] py-0 px-1.5">Cheapest</Badge>}
                          {isBestValue && !isCheapest && <Badge variant="info" className="text-[10px] py-0 px-1.5">Best Value</Badge>}
                          {q.is_selected && <Badge variant="success" className="text-[10px] py-0 px-1.5"><Check className="w-2.5 h-2.5" /> Selected</Badge>}
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-slate-500">
                          {supplier?.rating && (
                            <span className="flex items-center gap-0.5"><Star className="w-2.5 h-2.5 text-amber-400" /> {supplier.rating}</span>
                          )}
                          {q.vehicle_model && <span>{q.vehicle_model}</span>}
                          {q.includes_driver && <span className="text-amber-400">+ driver</span>}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-white">{formatCurrency(q.total_amount)}</p>
                        {booking.budget_usd && (
                          <p className={`text-[10px] ${q.total_amount <= booking.budget_usd ? 'text-emerald-400' : 'text-red-400'}`}>
                            {q.total_amount <= booking.budget_usd ? '✓ in budget' : '⚠ over budget'}
                          </p>
                        )}
                      </div>
                      {!q.is_selected && booking.status !== 'completed' && (
                        <button onClick={() => handleSelectQuote(q.id)} className="btn-secondary text-xs py-1 px-2.5 shrink-0">
                          Select
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Notify Guest ── */}
        {(booking.guest_email || booking.guest_phone || booking.guest_line_id) && booking.status !== 'cancelled' && (
          <div className="border border-white/10 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 bg-white/[0.03] border-b border-white/8 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-white">Notify Guest</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">Send a booking update via email, Viber, or LINE</p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                {booking.guest_email && (
                  <span className="text-[11px] text-slate-400 bg-white/[0.04] px-2 py-1 rounded-lg truncate max-w-[140px]">✉️ {booking.guest_email}</span>
                )}
                {booking.guest_phone && (
                  <span className="text-[11px] text-slate-400 bg-white/[0.04] px-2 py-1 rounded-lg shrink-0">💜🟢 {booking.guest_phone}</span>
                )}
                {booking.guest_line_id && (
                  <span className="text-[11px] text-[#06C755] bg-[#06C755]/10 border border-[#06C755]/20 px-2 py-1 rounded-lg shrink-0">🟢 LINE: {booking.guest_line_id}</span>
                )}
              </div>
            </div>
            <div className="p-4 space-y-3">
              {/* Notify reminder banner */}
              {showNotifyReminder && (
                <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2.5">
                  <span className="text-base leading-none mt-0.5">🔔</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-amber-300">Quote selected — notify the guest!</p>
                    <p className="text-[11px] text-amber-400/70 mt-0.5">Send them a confirmation with the final details.</p>
                  </div>
                  <button
                    onClick={() => { setShowNotifyReminder(false); generateGuestEmail() }}
                    className="shrink-0 text-[11px] font-semibold text-amber-300 bg-amber-500/20 hover:bg-amber-500/30 px-2.5 py-1 rounded-lg transition-colors"
                  >
                    Send now →
                  </button>
                  <button onClick={() => setShowNotifyReminder(false)} className="shrink-0 text-slate-500 hover:text-slate-300 text-xs leading-none">✕</button>
                </div>
              )}

              {/* Email section */}
              {booking.guest_email && (
                <>
                  <button
                    onClick={generateGuestEmail}
                    disabled={guestEmailLoading}
                    className="w-full btn-secondary text-xs py-2 flex items-center justify-center gap-2 disabled:opacity-40"
                  >
                    {guestEmailLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    {guestEmailLoading ? 'Generating…' : quotes.some(q => q.is_selected) ? 'Generate Confirmation Email' : 'Generate Booking Update Email'}
                  </button>

                  {guestEmailDraft ? (
                    <>
                      <div className="bg-black/20 rounded-xl p-3 border border-white/8">
                        <textarea
                          className="w-full text-[11px] text-slate-300 whitespace-pre-wrap font-sans leading-relaxed max-h-40 overflow-y-auto bg-transparent border-none outline-none resize-none"
                          value={guestEmailDraft}
                          onChange={(e) => setGuestEmailDraft(e.target.value)}
                          rows={8}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => navigator.clipboard.writeText(guestEmailDraft).then(() => toast('Copied!', 'success'))}
                          className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5 shrink-0"
                        >
                          <Copy className="w-3.5 h-3.5" /> Copy
                        </button>
                        <button
                          onClick={sendGuestEmail}
                          className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5 flex-1 justify-center"
                        >
                          <Send className="w-3.5 h-3.5" /> Send to Guest
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="text-[11px] text-slate-500 text-center">
                      {quotes.some(q => q.is_selected)
                        ? 'Generates a confirmation email with vehicle and cost details.'
                        : 'Generates an update email letting the guest know their booking is being processed.'}
                    </p>
                  )}
                </>
              )}

              {/* Viber section */}
              {booking.guest_phone && (
                <>
                  {booking.guest_email && <div className="border-t border-white/8 pt-3" />}
                  <button
                    onClick={generateGuestViberDraft}
                    disabled={guestViberLoading}
                    className="w-full text-xs py-2 flex items-center justify-center gap-2 disabled:opacity-40 rounded-xl border border-[#7360f2]/40 bg-[#7360f2]/10 text-[#a99af8] hover:bg-[#7360f2]/20 transition-colors"
                  >
                    {guestViberLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span className="text-sm leading-none">💜</span>}
                    {guestViberLoading ? 'Generating…' : quotes.some(q => q.is_selected) ? 'Generate Viber Confirmation' : 'Generate Viber Update'}
                  </button>

                  {guestViberDraft ? (
                    <>
                      <div className="bg-black/20 rounded-xl p-3 border border-[#7360f2]/20">
                        <textarea
                          className="w-full text-[11px] text-slate-300 whitespace-pre-wrap font-sans leading-relaxed max-h-40 overflow-y-auto bg-transparent border-none outline-none resize-none"
                          value={guestViberDraft}
                          onChange={(e) => setGuestViberDraft(e.target.value)}
                          rows={8}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => navigator.clipboard.writeText(guestViberDraft).then(() => toast('Copied!', 'success'))}
                          className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5 shrink-0"
                        >
                          <Copy className="w-3.5 h-3.5" /> Copy
                        </button>
                        <button
                          onClick={openGuestViber}
                          className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2 px-4 rounded-xl font-semibold transition-colors bg-[#7360f2] hover:bg-[#6350e2] text-white"
                        >
                          <span className="text-sm leading-none">💜</span> Send via Viber
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-500 text-center">
                        Sends automatically if the FleetFlow local server is running.
                      </p>
                    </>
                  ) : (
                    <p className="text-[11px] text-slate-500 text-center">
                      Generates a friendly Viber message to notify the guest directly.
                    </p>
                  )}
                </>
              )}

              {/* ── LINE ── */}
              {(booking.guest_line_id || booking.guest_phone) && (
                <>
                  <div className="border-t border-white/8 pt-3" />
                  <button
                    onClick={generateGuestLineDraft}
                    disabled={guestLineLoading}
                    className="w-full text-xs py-2 flex items-center justify-center gap-2 disabled:opacity-40 rounded-xl border border-[#06C755]/40 bg-[#06C755]/10 text-[#06C755] hover:bg-[#06C755]/20 transition-colors"
                  >
                    {guestLineLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span className="text-sm leading-none">🟢</span>}
                    {guestLineLoading ? 'Generating…' : quotes.some(q => q.is_selected) ? 'Generate LINE Confirmation' : 'Generate LINE Update'}
                  </button>

                  {guestLineDraft ? (
                    <>
                      <div className="bg-black/20 rounded-xl p-3 border border-[#06C755]/20">
                        <textarea
                          className="w-full text-[11px] text-slate-300 whitespace-pre-wrap font-sans leading-relaxed max-h-40 overflow-y-auto bg-transparent border-none outline-none resize-none"
                          value={guestLineDraft}
                          onChange={(e) => setGuestLineDraft(e.target.value)}
                          rows={8}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => navigator.clipboard.writeText(guestLineDraft).then(() => toast('Copied!', 'success'))}
                          className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5 shrink-0"
                        >
                          <Copy className="w-3.5 h-3.5" /> Copy
                        </button>
                        <button
                          onClick={openGuestLine}
                          className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2 px-4 rounded-xl font-semibold transition-colors bg-[#06C755] hover:bg-[#05b34a] text-white"
                        >
                          <span className="text-sm leading-none">🟢</span> Send via LINE
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-500 text-center">
                        Opens LINE with the message pre-filled — just select the guest and tap Send.
                      </p>
                    </>
                  ) : (
                    <p className="text-[11px] text-slate-500 text-center">
                      Generates a friendly LINE message to notify the guest directly.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Contact Supplier ── */}
        <div className="border border-white/10 rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 bg-white/[0.03] border-b border-white/8">
            <h4 className="text-sm font-semibold text-white">Contact Supplier</h4>
            <p className="text-[11px] text-slate-500 mt-0.5">Select a supplier, choose channel, then generate &amp; send</p>
          </div>

          <div className="p-4 space-y-3">
            {suppliers.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-2">No suppliers available. Add suppliers first.</p>
            ) : (
              <>
                {/* Supplier cards */}
                <div className="space-y-1.5 max-h-44 overflow-y-auto pr-0.5">
                  {suppliers.map((s) => {
                    const isSelected = selectedSupplierId === s.id
                    return (
                      <button
                        key={s.id}
                        onClick={() => setSelectedSupplierId(s.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${
                          isSelected
                            ? 'border-fleet-500/50 bg-fleet-500/10'
                            : 'border-white/8 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/15'
                        }`}
                      >
                        {/* Radio dot */}
                        <div className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${
                          isSelected ? 'border-fleet-400' : 'border-slate-600'
                        }`}>
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-fleet-400" />}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-semibold text-slate-200 truncate">{s.company_name}</p>
                            {s.is_preferred && <span className="text-[10px] text-amber-400 shrink-0">⭐ Preferred</span>}
                          </div>
                          <p className="text-[11px] text-slate-500 truncate">{s.contact_person}</p>
                        </div>

                        {/* Contact icons */}
                        <div className="flex gap-2 shrink-0 text-slate-500">
                          <span className="text-[11px]">✉️</span>
                          <span className="text-[11px]">📞</span>
                        </div>
                      </button>
                    )
                  })}
                </div>

                {/* Selected supplier contact info */}
                {selectedSupplier && (
                  <div className="bg-white/[0.03] rounded-xl px-3 py-2 flex items-center gap-4 text-[11px] text-slate-400">
                    <span className="truncate">✉️ {selectedSupplier.email}</span>
                    <span className="shrink-0">📞 {selectedSupplier.phone}</span>
                  </div>
                )}

                {/* Channel tabs */}
                <div className="flex gap-1 bg-white/5 p-1 rounded-xl">
                  <button
                    onClick={() => setContactTab('email')}
                    className={`flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-lg transition-all ${contactTab === 'email' ? 'bg-fleet-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    <Mail className="w-3.5 h-3.5" /> Email
                  </button>
                  <button
                    onClick={() => setContactTab('viber')}
                    className={`flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-lg transition-all ${contactTab === 'viber' ? 'bg-[#7360f2] text-white font-medium' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    <span className="text-sm leading-none">💜</span> Viber
                  </button>
                </div>

                {/* Generate button */}
                <button
                  onClick={generateDrafts}
                  disabled={aiLoading || !selectedSupplier}
                  className="w-full btn-secondary text-xs py-2 flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  {aiLoading ? 'Generating…' : `Generate ${contactTab === 'email' ? 'Email' : 'Viber'} Message`}
                </button>

                {/* Draft preview */}
                {currentDraft ? (
                  <div className="bg-black/20 rounded-xl p-3 border border-white/8">
                    <textarea
                      className="w-full text-[11px] text-slate-300 whitespace-pre-wrap font-sans leading-relaxed max-h-40 overflow-y-auto bg-transparent border-none outline-none resize-none"
                      value={currentDraft}
                      onChange={(e) => contactTab === 'email' ? setEmailDraft(e.target.value) : setViberDraft(e.target.value)}
                      rows={8}
                    />
                  </div>
                ) : (
                  <div className="bg-white/[0.02] rounded-xl p-3 border border-white/5 text-center">
                    <p className="text-xs text-slate-500">
                      {contactTab === 'email'
                        ? 'Generates a formal email with full booking details.'
                        : 'Generates a short, friendly Viber message.'}
                    </p>
                  </div>
                )}

                {/* Send buttons */}
                <div className="flex gap-2">
                  {currentDraft && (
                    <button
                      onClick={() => navigator.clipboard.writeText(currentDraft).then(() => toast('Copied!', 'success'))}
                      className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5 shrink-0"
                    >
                      <Copy className="w-3.5 h-3.5" /> Copy
                    </button>
                  )}
                  {contactTab === 'email' ? (
                    <button
                      onClick={sendViaEmail}
                      disabled={!emailDraft || !selectedSupplier}
                      className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5 flex-1 justify-center disabled:opacity-40"
                    >
                      <Send className="w-3.5 h-3.5" /> Send via Email
                    </button>
                  ) : (
                    <button
                      onClick={openViber}
                      disabled={!selectedSupplier}
                      className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2 px-4 rounded-xl font-semibold transition-colors bg-[#7360f2] hover:bg-[#6350e2] text-white disabled:opacity-40"
                    >
                      <span className="text-sm leading-none">💜</span> Send via Viber
                    </button>
                  )}
                </div>

                {contactTab === 'viber' && currentDraft && (
                  <p className="text-[11px] text-slate-500 text-center">
                    Click Send via Viber — message will be sent automatically.
                  </p>
                )}
              </>
            )}
          </div>
        </div>

      </div>

      {/* Driver conflict warning modal */}
      {conflictWarning && (
        <Modal
          open={!!conflictWarning}
          onClose={() => setConflictWarning(null)}
          title="Driver Scheduling Conflict"
          subtitle="This driver is already booked during an overlapping time window"
          size="sm"
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-3">
              <span className="text-base leading-none mt-0.5">⚠️</span>
              <p className="text-xs text-amber-300 leading-relaxed">
                This driver has {conflictWarning.conflicts.length} overlapping booking{conflictWarning.conflicts.length > 1 ? 's' : ''} during this trip's time window. Assigning them may cause a scheduling conflict.
              </p>
            </div>

            <div className="space-y-2">
              {conflictWarning.conflicts.map((c) => (
                <div key={c.reference_number} className="bg-white/[0.03] rounded-xl px-3 py-2.5 border border-white/8">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="text-xs font-semibold text-slate-200">{c.reference_number}</span>
                    <span className="text-[11px] text-slate-400">{c.guest_name}</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {formatDateTime(c.pickup_datetime)} → {c.dropoff_datetime ? formatDateTime(c.dropoff_datetime) : '~4 h'}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex gap-2 justify-end">
              <button onClick={() => setConflictWarning(null)} className="btn-secondary">
                Go Back
              </button>
              <button
                onClick={async () => {
                  const id = conflictWarning.driverId
                  setConflictWarning(null)
                  await doAssignDriver(id)
                }}
                disabled={driverLoading}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm border border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-all disabled:opacity-50"
              >
                {driverLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Assign Anyway
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Complete booking modal */}
      {showCompleteModal && (
        <Modal
          open={showCompleteModal}
          onClose={() => setShowCompleteModal(false)}
          title="Mark as Completed"
          subtitle={`${booking.reference_number} · ${booking.guest_name}`}
          size="sm"
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-xs text-emerald-300 leading-relaxed">
                This confirms the trip has been delivered and the service is done. The booking will be moved to Completed and cannot be changed afterwards.
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCompleteModal(false)} className="btn-secondary">
                Not Yet
              </button>
              <button
                onClick={handleComplete}
                disabled={completeLoading}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all disabled:opacity-50"
              >
                {completeLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Confirm Completion
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Cancel booking modal */}
      {showCancelModal && (
        <Modal
          open={showCancelModal}
          onClose={() => setShowCancelModal(false)}
          title="Cancel Booking"
          subtitle={`${booking.reference_number} · ${booking.guest_name}`}
          size="sm"
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-3">
              <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-300 leading-relaxed">
                This will cancel the booking and notify the guest by email. This action cannot be undone.
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
              <button onClick={() => setShowCancelModal(false)} className="btn-secondary">
                Keep Booking
              </button>
              <button
                onClick={handleCancel}
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
    </Modal>
  )
}
