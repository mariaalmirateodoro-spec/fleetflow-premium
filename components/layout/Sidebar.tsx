'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, CalendarCheck, Building2, CheckSquare,
  BarChart3, Settings, Users, LogOut, ChevronRight, Car, UserCheck, History, X, Banknote,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { roleConfig } from '@/lib/utils'
import { getInitials } from '@/lib/utils'
import type { Profile } from '@/types'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useMobileSidebar } from './MobileSidebarContext'

const navItems = [
  { href: '/dashboard',  label: 'Dashboard',  icon: LayoutDashboard, roles: ['admin','staff','manager','finance'] },
  { href: '/bookings',   label: 'Bookings',   icon: CalendarCheck,   roles: ['admin','staff','manager','finance'] },
  { href: '/suppliers',  label: 'Suppliers',  icon: Building2,       roles: ['admin','staff','manager','finance'] },
  { href: '/drivers',    label: 'Drivers',    icon: UserCheck,       roles: ['admin','staff','manager'] },
  { href: '/approvals',  label: 'Approvals',  icon: CheckSquare,     roles: ['admin','manager'] },
  { href: '/activity',   label: 'Activity Log', icon: History,        roles: ['admin','manager'] },
  { href: '/finance',    label: 'Finance',    icon: Banknote,         roles: ['admin','finance'] },
  { href: '/reports',    label: 'Reports',    icon: BarChart3,        roles: ['admin','finance','manager'] },
  { href: '/users',      label: 'Users',      icon: Users,            roles: ['admin'] },
  { href: '/settings',   label: 'Settings',   icon: Settings,         roles: ['admin','staff','manager','finance'] },
]

interface SidebarProps {
  profile: Profile
}

export function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const roleCfg = roleConfig[profile.role]
  const { open, close } = useMobileSidebar()

  const visibleItems = navItems.filter((item) => item.roles.includes(profile.role))

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      {/* Backdrop — mobile only, shown while the drawer is open */}
      {open && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}

      {/* Below md: fixed off-canvas drawer, slides in/out. From md up: normal
          sticky column, always visible, part of the page's flex layout. */}
      <aside
        className={cn(
          'flex flex-col w-64 h-screen glass border-r border-white/8 shrink-0 z-50 transition-transform duration-200',
          'fixed inset-y-0 left-0 md:sticky md:top-0 md:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-white/8">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-fleet-600 to-purple-600 flex items-center justify-center shadow-fleet shrink-0">
            <Car className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <span className="font-display font-bold text-white text-sm leading-tight block">FleetFlow</span>
            <span className="text-[10px] text-fleet-400 font-medium tracking-wider uppercase">Premium</span>
          </div>
          <button
            onClick={close}
            className="md:hidden p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <p className="px-3 pb-2 text-[10px] uppercase tracking-widest text-slate-500 font-semibold">Navigation</p>
          {visibleItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={close}
                className={cn(
                  'group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                  isActive
                    ? 'bg-fleet-600/20 text-fleet-300 border border-fleet-500/20 shadow-[0_0_12px_rgba(99,102,241,0.1)]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                )}
              >
                <Icon className={cn('w-4 h-4 shrink-0', isActive ? 'text-fleet-400' : 'group-hover:text-slate-300')} />
                <span className="flex-1">{item.label}</span>
                {isActive && <ChevronRight className="w-3 h-3 text-fleet-400 opacity-60" />}
              </Link>
            )
          })}
        </nav>

        {/* User profile footer */}
        <div className="p-3 border-t border-white/8">
          <div className="glass rounded-xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-fleet-600 to-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {getInitials(profile.full_name || profile.email)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-200 truncate">{profile.full_name || 'User'}</p>
              <span className={cn('badge text-[10px] px-1.5 py-0.5 mt-0.5', roleCfg.bg, roleCfg.color)}>
                {roleCfg.label}
              </span>
            </div>
            <button
              onClick={handleSignOut}
              title="Sign out"
              className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-colors shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
