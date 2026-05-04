'use client'

import { useState, useEffect } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { createClient } from '@/lib/supabase/client'
import { vehicleLabels } from '@/lib/utils'
import type { Booking, CreateBookingInput, Profile, Supplier, VehicleType } from '@/types'

const VEHICLE_TYPES: VehicleType[] = ['sedan', 'suv', 'van', 'minibus', 'luxury', 'pickup']
const NATIONALITIES = ['Japanese', 'Chinese', 'Korean', 'American', 'British', 'German', 'French', 'Australian', 'Canadian', 'Indian', 'UAE', 'Saudi', 'Mexican', 'Egyptian', 'Other']

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
  const [form, setForm] = useState<CreateBookingInput & { special_requests?: string }>({
    guest_name: '',
    guest_nationality: 'Japanese',
    guest_count: 1,
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
        pickup_datetime: booking.pickup_datetime?.slice(0, 16) ?? '',
        dropoff_datetime: booking.dropoff_datetime?.slice(0, 16) ?? '',
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const supabase = createClient()
    const payload = {
      guest_name: form.guest_name,
      guest_nationality: form.guest_nationality,
      guest_count: form.guest_count,
      pickup_datetime: new Date(form.pickup_datetime).toISOString(),
      dropoff_datetime: form.dropoff_datetime ? new Date(form.dropoff_datetime).toISOString() : null,
      pickup_location: form.pickup_location,
      dropoff_location: form.dropoff_location,
      vehicle_type: form.vehicle_type,
      driver_required: form.driver_required,
      budget_usd: form.budget_usd ?? null,
      notes: form.notes || null,
      special_requests: form.special_requests || null,
    }

    let error
    if (isEdit) {
      ;({ error } = await supabase.from('bookings').update(payload).eq('id', booking!.id))
    } else {
      ;({ error } = await supabase.from('bookings').insert({ ...payload, created_by: profile.id }))
    }

    setLoading(false)
    if (!error) {
      onSuccess()
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Booking' : 'New Booking'} subtitle="Fill in the guest transport details" size="2xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Guest info */}
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-xs text-slate-400 mb-1.5 font-medium">Guest Name *</label>
            <input value={form.guest_name} onChange={(e) => update('guest_name', e.target.value)}
              placeholder="Full name" required className="input-dark" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5 font-medium">Nationality *</label>
            <select value={form.guest_nationality} onChange={(e) => update('guest_nationality', e.target.value)} className="input-dark">
              {NATIONALITIES.map((n) => <option key={n}>{n}</option>)}
            </select>
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-3">
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
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5 font-medium">Pickup Location *</label>
            <input value={form.pickup_location} onChange={(e) => update('pickup_location', e.target.value)}
              placeholder="e.g. JFK International Airport" required className="input-dark" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5 font-medium">Dropoff Location *</label>
            <input value={form.dropoff_location} onChange={(e) => update('dropoff_location', e.target.value)}
              placeholder="e.g. Midtown Hotel" required className="input-dark" />
          </div>
        </div>

        {/* Vehicle & AI */}
        <div className="grid grid-cols-3 gap-3">
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
            <label className="block text-xs text-slate-400 mb-1.5 font-medium">Budget (USD)</label>
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
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading ? 'Saving…' : isEdit ? 'Update Booking' : 'Create Booking'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
