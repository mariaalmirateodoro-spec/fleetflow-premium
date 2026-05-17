import Link from 'next/link'

export default function BookingNotFound() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-6 py-20">
      <div className="max-w-md w-full text-center">
        <div className="flex justify-center mb-8">
          <div className="w-24 h-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-10 h-10 text-slate-500">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
            </svg>
          </div>
        </div>

        <h1 className="font-display font-extrabold text-2xl text-white mb-3">
          Booking not found
        </h1>
        <p className="text-slate-400 text-sm leading-relaxed mb-8">
          We couldn&apos;t find a booking with that reference number. Please double-check
          the reference and try again.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/book"
            className="py-2.5 px-6 rounded-xl bg-gradient-fleet text-white text-sm font-semibold shadow-fleet hover:shadow-fleet-lg transition-all text-center"
          >
            Make a booking
          </Link>
          <Link
            href="/"
            className="py-2.5 px-6 rounded-xl border border-white/10 bg-white/5 text-white text-sm font-medium hover:bg-white/10 transition-colors text-center"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  )
}
