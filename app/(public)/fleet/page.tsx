import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Our Fleet | FleetFlow Premium',
  description: 'Browse our premium vehicle fleet and book your ride instantly.',
}

const vehicles = [
  {
    type: 'sedan',
    label: 'Sedan',
    emoji: '🚗',
    capacity: 'Up to 4 passengers',
    bestFor: 'Airport transfers, business meetings, solo or couple travel',
    description:
      'Comfortable and professional. Perfect for executives and small groups who need a smooth, reliable ride.',
    features: ['Leather interior', 'Climate control', 'Wi-Fi'],
    highlight: false,
  },
  {
    type: 'suv',
    label: 'SUV',
    emoji: '🚙',
    capacity: 'Up to 6 passengers',
    bestFor: 'Family outings, site visits, small group travel',
    description:
      'Spacious and versatile. Handles both city streets and rough terrain with ease.',
    features: ['Panoramic roof', 'Extra luggage space', 'All-terrain'],
    highlight: false,
  },
  {
    type: 'luxury',
    label: 'Luxury / VIP',
    emoji: '🏎️',
    capacity: 'Up to 4 passengers',
    bestFor: 'VIP guests, executive travel, special occasions',
    description:
      'Our premium flagship vehicles — for guests who expect nothing but the best.',
    features: ['Premium brand', 'Private chauffeur', 'Refreshments'],
    highlight: true,
  },
  {
    type: 'van',
    label: 'Van',
    emoji: '🚐',
    capacity: 'Up to 12 passengers',
    bestFor: 'Group transfers, team offsite, airport group pickups',
    description:
      'Ideal for larger groups who want to travel together comfortably without splitting into multiple cars.',
    features: ['Individual seating', 'Large boot', 'USB charging'],
    highlight: false,
  },
  {
    type: 'minibus',
    label: 'Minibus',
    emoji: '🚌',
    capacity: 'Up to 20 passengers',
    bestFor: 'Corporate events, delegations, team transport',
    description:
      'Our largest option — perfect for moving entire teams or delegations in a single, organised journey.',
    features: ['PA system', 'Climate control', 'Luggage bay'],
    highlight: false,
  },
  {
    type: 'pickup',
    label: 'Pickup Truck',
    emoji: '🛻',
    capacity: 'Up to 4 passengers + cargo',
    bestFor: 'Site logistics, equipment transport, outdoor travel',
    description:
      'Rugged and practical. The right choice when you need passengers and cargo capacity in one vehicle.',
    features: ['Open cargo bed', 'High clearance', '4WD option'],
    highlight: false,
  },
]

export default function FleetPage() {
  return (
    <>
      {/* Hero */}
      <section className="pt-20 pb-16 px-6 text-center">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-fleet-500/30 bg-fleet-500/10 text-fleet-300 text-sm font-medium mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-fleet-400 animate-pulse" />
            Available now · Book in minutes
          </div>
          <h1 className="font-display font-extrabold text-4xl sm:text-5xl lg:text-6xl text-white leading-tight mb-6">
            Premium rides for{' '}
            <span className="bg-gradient-fleet bg-clip-text text-transparent">
              every occasion
            </span>
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed mb-10">
            Choose from our curated fleet of vehicles — from executive sedans to large minibuses.
            Submit your request and our team will confirm within the hour.
          </p>
          <Link
            href="/book"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-gradient-fleet text-white font-semibold text-base shadow-fleet hover:shadow-fleet-lg transition-all hover:scale-105"
          >
            Book Any Vehicle
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
            </svg>
          </Link>
        </div>
      </section>

      {/* Vehicle grid */}
      <section className="px-6 pb-20">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {vehicles.map((v) => (
              <div
                key={v.type}
                className={`relative rounded-2xl border p-6 flex flex-col transition-all duration-300 hover:-translate-y-1 group ${
                  v.highlight
                    ? 'border-fleet-500/50 bg-gradient-to-br from-fleet-900/40 to-purple-900/20 shadow-fleet'
                    : 'border-white/8 bg-white/4 hover:border-white/15 hover:bg-white/6'
                }`}
              >
                {v.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-3 py-1 rounded-full bg-gradient-fleet text-white text-xs font-semibold shadow-fleet">
                      ✦ Most Popular
                    </span>
                  </div>
                )}

                {/* Icon + name */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <span className="text-4xl">{v.emoji}</span>
                    <h2 className="mt-2 font-display font-bold text-xl text-white">
                      {v.label}
                    </h2>
                    <p className="text-fleet-300 text-sm font-medium mt-0.5">
                      {v.capacity}
                    </p>
                  </div>
                </div>

                <p className="text-slate-400 text-sm leading-relaxed mb-4 flex-1">
                  {v.description}
                </p>

                {/* Best for */}
                <div className="mb-4">
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Best for</p>
                  <p className="text-slate-300 text-sm">{v.bestFor}</p>
                </div>

                {/* Features */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {v.features.map((f) => (
                    <span
                      key={f}
                      className="px-2.5 py-1 rounded-lg bg-white/6 border border-white/8 text-slate-400 text-xs"
                    >
                      {f}
                    </span>
                  ))}
                </div>

                {/* CTA */}
                <Link
                  href={`/book?type=${v.type}`}
                  className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium text-sm transition-all ${
                    v.highlight
                      ? 'bg-gradient-fleet text-white shadow-fleet hover:shadow-fleet-lg'
                      : 'bg-white/8 border border-white/10 text-white hover:bg-fleet-600 hover:border-fleet-500 hover:shadow-fleet'
                  }`}
                >
                  Book {v.label}
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
                  </svg>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 pb-20 border-t border-white/5 pt-20">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-display font-bold text-3xl text-white mb-12">
            How it works
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Choose your vehicle', desc: 'Browse the fleet and pick the right vehicle type for your trip.' },
              { step: '02', title: 'Submit your request', desc: 'Fill in your travel details and contact info. Takes under 2 minutes.' },
              { step: '03', title: 'We confirm & dispatch', desc: 'Our team reviews your request and contacts you to confirm the booking.' },
            ].map((item) => (
              <div key={item.step} className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-fleet-600/20 border border-fleet-500/30 flex items-center justify-center text-fleet-300 font-display font-bold text-sm mb-4">
                  {item.step}
                </div>
                <h3 className="font-semibold text-white mb-2">{item.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
