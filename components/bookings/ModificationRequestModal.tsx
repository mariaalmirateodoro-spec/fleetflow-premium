'use client'

import { useState } from 'react'
import { X, Send, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'

interface Props {
  referenceNumber: string
  bookingStatus: string
  hasExistingRequest: boolean
}

export default function ModificationRequestModal({ referenceNumber, bookingStatus, hasExistingRequest }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [pickupDatetime, setPickupDatetime] = useState('')
  const [pickupLocation, setPickupLocation] = useState('')
  const [dropoffLocation, setDropoffLocation] = useState('')
  const [notes, setNotes] = useState('')

  if (bookingStatus !== 'pending' && bookingStatus !== 'approved') return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!pickupDatetime && !pickupLocation && !dropoffLocation && !notes) {
      setError('Please fill in at least one field to request a change.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/bookings/${referenceNumber}/modify-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pickup_datetime: pickupDatetime || undefined,
          pickup_location: pickupLocation || undefined,
          dropoff_location: dropoffLocation || undefined,
          notes: notes || undefined,
        }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to submit request')

      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    setOpen(false)
    setSuccess(false)
    setError(null)
    setPickupDatetime('')
    setPickupLocation('')
    setDropoffLocation('')
    setNotes('')
  }

  return (
    <>
      {hasExistingRequest ? (
        <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center gap-2 text-sm text-amber-400">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>You have a pending modification request. Our team will review it shortly.</span>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="mt-4 w-full text-center text-sm text-indigo-400 hover:text-indigo-300 underline underline-offset-2 transition-colors"
        >
          Request a change to this booking
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Modal */}
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-[#1e2130] border border-white/10 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h2 className="text-lg font-semibold text-white">Request Booking Change</h2>
              <button onClick={handleClose} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {success ? (
              <div className="p-6 text-center">
                <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
                <h3 className="text-white font-semibold text-lg mb-1">Request Submitted</h3>
                <p className="text-slate-400 text-sm">Our team will review your request and get back to you shortly.</p>
                <button
                  onClick={handleClose}
                  className="mt-5 w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="p-5 space-y-4">
                <p className="text-slate-400 text-sm">
                  Fill in only the fields you want to change. Leave others blank.
                </p>

                {/* Pickup Date/Time */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">
                    New Pickup Date &amp; Time
                  </label>
                  <input
                    type="datetime-local"
                    value={pickupDatetime}
                    onChange={(e) => setPickupDatetime(e.target.value)}
                    className="w-full rounded-lg bg-[#0f1117] border border-white/10 text-white placeholder:text-slate-600 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Pickup Location */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">
                    New Pickup Location
                  </label>
                  <input
                    type="text"
                    value={pickupLocation}
                    onChange={(e) => setPickupLocation(e.target.value)}
                    placeholder="Enter new pickup location"
                    className="w-full rounded-lg bg-[#0f1117] border border-white/10 text-white placeholder:text-slate-600 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Dropoff Location */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">
                    New Dropoff Location
                  </label>
                  <input
                    type="text"
                    value={dropoffLocation}
                    onChange={(e) => setDropoffLocation(e.target.value)}
                    placeholder="Enter new dropoff location"
                    className="w-full rounded-lg bg-[#0f1117] border border-white/10 text-white placeholder:text-slate-600 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">
                    Additional Notes
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any other details about your request…"
                    rows={3}
                    className="w-full rounded-lg bg-[#0f1117] border border-white/10 text-white placeholder:text-slate-600 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </div>

                {error && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                    {error}
                  </div>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="flex-1 py-2.5 rounded-lg border border-white/10 text-slate-300 hover:text-white hover:border-white/20 transition-colors text-sm font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-medium text-sm flex items-center justify-center gap-2 transition-colors"
                  >
                    {loading ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
                    ) : (
                      <><Send className="w-4 h-4" /> Submit Request</>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
