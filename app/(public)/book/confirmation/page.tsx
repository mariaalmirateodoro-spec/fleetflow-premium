import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Booking Confirmed | FleetFlow Premium',
}

interface Props {
  searchParams: { ref?: string }
}

export default function ConfirmationPage({ searchParams }: Props) {
  const ref = searchParams.ref ?? 'FF-UNKNOWN'

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-6 py-20">
      <div className="max-w-md w-full text-center">
        {/* Success icon */}
        <div className="flex justify-center mb-8">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-fleet-500 to-purple-600 flex items-center justify-center shadow-fleet-lg">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-12 h-12 text-white">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            {/* Pulse rings */}
            <div className="absolute inset-0 rounded-full bg-fleet-500/20 animate-ping" />
          </div>
        </div>

        <h1 className="font-display font-extrabold text-3xl text-white mb-3">
          Request received!
        </h1>
        <p className="text-slate-400 text-base leading-relaxed mb-8">
          Your booking request has been submitted successfully. Our team will review
          it and contact you shortly to confirm.
        </p>

        {/* Reference badge */}
        <div className="inline-flex flex-col items-center gap-1 px-8 py-5 rounded-2xl border border-fleet-500/30 bg-fleet-500/10 mb-8">
          <span className="text-slate-400 text-xs uppercase tracking-widest font-medium">
            Reference number
          </span>
          <span className="font-display font-bold text-2xl text-fleet-300 tracking-wider">
            {ref}
          </span>
        </div>

        <p className="text-slate-500 text-sm mb-6">
          Please save your reference number. You can share it with our team when following up.
        </p>

        {/* Track status link */}
        <Link
          href={`/book/status/${ref}`}
          className="inline-flex items-center gap-2 py-3 px-6 rounded-xl bg-gradient-fleet text-white text-sm font-semibold shadow-fleet hover:shadow-fleet-lg transition-all mb-8"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
          </svg>
          Track your booking status
        </Link>

        {/* What happens next */}
        <div className="text-left p-5 rounded-2xl border border-white/8 bg-white/3 mb-8 space-y-4">
          <h2 className="font-semibold text-white text-sm">What happens next?</h2>
          {[
            { icon: '📞', text: 'Our team will call or email you within 1 hour to confirm availability.' },
            { icon: '✅', text: 'Once confirmed, you\'ll receive a final booking confirmation with driver details.' },
            { icon: '🚗', text: 'Your vehicle and driver will be ready at your pickup location on time.' },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="text-lg flex-shrink-0 mt-0.5">{item.icon}</span>
              <p className="text-slate-400 text-sm leading-relaxed">{item.text}</p>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/fleet"
            className="flex-1 py-2.5 px-4 rounded-xl border border-white/10 bg-white/5 text-white text-sm font-medium hover:bg-white/10 transition-colors text-center"
          >
            Browse more vehicles
          </Link>
          <Link
            href="/book"
            className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-fleet text-white text-sm font-semibold shadow-fleet hover:shadow-fleet-lg transition-all text-center"
          >
            Make another booking
          </Link>
        </div>
      </div>
    </div>
  )
}
