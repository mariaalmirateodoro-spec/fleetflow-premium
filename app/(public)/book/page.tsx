'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { LocationInput } from '@/components/ui/LocationInput'

type VehicleType = 'sedan' | 'suv' | 'van' | 'minibus' | 'luxury' | 'pickup'

const vehicleLabels: Record<VehicleType, string> = {
  sedan: 'Sedan',
  suv: 'SUV',
  van: 'Van',
  minibus: 'Minibus',
  luxury: 'Luxury / VIP',
  pickup: 'Pickup Truck',
}

const vehicleEmojis: Record<VehicleType, string> = {
  sedan: '🚗',
  suv: '🚙',
  van: '🚐',
  minibus: '🚌',
  luxury: '🏎️',
  pickup: '🛻',
}

function BookingForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    vehicle_type: (searchParams.get('type') ?? 'sedan') as VehicleType,
    guest_name: '',
    guest_nationality: '',
    guest_count: '1',
    guest_phone: '',
    guest_email: '',
    guest_line_id: '',
    pickup_location: '',
    dropoff_location: '',
    pickup_date: '',
    pickup_time: '08:00',
    dropoff_date: '',
    rental_duration: '',
    rental_duration_unit: 'days' as 'hours' | 'days',
    driver_required: true,
    special_requests: '',
  })

  useEffect(() => {
    const t = searchParams.get('type') as VehicleType
    if (t && vehicleLabels[t]) setForm((f) => ({ ...f, vehicle_type: t }))
  }, [searchParams])

  // Email verification — required before a real submit, not required for drafts.
  const [emailVerified, setEmailVerified] = useState(false)
  const [codeSent, setCodeSent] = useState(false)
  const [verifyCode, setVerifyCode] = useState('')
  const [sendingCode, setSendingCode] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState('')
  const [verifyInfo, setVerifyInfo] = useState('')

  // Returning-guest recognition — only checked after email verification
  // succeeds, so we never hand back a past guest's details to someone who
  // merely typed their email address.
  const [returningGuest, setReturningGuest] = useState<{
    guest_name: string
    guest_nationality: string
    guest_phone: string
    vehicle_type: VehicleType
  } | null>(null)
  const [returningDismissed, setReturningDismissed] = useState(false)

  const set = (key: string, value: string | boolean) => {
    // Changing the email after it's been verified invalidates that verification.
    if (key === 'guest_email' && value !== form.guest_email) {
      setEmailVerified(false)
      setCodeSent(false)
      setVerifyCode('')
      setVerifyError('')
      setVerifyInfo('')
      setReturningGuest(null)
      setReturningDismissed(false)
    }
    setForm((f) => ({ ...f, [key]: value }))
  }

  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.guest_email)

  async function handleSendCode() {
    setVerifyError('')
    setVerifyInfo('')
    setSendingCode(true)
    try {
      const res = await fetch('/api/public/verify-email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.guest_email }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not send verification code.')
      setCodeSent(true)
      setVerifyInfo('Code sent! Check your inbox (and spam folder).')
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSendingCode(false)
    }
  }

  async function handleVerifyCode() {
    setVerifyError('')
    setVerifying(true)
    try {
      const res = await fetch('/api/public/verify-email/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.guest_email, code: verifyCode }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Incorrect code.')
      setEmailVerified(true)
      setVerifyInfo('')
      checkReturningGuest()
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setVerifying(false)
    }
  }

  // Only ever called right after a successful email verification — see the
  // API route for why that ordering matters (it won't return anyone's data
  // for an unverified email).
  async function checkReturningGuest() {
    try {
      const res = await fetch('/api/public/returning-guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.guest_email }),
      })
      const json = await res.json()
      if (res.ok && json.returning) setReturningGuest(json.previous)
    } catch {
      // Non-critical — silently skip the "welcome back" convenience if this fails.
    }
  }

  function applyReturningGuestDetails() {
    if (!returningGuest) return
    setForm((f) => ({
      ...f,
      guest_name: f.guest_name || returningGuest.guest_name || f.guest_name,
      guest_nationality: f.guest_nationality || returningGuest.guest_nationality || f.guest_nationality,
      guest_phone: f.guest_phone || returningGuest.guest_phone || f.guest_phone,
      vehicle_type: returningGuest.vehicle_type ?? f.vehicle_type,
    }))
    setReturningDismissed(true)
  }

  const [draftLoading, setDraftLoading] = useState(false)

  function buildBody() {
    const pickup_datetime = form.pickup_date && form.pickup_time
      ? new Date(`${form.pickup_date}T${form.pickup_time}`).toISOString()
      : null

    let dropoff_datetime: string | null = null
    if (form.dropoff_date) {
      dropoff_datetime = new Date(`${form.dropoff_date}T12:00`).toISOString()
    } else if (form.rental_duration && pickup_datetime) {
      const durationMs = parseInt(form.rental_duration) *
        (form.rental_duration_unit === 'hours' ? 3_600_000 : 86_400_000)
      dropoff_datetime = new Date(new Date(pickup_datetime).getTime() + durationMs).toISOString()
    }

    const durationNote = form.rental_duration
      ? `Rental duration: ${form.rental_duration} ${form.rental_duration_unit}`
      : ''
    const specialRequests = [durationNote, form.special_requests].filter(Boolean).join('\n') || null

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
      dropoff_datetime,
      vehicle_type: form.vehicle_type,
      driver_required: form.driver_required,
      special_requests: specialRequests,
    }
  }

  // "Save & finish later" — a button (type="button"), so it never triggers the
  // form's native required-field validation. The API accepts a partial payload
  // when is_draft is true.
  const handleSaveDraft = async () => {
    setError('')

    if (!emailLooksValid) {
      setError('Please enter a valid email address before saving a draft — we\'ll send you a link back to it.')
      return
    }

    setDraftLoading(true)
    try {
      const res = await fetch('/api/public/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...buildBody(), is_draft: true }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Something went wrong')
      router.push(`/book/confirmation?ref=${json.reference_number}&draft=1`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setDraftLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!emailVerified) {
      setError('Please verify your email address before submitting your booking.')
      return
    }

    setLoading(true)

    try {
      const pickup_datetime = form.pickup_date && form.pickup_time
        ? new Date(`${form.pickup_date}T${form.pickup_time}`).toISOString()
        : null

      // Compute dropoff_datetime: explicit date takes priority, else derive from duration
      let dropoff_datetime: string | null = null
      if (form.dropoff_date) {
        dropoff_datetime = new Date(`${form.dropoff_date}T12:00`).toISOString()
      } else if (form.rental_duration && pickup_datetime) {
        const durationMs = parseInt(form.rental_duration) *
          (form.rental_duration_unit === 'hours' ? 3_600_000 : 86_400_000)
        dropoff_datetime = new Date(new Date(pickup_datetime).getTime() + durationMs).toISOString()
      }

      // Prepend rental duration note to special_requests for staff visibility
      const durationNote = form.rental_duration
        ? `Rental duration: ${form.rental_duration} ${form.rental_duration_unit}`
        : ''
      const specialRequests = [durationNote, form.special_requests].filter(Boolean).join('\n') || null

      const res = await fetch('/api/public/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guest_name: form.guest_name,
          guest_nationality: form.guest_nationality,
          guest_count: parseInt(form.guest_count),
          guest_phone: form.guest_phone,
          guest_email: form.guest_email,
          guest_line_id: form.guest_line_id || null,
          pickup_location: form.pickup_location,
          dropoff_location: form.dropoff_location,
          pickup_datetime,
          dropoff_datetime,
          vehicle_type: form.vehicle_type,
          driver_required: form.driver_required,
          special_requests: specialRequests,
        }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Something went wrong')
      router.push(`/book/confirmation?ref=${json.reference_number}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  const inputCls =
    'w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-fleet-500 focus:bg-white/8 transition-colors text-sm'
  const labelCls = 'block text-sm font-medium text-slate-300 mb-1.5'

  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      {/* Header */}
      <div className="mb-10">
        <Link href="/fleet" className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white text-sm transition-colors mb-6">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
          </svg>
          Back to fleet
        </Link>
        <h1 className="font-display font-extrabold text-3xl text-white mb-2">
          Book your ride
        </h1>
        <p className="text-slate-400 text-sm">
          Fill in the details below and our team will confirm your booking shortly.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">

        {/* Vehicle type */}
        <div className="p-5 rounded-2xl border border-white/8 bg-white/3">
          <h2 className="font-semibold text-white mb-4">Vehicle type</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {(Object.keys(vehicleLabels) as VehicleType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => set('vehicle_type', t)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-sm font-medium transition-all ${
                  form.vehicle_type === t
                    ? 'border-fleet-500 bg-fleet-600/20 text-white shadow-fleet'
                    : 'border-white/8 bg-white/3 text-slate-400 hover:border-white/20 hover:text-white'
                }`}
              >
                <span className="text-2xl">{vehicleEmojis[t]}</span>
                {vehicleLabels[t]}
              </button>
            ))}
          </div>
        </div>

        {/* Trip details */}
        <div className="p-5 rounded-2xl border border-white/8 bg-white/3 space-y-4">
          <h2 className="font-semibold text-white">Trip details</h2>

          <div>
            <label className={labelCls}>Pickup location *</label>
            <LocationInput
              required
              inputClassName={inputCls}
              placeholder="e.g. NAIA Terminal 3, Manila"
              value={form.pickup_location}
              onChange={(v) => set('pickup_location', v)}
            />
          </div>

          <div>
            <label className={labelCls}>Drop-off location *</label>
            <LocationInput
              required
              inputClassName={inputCls}
              placeholder="e.g. Makati CBD, BGC office"
              value={form.dropoff_location}
              onChange={(v) => set('dropoff_location', v)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Pickup date *</label>
              <input
                required
                type="date"
                min={new Date().toISOString().split('T')[0]}
                className={inputCls}
                value={form.pickup_date}
                onChange={(e) => set('pickup_date', e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Pickup time *</label>
              <input
                required
                type="time"
                className={inputCls}
                value={form.pickup_time}
                onChange={(e) => set('pickup_time', e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Drop-off date (optional)</label>
            <input
              type="date"
              min={form.pickup_date || new Date().toISOString().split('T')[0]}
              className={inputCls}
              value={form.dropoff_date}
              onChange={(e) => set('dropoff_date', e.target.value)}
            />
          </div>

          {/* Rental duration */}
          <div>
            <label className={labelCls}>
              Rental duration <span className="text-slate-500 font-normal">(optional)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                min="1"
                max="365"
                className={inputCls}
                placeholder="e.g. 3"
                value={form.rental_duration}
                onChange={(e) => set('rental_duration', e.target.value)}
              />
              <div className="flex rounded-xl border border-white/10 overflow-hidden flex-shrink-0">
                {(['hours', 'days'] as const).map((unit) => (
                  <button
                    key={unit}
                    type="button"
                    onClick={() => set('rental_duration_unit', unit)}
                    className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                      form.rental_duration_unit === unit
                        ? 'bg-fleet-600 text-white'
                        : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {unit.charAt(0).toUpperCase() + unit.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-1.5">
              We'll use this to estimate your drop-off time if no date is selected above.
            </p>
          </div>

          {/* Driver toggle */}
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-sm font-medium text-white">Driver required</p>
              <p className="text-xs text-slate-500 mt-0.5">Include a professional driver with your booking</p>
            </div>
            <button
              type="button"
              onClick={() => set('driver_required', !form.driver_required)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                form.driver_required ? 'bg-fleet-600' : 'bg-white/15'
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  form.driver_required ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Contact info — moved ahead of Passenger info so email verification
            (and the "welcome back, reuse your details?" prompt) happens
            before the guest has to manually retype their name/nationality. */}
        <div className="p-5 rounded-2xl border border-white/8 bg-white/3 space-y-4">
          <h2 className="font-semibold text-white">Contact information</h2>
          <p className="text-slate-500 text-xs -mt-1">So we can confirm your booking and send updates.</p>

          <div>
            <label className={labelCls}>Phone number *</label>
            <input
              required
              type="tel"
              className={inputCls}
              placeholder="+63 917 123 4567"
              value={form.guest_phone}
              onChange={(e) => set('guest_phone', e.target.value)}
            />
          </div>

          <div>
            <label className={labelCls}>Email address *</label>
            <div className="flex gap-2">
              <input
                required
                type="email"
                className={inputCls + ' flex-1'}
                placeholder="john@example.com"
                value={form.guest_email}
                onChange={(e) => set('guest_email', e.target.value)}
                disabled={emailVerified}
              />
              {emailVerified ? (
                <span className="shrink-0 inline-flex items-center gap-1.5 px-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-sm font-medium">
                  ✓ Verified
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleSendCode}
                  disabled={!emailLooksValid || sendingCode}
                  className="shrink-0 px-4 rounded-xl border border-white/15 bg-white/5 text-slate-200 text-sm font-medium hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sendingCode ? 'Sending…' : codeSent ? 'Resend code' : 'Send code'}
                </button>
              )}
            </div>

            {!emailVerified && codeSent && (
              <div className="flex gap-2 mt-2">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  className={inputCls + ' flex-1'}
                  placeholder="Enter 6-digit code"
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                />
                <button
                  type="button"
                  onClick={handleVerifyCode}
                  disabled={verifyCode.length !== 6 || verifying}
                  className="shrink-0 px-4 rounded-xl bg-gradient-fleet text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {verifying ? 'Verifying…' : 'Verify'}
                </button>
              </div>
            )}

            {verifyInfo && <p className="text-emerald-400 text-xs mt-1.5">{verifyInfo}</p>}
            {verifyError && <p className="text-red-400 text-xs mt-1.5">{verifyError}</p>}

            {returningGuest && !returningDismissed && (
              <div className="mt-3 p-3.5 rounded-xl border border-fleet-500/25 bg-fleet-500/8 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-white">👋 Welcome back!</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Want to reuse your details from last time ({returningGuest.guest_name})?
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={applyReturningGuestDetails}
                    className="px-3 py-1.5 rounded-lg bg-fleet-600 text-white text-xs font-semibold hover:bg-fleet-500 transition-colors"
                  >
                    Yes, autofill
                  </button>
                  <button
                    type="button"
                    onClick={() => setReturningDismissed(true)}
                    className="px-3 py-1.5 rounded-lg border border-white/15 text-slate-400 text-xs hover:text-white transition-colors"
                  >
                    No thanks
                  </button>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className={labelCls} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: '#06C755' }}>LINE</span> ID or phone
              <span className="text-slate-500 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              className={inputCls}
              placeholder="LINE username or +63 9XX XXX XXXX"
              value={form.guest_line_id}
              onChange={(e) => set('guest_line_id', e.target.value)}
            />
            <p className="text-xs text-slate-500 mt-1.5">We'll send booking updates via LINE if provided.</p>
          </div>
        </div>

        {/* Passenger info */}
        <div className="p-5 rounded-2xl border border-white/8 bg-white/3 space-y-4">
          <h2 className="font-semibold text-white">Passenger information</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Full name *</label>
              <input
                required
                className={inputCls}
                placeholder="e.g. John Smith"
                value={form.guest_name}
                onChange={(e) => set('guest_name', e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Nationality *</label>
              <input
                required
                className={inputCls}
                placeholder="e.g. American"
                value={form.guest_nationality}
                onChange={(e) => set('guest_nationality', e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Number of passengers *</label>
            <select
              required
              className={inputCls}
              value={form.guest_count}
              onChange={(e) => set('guest_count', e.target.value)}
            >
              {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n} className="bg-[#1a2035]">
                  {n} {n === 1 ? 'passenger' : 'passengers'}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Special requests */}
        <div>
          <label className={labelCls}>Special requests (optional)</label>
          <textarea
            rows={3}
            className={inputCls + ' resize-none'}
            placeholder="Any special requirements, luggage details, accessibility needs..."
            value={form.special_requests}
            onChange={(e) => set('special_requests', e.target.value)}
          />
        </div>

        {/* Error */}
        {error && (
          <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Submit */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={loading || draftLoading}
            className="sm:w-auto w-full py-3.5 px-6 rounded-xl border border-white/15 bg-white/5 text-slate-200 font-semibold text-sm hover:bg-white/10 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {draftLoading ? (
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : '📝'}
            Save & finish later
          </button>

          <button
            type="submit"
            disabled={loading || draftLoading}
            className="flex-1 py-3.5 rounded-xl bg-gradient-fleet text-white font-semibold text-base shadow-fleet hover:shadow-fleet-lg transition-all hover:scale-[1.01] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Submitting request…
              </>
            ) : (
              <>
                Submit booking request
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                  <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
                </svg>
              </>
            )}
          </button>
        </div>

        <p className="text-center text-slate-500 text-xs">
          By submitting, you agree to our{' '}
          <Link href="/terms" className="underline hover:text-slate-300 transition-colors">Terms of Service</Link>
          {' '}and{' '}
          <Link href="/privacy" className="underline hover:text-slate-300 transition-colors">Privacy Policy</Link>.
          Our team will contact you to confirm your booking details.
        </p>
      </form>
    </div>
  )
}

export default function BookPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-fleet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <BookingForm />
    </Suspense>
  )
}
