import type { Metadata, Viewport } from 'next'
import './globals.css'

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
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
