'use client'

import { cn } from '@/lib/utils'
import { statusConfig } from '@/lib/utils'
import type { BookingStatus } from '@/types'

interface StatusBadgeProps {
  status: BookingStatus
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const cfg = statusConfig[status]
  return (
    <span className={cn('badge', cfg.bg, cfg.color, className)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />
      {cfg.label}
    </span>
  )
}

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple'
  className?: string
}

const variants = {
  default: 'bg-white/10 text-slate-300 border border-white/10',
  success: 'bg-emerald-400/10 text-emerald-400 border border-emerald-400/20',
  warning: 'bg-amber-400/10 text-amber-400 border border-amber-400/20',
  danger:  'bg-red-400/10 text-red-400 border border-red-400/20',
  info:    'bg-blue-400/10 text-blue-400 border border-blue-400/20',
  purple:  'bg-purple-400/10 text-purple-400 border border-purple-400/20',
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span className={cn('badge', variants[variant], className)}>
      {children}
    </span>
  )
}
