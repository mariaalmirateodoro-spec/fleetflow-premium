import Link from 'next/link'

export const metadata = { title: 'Terms of Service – FleetFlow Premium' }

export default function TermsPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <Link href="/fleet" className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white text-sm transition-colors mb-8">
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
        </svg>
        Back to fleet
      </Link>

      <h1 className="font-display font-extrabold text-3xl text-white mb-2">Terms of Service</h1>
      <p className="text-slate-500 text-sm mb-10">Last updated: May 2026</p>

      <div className="space-y-8 text-slate-300 text-sm leading-relaxed">

        <section>
          <h2 className="text-white font-semibold text-lg mb-3">1. Acceptance of Terms</h2>
          <p>
            By submitting a booking request through FleetFlow Premium, you agree to these Terms of Service. If you do not agree, please do not submit a booking.
          </p>
        </section>

        <section>
          <h2 className="text-white font-semibold text-lg mb-3">2. Booking Requests</h2>
          <p>
            Submitting a booking form does not guarantee a confirmed booking. All requests are subject to vehicle and driver availability. Your booking is only confirmed once you receive a written confirmation from our team via email or LINE.
          </p>
        </section>

        <section>
          <h2 className="text-white font-semibold text-lg mb-3">3. Accuracy of Information</h2>
          <p>
            You are responsible for providing accurate and complete information when submitting your booking request, including correct pickup/drop-off locations, dates, times, and contact details. FleetFlow Premium is not liable for any issues arising from incorrect information provided by the guest.
          </p>
        </section>

        <section>
          <h2 className="text-white font-semibold text-lg mb-3">4. Cancellations</h2>
          <p>
            You may request a cancellation at any time by contacting our team or through the booking status page. Cancellation terms and any applicable fees will be communicated to you upon confirmation of your booking.
          </p>
        </section>

        <section>
          <h2 className="text-white font-semibold text-lg mb-3">5. Conduct During Transport</h2>
          <p>
            Guests are expected to treat drivers and vehicles with respect. FleetFlow Premium reserves the right to refuse or terminate service in cases of abusive, threatening, or unsafe behavior.
          </p>
        </section>

        <section>
          <h2 className="text-white font-semibold text-lg mb-3">6. Liability</h2>
          <p>
            FleetFlow Premium acts as a transport coordinator and is not liable for delays caused by traffic, weather, or circumstances beyond our control. We take reasonable measures to ensure punctual and safe service, but cannot guarantee exact arrival or departure times.
          </p>
        </section>

        <section>
          <h2 className="text-white font-semibold text-lg mb-3">7. Payment</h2>
          <p>
            Pricing is provided as a quote upon booking confirmation. Payment terms will be communicated by our team. Prices are subject to change based on route, vehicle type, and duration.
          </p>
        </section>

        <section>
          <h2 className="text-white font-semibold text-lg mb-3">8. Changes to Terms</h2>
          <p>
            We may update these Terms at any time. Changes will be posted on this page with an updated date. Continued use of our services after changes are posted constitutes acceptance.
          </p>
        </section>

        <section>
          <h2 className="text-white font-semibold text-lg mb-3">9. Contact</h2>
          <p>
            For questions about these Terms, please contact us at{' '}
            <a href="mailto:operations@fleetflow.com" className="text-fleet-400 hover:text-fleet-300 underline">
              operations@fleetflow.com
            </a>.
          </p>
        </section>
      </div>
    </div>
  )
}
