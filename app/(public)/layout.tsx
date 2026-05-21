import Link from 'next/link'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#090e1a] text-slate-100">
      {/* Fixed ambient glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-fleet-600/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-purple-600/8 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-indigo-900/10 rounded-full blur-[100px]" />
      </div>

      {/* Nav */}
      <header className="relative z-10 border-b border-white/5 bg-[#090e1a]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/fleet" className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-fleet flex items-center justify-center shadow-fleet group-hover:shadow-fleet-lg transition-shadow">
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-white" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
              </svg>
            </div>
            <span className="font-display font-bold text-white text-lg tracking-tight">
              Fleet<span className="text-fleet-400">Flow</span>
            </span>
          </Link>

          <div className="flex items-center gap-4">
            <Link
              href="/book"
              className="px-4 py-2 rounded-lg bg-fleet-600 hover:bg-fleet-500 text-white text-sm font-medium transition-colors shadow-fleet hover:shadow-fleet-lg"
            >
              Book a Ride
            </Link>
            <Link
              href="/login"
              className="text-slate-400 hover:text-white text-sm transition-colors"
            >
              Staff Login →
            </Link>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="relative z-10">{children}</main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 mt-24 py-10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-slate-500 text-sm">
          <span>© {new Date().getFullYear()} FleetFlow Premium. All rights reserved.</span>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="hover:text-slate-300 transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-slate-300 transition-colors">Terms of Service</Link>
            <Link href="/login" className="hover:text-slate-300 transition-colors">Staff Portal →</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
