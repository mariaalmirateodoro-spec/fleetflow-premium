'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LocationInput } from '@/components/ui/LocationInput'
import type { Booking } from '@/types'

type VehicleType = 'sedan' | 'suv' | 'van' | 'minibus' | 'luxury' | 'pickup'

const vehicleLabels: Record<VehicleType, string> = {
  sedan: 'Sedan',
  suv: 'SUV',
  van: 'Van',
  minibus: 'Minibus',
  luxury: 'Luxury / VIP',
  pickup: 'Pickup Truck',
}

interface Props {
  booking: Booking
}

// Same fix as BookingModal.tsx: read local wall-clock components off the
// Date object instead of slicing the raw UTC ISO string. The old version
// pulled UTC digits directly, so saving the draft again (even untouched)
// re-interpreted those UTC digits as local time and shifted the real pickup
// time by the guest's timezone offset every time.
function toDateInput(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function toTimeInput(iso: string | null) {
  if (!iso) return '08:00'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '08:00'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function DraftResumeForm({ booking }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    guest_name: booking.guest_name ?? '',
    guest_nationality: booking.guest_nationality ?? '',
    guest_count: String(booking.guest_count ?? 1),
    guest_phone: booking.guest_phone ?? '',
    guest_email: booking.guest_email ?? '',
    guest_line_id: booking.guest_line_id ?? '',
    pickup_location: booking.pickup_location ?? '',
    dropoff_location: booking.dropoff_location ?? '',
    pickup_date: toDateInput(booking.pickup_datetime),
    pickup_time: toTimeInput(booking.pickup_datetime),
    vehicle_type: (booking.vehicle_type ?? 'sedan') as VehicleType,
    driver_required: booking.driver_required ?? true,
    special_requests: booking.special_requests ?? '',
  })

  const set = (key: string, value: string | boolean) => setForm((f) => ({ ...f, [key]: value }))

  function buildBody() {
    const pickup_datetime = form.pickup_date && form.pickup_time
      ? new Date(`${form.pickup_date}T${form.pickup_time}`).toISOString()
      : null
    return {
      guest_name: form.guest_name,
      guest_nationality: form.guest_nationality,
      guest_count: form.guest_count ? parseInt(form.guest_count) : undefined,
      guest_phone: form.guest_phone,
      guest_email: form.guest_email,
      guest_line_id: form.guest_line_id || null,
      pickup_location: form.pickup_location,
      dropoff_location: form.dropoff_location,
      pickup_datetime,
      vehicle_type: form.vehicle_type,
      driver_required: form.driver_required,
      special_requests: form.special_requests || null,
    }
  }

  async function patchDraft(finalize: boolean) {
    setError('')
    finalize ? setLoading(true) : setSavingDraft(true)
    try {
      const res = await fetch(`/api/public/bookings/${booking.reference_number}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...buildBody(), finalize }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Something went wrong')

      if (finalize) {
        router.push(`/book/confirmation?ref=${booking.reference_number}`)
      } else {
        router.refresh()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
      setSavingDraft(false)
    }
  }

  const inputCls =
    'w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-fleet-500 focus:bg-white/8 transition-colors text-sm'
  const labelCls = 'block text-sm font-medium text-slate-300 mb-1.5'

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-6 py-20">
      <div className="max-w-2xl w-full">
        <div className="mb-8 text-center">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-slate-500/30 bg-slate-500/10 text-slate-300 text-sm font-semibold mb-4">
            📝 Draft — Ref: {booking.reference_number}
          </span>
          <h1 className="font-display font-extrabold text-2xl text-white mb-2">
            Finish your booking
          </h1>
          <p className="text-slate-400 text-sm">
            Pick up where you left off. Save again if you're not done, or submit once everything looks right.
          </p>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); patchDraft(true) }} className="space-y-6">
          <div className="p-5 rounded-2xl border border-white/8 bg-white/3">
            <h2 className="font-semibold text-white mb-4">Vehicle type</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {(Object.keys(vehicleLabels) as VehicleType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => set('vehicle_type', t)}
                  className={`p-3 rounded-xl border text-sm font-medium transition-all ${
                    form.vehicle_type === t
                      ? 'border-fleet-500 bg-fleet-600/20 text-white'
                      : 'border-white/8 bg-white/3 text-slate-400 hover:border-white/20 hover:text-white'
                  }`}
                >
                  {vehicleLabels[t]}
                </button>
              ))}
            </div>
          </div>

          <div className="p-5 rounded-2xl border border-white/8 bg-white/3 space-y-4">
            <h2 className="font-semibold text-white">Trip details</h2>
            <div>
              <label className={labelCls}>Pickup location</label>
              <LocationInput inputClassName={inputCls} value={form.pickup_location} onChange={(v) => set('pickup_location', v)} placeholder="e.g. NAIA Terminal 3, Manila" />
            </div>
            <div>
              <label className={labelCls}>Drop-off location</label>
              <LocationInput inputClassName={inputCls} value={form.dropoff_location} onChange={(v) => set('dropoff_location', v)} placeholder="e.g. Makati CBD, BGC office" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Pickup date</label>
                <input type="date" className={inputCls} value={form.pickup_date} onChange={(e) => set('pickup_date', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Pickup time</label>
                <input type="time" className={inputCls} value={form.pickup_time} onChange={(e) => set('pickup_time', e.target.value)} />
              </div>
            </div>
            <div className="flex items-center justify-between py-1">
              <p className="text-sm font-medium text-white">Driver required</p>
              <button
                type="button"
                onClick={() => set('driver_required', !form.driver_required)}
                className={`relative w-12 h-6 rounded-full transition-colors ${form.driver_required ? 'bg-fleet-600' : 'bg-white/15'}`}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.driver_required ? 'translate-x-7' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>

          <div className="p-5 rounded-2xl border border-white/8 bg-white/3 space-y-4">
            <h2 className="font-semibold text-white">Passenger information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Full name</label>
                <input className={inputCls} value={form.guest_name} onChange={(e) => set('guest_name', e.target.value)} placeholder="e.g. John Smith" />
              </div>
              <div>
                <label className={labelCls}>Nationality</label>
                <input className={inputCls} value={form.guest_nationality} onChange={(e) => set('guest_nationality', e.target.value)} placeholder="e.g. American" />
              </div>
            </div>
            <div>
              <label className={labelCls}>Number of passengers</label>
              <select className={inputCls} value={form.guest_count} onChange={(e) => set('guest_count', e.target.value)}>
                {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n} className="bg-[#1a2035]">{n} {n === 1 ? 'passenger' : 'passengers'}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="p-5 rounded-2xl border border-white/8 bg-white/3 space-y-4">
            <h2 className="font-semibold text-white">Contact information</h2>
            <div>
              <label className={labelCls}>Phone number</label>
              <input type="tel" className={inputCls} value={form.guest_phone} onChange={(e) => set('guest_phone', e.target.value)} placeholder="+63 917 123 4567" />
            </div>
            <div>
              <label className={labelCls}>Email address</label>
              <input type="email" className={inputCls} value={form.guest_email} onChange={(e) => set('guest_email', e.target.value)} placeholder="john@example.com" />
            </div>
          </div>

          <div>
            <label className={labelCls}>Special requests (optional)</label>
            <textarea rows={3} className={inputCls + ' resize-none'} value={form.special_requests} onChange={(e) => set('special_requests', e.target.value)} />
          </div>

          {error && (
            <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => patchDraft(false)}
              disabled={loading || savingDraft}
              className="sm:w-auto w-full py-3.5 px-6 rounded-xl border border-white/15 bg-white/5 text-slate-200 font-semibold text-sm hover:bg-white/10 transition-all disabled:opacity-60"
            >
              {savingDraft ? 'Saving…' : '📝 Save draft'}
            </button>
            <button
              type="submit"
              disabled={loading || savingDraft}
              className="flex-1 py-3.5 rounded-xl bg-gradient-fleet text-white font-semibold text-base shadow-fleet hover:shadow-fleet-lg transition-all disabled:opacity-60"
            >
              {loading ? 'Submitting…' : 'Submit booking request'}
            </button>
          </div>

          <p className="text-center text-slate-600 text-xs">
            <Link href="/fleet" className="underline hover:text-slate-400">Browse vehicles</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
