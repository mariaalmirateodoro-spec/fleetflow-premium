import type { Metadata, Viewport } from 'next'
import { Inter, Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'

// next/font self-hosts these at build time and inlines the @font-face rules
// server-side, instead of the previous <link> to fonts.googleapis.com —
// that was a render-blocking external request (DNS + TLS + HTTP) on every
// single page load. Same families/weights, so nothing visually changes;
// the CSS variables below are wired into tailwind.config.ts's fontFamily
// so every existing font-sans/font-display class keeps working as-is.
const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
})
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-jakarta',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'FleetFlow Premium',
    template: '%s | FleetFlow Premium',
  },
  description: 'Premium HR/Admin car rental management system for foreign guest transportation.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/favicon.svg',
    apple: '/apple-touch-icon.png',
  },
  // Lets iOS Safari's "Add to Home Screen" open the app in standalone mode
  // (no browser chrome/address bar) instead of just bookmarking a page —
  // iOS mostly ignores manifest.webmanifest and reads these tags instead.
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'FleetFlow',
  },
}

export const viewport: Viewport = {
  themeColor: '#090e1a',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${jakarta.variable}`}>
      <body>{children}</body>
    </html>
  )
}
