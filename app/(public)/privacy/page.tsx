import Link from 'next/link'

export const metadata = { title: 'Privacy Policy – FleetFlow Premium' }

export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <Link href="/fleet" className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white text-sm transition-colors mb-8">
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
        </svg>
        Back to fleet
      </Link>

      <h1 className="font-display font-extrabold text-3xl text-white mb-2">Privacy Policy</h1>
      <p className="text-slate-500 text-sm mb-10">Last updated: May 2026</p>

      <div className="prose prose-invert prose-slate max-w-none space-y-8 text-slate-300 text-sm leading-relaxed">

        <section>
          <h2 className="text-white font-semibold text-lg mb-3">1. Information We Collect</h2>
          <p>
            When you submit a booking request through FleetFlow Premium, we collect the following personal information:
          </p>
          <ul className="list-disc list-inside space-y-1 mt-3 text-slate-400">
            <li>Full name and nationality</li>
            <li>Phone number and email address</li>
            <li>LINE ID (if provided)</li>
            <li>Trip details: pickup/drop-off locations, dates, and times</li>
            <li>Number of passengers and special requests</li>
          </ul>
        </section>

        <section>
          <h2 className="text-white font-semibold text-lg mb-3">2. How We Use Your Information</h2>
          <p>We use the information you provide solely to:</p>
          <ul className="list-disc list-inside space-y-1 mt-3 text-slate-400">
            <li>Process and confirm your transport booking</li>
            <li>Send booking updates via email and/or LINE</li>
            <li>Coordinate with our drivers and vehicle suppliers</li>
            <li>Respond to any questions or changes you request</li>
          </ul>
          <p className="mt-3">
            We do not use your information for marketing, and we do not sell or share it with third parties for any purpose other than fulfilling your booking.
          </p>
        </section>

        <section>
          <h2 className="text-white font-semibold text-lg mb-3">3. Data Storage</h2>
          <p>
            Your booking information is stored securely in our database hosted by Supabase (supabase.com), with access restricted to authorized FleetFlow Premium staff only. We retain booking records for operational and accounting purposes.
          </p>
        </section>

        <section>
          <h2 className="text-white font-semibold text-lg mb-3">4. Communications</h2>
          <p>
            By submitting a booking, you consent to receiving transactional communications from FleetFlow Premium related to your booking — including confirmation, status updates, and driver details — via email or LINE. We will not send you promotional messages unless you separately opt in.
          </p>
        </section>

        <section>
          <h2 className="text-white font-semibold text-lg mb-3">5. Your Rights</h2>
          <p>
            You may request access to, correction of, or deletion of your personal data at any time by contacting us at{' '}
            <a href="mailto:operations@fleetflow.com" className="text-fleet-400 hover:text-fleet-300 underline">
              operations@fleetflow.com
            </a>. We will respond within 5 business days.
          </p>
        </section>

        <section>
          <h2 className="text-white font-semibold text-lg mb-3">6. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. Any changes will be posted on this page with an updated date. Continued use of our booking service after changes are posted constitutes acceptance of the updated policy.
          </p>
        </section>

        <section>
          <h2 className="text-white font-semibold text-lg mb-3">7. Contact</h2>
          <p>
            For any privacy-related questions, please contact us at{' '}
            <a href="mailto:operations@fleetflow.com" className="text-fleet-400 hover:text-fleet-300 underline">
              operations@fleetflow.com
            </a>.
          </p>
        </section>
      </div>
    </div>
  )
}
