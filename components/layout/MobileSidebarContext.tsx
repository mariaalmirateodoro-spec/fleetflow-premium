'use client'

import { createContext, useContext, useState, useCallback } from 'react'

// Lets the Topbar's hamburger button (rendered inside each page, deep in the
// tree) open/close the Sidebar (rendered once in the dashboard layout,
// alongside the page) without threading props through every page component.
interface MobileSidebarValue {
  open: boolean
  toggle: () => void
  close: () => void
}

const MobileSidebarContext = createContext<MobileSidebarValue | null>(null)

export function MobileSidebarProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const toggle = useCallback(() => setOpen((v) => !v), [])
  const close = useCallback(() => setOpen(false), [])

  return (
    <MobileSidebarContext.Provider value={{ open, toggle, close }}>
      {children}
    </MobileSidebarContext.Provider>
  )
}

export function useMobileSidebar() {
  const ctx = useContext(MobileSidebarContext)
  // Falls back to a no-op instead of throwing, so this is safe to use from
  // components that might render outside the dashboard layout too.
  if (!ctx) return { open: false, toggle: () => {}, close: () => {} }
  return ctx
}
