'use client'

import { useState } from 'react'

interface TripFeedbackFormProps {
  referenceNumber: string
  existingRating?: number | null
  existingComment?: string | null
}

export function TripFeedbackForm({
  referenceNumber,
  existingRating = null,
  existingComment = null,
}: TripFeedbackFormProps) {
  const [rating, setRating] = useState(existingRating ?? 0)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState(existingComment ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(!!existingRating)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (rating < 1) {
      setError('Please select a star rating.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/public/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference_number: referenceNumber, rating, comment }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.')
        return
      }
      setSubmitted(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-amber-400 text-base">⭐</span>
        <h2 className="font-semibold text-amber-300 text-sm">Rate Your Trip</h2>
      </div>
      <p className="text-slate-500 text-xs mb-4">Optional — takes 10 seconds.</p>

      <div className="flex gap-1.5 mb-4">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => {
              setRating(n)
              setSubmitted(false)
            }}
            onMouseEnter={() => setHoverRating(n)}
            onMouseLeave={() => setHoverRating(0)}
            className="text-2xl leading-none transition-transform hover:scale-110"
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
          >
            <span className={(hoverRating || rating) >= n ? 'text-amber-400' : 'text-slate-700'}>★</span>
          </button>
        ))}
      </div>

      <textarea
        value={comment}
        onChange={(e) => {
          setComment(e.target.value)
          setSubmitted(false)
        }}
        placeholder="Anything you'd like to share about your trip? (optional)"
        rows={3}
        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/40 mb-3 resize-none"
      />

      {error && <p className="text-red-400 text-xs mb-3">{error}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full py-2.5 px-4 rounded-xl bg-gradient-fleet text-white text-sm font-semibold shadow-fleet hover:shadow-fleet-lg transition-all disabled:opacity-50"
      >
        {submitting ? 'Submitting…' : submitted ? 'Update Rating' : 'Submit Rating'}
      </button>

      {submitted && !error && (
        <p className="text-emerald-400 text-xs text-center mt-3">Thanks for your feedback! ✓</p>
      )}
    </div>
  )
}
