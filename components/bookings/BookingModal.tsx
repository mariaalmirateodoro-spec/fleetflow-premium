'use client'

import { useState, useEffect, useRef } from 'react'
import { Loader2, Sparkles, Phone, Mail, MessageCircle, Search, UserCheck } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { LocationInput } from '@/components/ui/LocationInput'
import { vehicleLabels } from '@/lib/utils'
import type { Booking, CreateBookingInput, Profile, Supplier, VehicleType } from '@/types'

const VEHICLE_TYPES: VehicleType[] = ['sedan', 'suv', 'van', 'minibus', 'luxury', 'pickup']

// Converts a stored UTC timestamp into the local wall-clock value a
// <input type="datetime-local"> expects. Using .slice(0, 16) on the raw UTC
// string instead (the old code) grabs the UTC digits as if they were already
// local — so on save, `new Date(value).toISOString()` (which treats the typed
// value as local time) shifts the real pickup/dropoff time by the browser's
// UTC offset EVERY time the form is saved, even if that field was never
// touched. This local-getter-based conversion round-trips correctly instead.
function toLocalInputValue(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

interface Props {
  open: boolean
  onClose: () => void
  booking: Booking | null
  suppliers: Supplier[]
  profile: Profile
  onSuccess: () => void
}

export function BookingModal({ open, onClose, booking, suppliers, profile, onSuccess }: Props) {
  const isEdit = !!booking
  const [loading, setLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiSuggestion, setAiSuggestion] = useState('')

  // Returning-guest search — lets staff pull in a past guest's contact info
  // instead of retyping it, mirroring the autofill guests already get on the
  // public /book page. Only shown when creating a brand-new booking.
  const [guestQuery, setGuestQuery] = useState('')
  const [guestResults, setGuestResults] = useState<{
    guest_name: string
    guest_nationality: string | null
    guest_phone: string | null
    guest_email: string | null
    guest_line_id: string | null
    vehicle_type: VehicleType
  }[]>([])
  const [guestSearchOpen, setGuestSearchOpen] = useState(false)
  const [guestSearching, setGuestSearching] = useState(false)
  const [appliedGuest, setAppliedGuest] = useState<string | null>(null)
  const guestSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [form, setForm] = useState<CreateBookingInput & { special_requests?: string }>({
    guest_name: '',
    guest_nationality: null as string | null,
    guest_count: 1,
    guest_phone: '',
    guest_email: '',
    guest_line_id: '',
    pickup_datetime: '',
    dropoff_datetime: '',
    pickup_location: '',
    dropoff_location: '',
    vehicle_type: 'sedan',
    driver_required: false,
    budget_usd: undefined,
    notes: '',
    special_requests: '',
  })

  useEffect(() => {
    if (booking) {
      setForm({
        guest_name: booking.guest_name,
        guest_nationality: booking.guest_nationality,
        guest_count: booking.guest_count,
        guest_phone: booking.guest_phone ?? '',
        guest_email: booking.guest_email ?? '',
        guest_line_id: booking.guest_line_id ?? '',
        pickup_datetime: toLocalInputValue(booking.pickup_datetime),
        dropoff_datetime: toLocalInputValue(booking.dropoff_datetime),
        pickup_location: booking.pickup_location,
        dropoff_location: booking.dropoff_location,
        vehicle_type: booking.vehicle_type,
        driver_required: booking.driver_required,
        budget_usd: booking.budget_usd ?? undefined,
        notes: booking.notes ?? '',
        special_requests: booking.special_requests ?? '',
      })
    }
  }, [booking])

  function update<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  useEffect(() => {
    if (isEdit) return
    if (guestSearchTimer.current) clearTimeout(guestSearchTimer.current)
    if (guestQuery.trim().length < 2) {
      setGuestResults([])
      setGuestSearchOpen(false)
      return
    }
    guestSearchTimer.current = setTimeout(async () => {
      setGuestSearching(true)
      try {
        const res = await fetch(`/api/bookings/guest-lookup?q=${encodeURIComponent(guestQuery.trim())}`)
        const json = await res.json()
        setGuestResults(json.data ?? [])
        setGuestSearchOpen(true)
      } catch {
        setGuestResults([])
      } finally {
        setGuestSearching(false)
      }
    }, 350)
    return () => {
      if (guestSearchTimer.current) clearTimeout(guestSearchTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guestQuery, isEdit])

  function applyGuest(guest: typeof guestResults[number]) {
    setForm((prev) => ({
      ...prev,
      guest_name: guest.guest_name || prev.guest_name,
      guest_nationality: guest.guest_nationality || prev.guest_nationality,
      guest_phone: guest.guest_phone || prev.guest_phone,
      guest_email: guest.guest_email || prev.guest_email,
      guest_line_id: guest.guest_line_id || prev.guest_line_id,
      vehicle_type: guest.vehicle_type || prev.vehicle_type,
    }))
    setAppliedGuest(guest.guest_name)
    setGuestSearchOpen(false)
    setGuestQuery('')
  }

  async function getAISuggestion() {
    setAiLoading(true)
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'suggest_vehicle', guestCount: form.guest_count, isVIP: false }),
      })
      const data = await res.json()
      if (data.vehicle) {
        setAiSuggestion(`AI suggests: ${vehicleLabels[data.vehicle.type as VehicleType]} — ${data.vehicle.reason}`)
        update('vehicle_type', data.vehicle.type)
      }
    } catch {
      setAiSuggestion('AI unavailable – using mock suggestion')
    }
    setAiLoading(false)
  }

  function buildPayload(isDraft: boolean) {
    return {
      guest_name: form.guest_name || null,
      guest_nationality: form.guest_nationality || null,
      guest_count: form.guest_count,
      guest_phone: form.guest_phone || null,
      guest_email: form.guest_email || null,
      guest_line_id: form.guest_line_id || null,
      pickup_datetime: form.pickup_datetime ? new Date(form.pickup_datetime).toISOString() : null,
      dropoff_datetime: form.dropoff_datetime ? new Date(form.dropoff_datetime).toISOString() : null,
      pickup_location: form.pickup_location || null,
      dropoff_location: form.dropoff_location || null,
      vehicle_type: form.vehicle_type,
      driver_required: form.driver_required,
      budget_usd: form.budget_usd ?? null,
      notes: form.notes || null,
      special_requests: form.special_requests || null,
      is_draft: isDraft,
    }
  }

  // Create/edit go through the API routes (instead of writing to Supabase
  // directly from the browser) so every staff booking action — not just
  // final-cost/driver changes — ends up in the Activity Log.
  async function saveBooking(isDraft: boolean) {
    setLoading(true)
    const payload = buildPayload(isDraft)

    const res = isEdit
      ? await fetch(`/api/bookings/${booking!.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      : await fetch('/api/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

    setLoading(false)
    if (res.ok) {
      onSuccess()
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await saveBooking(false)
  }

  // "Save as Draft" bypasses the form's native required-field validation
  // (button is type="button", so it never triggers HTML5 constraint checks)
  // and is allowed to persist a booking that's still missing information.
  async function handleSaveDraft() {
    await saveBooking(true)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? (booking?.is_draft ? 'Edit Draft Booking' : 'Edit Booking') : 'New Booking'}
      subtitle={booking?.is_draft ? 'This booking is still a draft — fill in the rest, or keep saving as draft.' : 'Fill in the guest transport details'}
      size="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Returning-guest search */}
        {!isEdit && (
          <div className="relative">
            <label className="flex items-center gap-1.5 text-xs text-slate-400 mb-1.5 font-medium">
              <Search className="w-3 h-3" /> Search past guest
            </label>
            <input
              value={guestQuery}
              onChange={(e) => { setGuestQuery(e.target.value); setAppliedGuest(null) }}
              onFocus={() => { if (guestResults.length) setGuestSearchOpen(true) }}
              placeholder="Type a name, phone, or email to reuse their details…"
              className="input-dark"
            />
            {guestSearching && (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500 absolute right-3 top-[34px]" />
            )}
            {guestSearchOpen && guestResults.length > 0 && (
              <div className="absolute z-20 mt-1 w-full rounded-xl border border-white/10 bg-[#141a2e] shadow-2xl max-h-64 overflow-y-auto">
                {guestResults.map((g, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => applyGuest(g)}
                    className="w-full text-left px-3 py-2 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
                  >
                    <p className="text-sm text-white font-medium">{g.guest_name}</p>
                    <p className="text-[11px] text-slate-500">
                      {[g.guest_phone, g.guest_email, g.guest_nationality].filter(Boolean).join(' · ')}
                    </p>
                  </button>
                ))}
              </div>
            )}
            {guestSearchOpen && !guestSearching && guestResults.length === 0 && guestQuery.trim().length >= 2 && (
              <div className="absolute z-20 mt-1 w-full rounded-xl border border-white/10 bg-[#141a2e] shadow-2xl px-3 py-2.5 text-xs text-slate-500">
                No past guest matches "{guestQuery.trim()}"
              </div>
            )}
            {appliedGuest && (
              <p className="flex items-center gap-1.5 text-[11px] text-emerald-400 mt-1.5">
                <UserCheck className="w-3 h-3" /> Filled in details from {appliedGuest}'s last booking
              </p>
            )}
          </div>
        )}

        {/* Guest info */}
        <div>
          <label className="block text-xs text-slate-400 mb-1.5 font-medium">Guest Name *</label>
          <input value={form.guest_name} onChange={(e) => update('guest_name', e.target.value)}
            placeholder="Full name" required className="input-dark" />
        </div>

        {/* Contact info */}
        <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3 space-y-3">
          <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Guest Contact</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="flex items-center gap-1.5 text-xs text-slate-400 mb-1.5 font-medium">
                <Phone className="w-3 h-3" /> Phone
              </label>
              <input
                value={form.guest_phone ?? ''}
                onChange={(e) => update('guest_phone', e.target.value)}
                placeholder="+63 9XX XXX XXXX"
                className="input-dark"
              />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs text-slate-400 mb-1.5 font-medium">
                <Mail className="w-3 h-3" /> Email
              </label>
              <input
                type="email"
                value={form.guest_email ?? ''}
                onChange={(e) => update('guest_email', e.target.value)}
                placeholder="guest@email.com"
                className="input-dark"
              />
            </div>
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-xs text-slate-400 mb-1.5 font-medium">
              <MessageCircle className="w-3 h-3 text-[#06C755]" />
              <span className="text-[#06C755]">LINE</span> ID or Phone
            </label>
            <input
              value={form.guest_line_id ?? ''}
              onChange={(e) => update('guest_line_id', e.target.value)}
              placeholder="LINE username or +63 9XX XXX XXXX"
              className="input-dark"
            />
            <p className="text-[10px] text-slate-500 mt-1">Used to send booking updates via LINE</p>
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5 font-medium">Pickup Date & Time *</label>
            <input type="datetime-local" value={form.pickup_datetime} onChange={(e) => update('pickup_datetime', e.target.value)}
              required className="input-dark" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5 font-medium">Dropoff (optional)</label>
            <input type="datetime-local" value={form.dropoff_datetime ?? ''} onChange={(e) => update('dropoff_datetime', e.target.value)}
              className="input-dark" />
          </div>
        </div>

        {/* Locations */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5 font-medium">Pickup Location *</label>
            <LocationInput
              value={form.pickup_location}
              onChange={(v) => update('pickup_location', v)}
              placeholder="e.g. JFK International Airport"
              required
              inputClassName="input-dark"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5 font-medium">Dropoff Location *</label>
            <LocationInput
              value={form.dropoff_location}
              onChange={(v) => update('dropoff_location', v)}
              placeholder="e.g. Midtown Hotel"
              required
              inputClassName="input-dark"
            />
          </div>
        </div>

        {/* Vehicle & AI */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5 font-medium">Guest Count *</label>
            <input type="number" min={1} max={50} value={form.guest_count} onChange={(e) => update('guest_count', +e.target.value)}
              className="input-dark" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-slate-400 font-medium">Vehicle Type *</label>
              <button type="button" onClick={getAISuggestion} disabled={aiLoading}
                className="flex items-center gap-1 text-[10px] text-fleet-400 hover:text-fleet-300 transition-colors">
                {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                AI suggest
              </button>
            </div>
            <select value={form.vehicle_type} onChange={(e) => update('vehicle_type', e.target.value as VehicleType)} className="input-dark">
              {VEHICLE_TYPES.map((v) => <option key={v} value={v}>{vehicleLabels[v]}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5 font-medium">Budget (PHP)</label>
            <input type="number" min={0} value={form.budget_usd ?? ''} onChange={(e) => update('budget_usd', e.target.value ? +e.target.value : undefined)}
              placeholder="Optional" className="input-dark" />
          </div>
        </div>

        {aiSuggestion && (
          <div className="bg-fleet-500/10 border border-fleet-500/20 rounded-xl px-3 py-2 text-xs text-fleet-300 flex items-start gap-2">
            <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            {aiSuggestion}
          </div>
        )}

        {/* Driver & Notes */}
        <div className="flex items-center gap-3 py-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <div className="relative">
              <input type="checkbox" checked={form.driver_required} onChange={(e) => update('driver_required', e.target.checked)}
                className="sr-only peer" />
              <div className="w-8 h-4 bg-white/10 rounded-full peer-checked:bg-fleet-600 transition-colors" />
              <div className="absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform peer-checked:translate-x-4" />
            </div>
            <span className="text-xs text-slate-300">Driver Required</span>
          </label>
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1.5 font-medium">Notes</label>
          <textarea value={form.notes ?? ''} onChange={(e) => update('notes', e.target.value)}
            placeholder="Any additional information…" rows={2} className="input-dark resize-none" />
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1.5 font-medium">Special Requests</label>
          <textarea value={form.special_requests ?? ''} onChange={(e) => update('special_requests', e.target.value)}
            placeholder="e.g. Child seat, wheelchair accessible, multilingual driver…" rows={2} className="input-dark resize-none" />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-white/8">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="button" onClick={handleSaveDraft} disabled={loading} className="btn-secondary">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Save as Draft
          </button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading ? 'Saving…' : isEdit ? 'Update Booking' : 'Create Booking'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
