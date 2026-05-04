import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow, parseISO } from 'date-fns'
import type { BookingStatus, VehicleType, UserRole } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ─── Date helpers ────────────────────────────────────────────
export function formatDate(dateStr: string, fmt = 'MMM d, yyyy') {
  try {
    return format(parseISO(dateStr), fmt)
  } catch {
    return dateStr
  }
}

export function formatDateTime(dateStr: string) {
  try {
    return format(parseISO(dateStr), 'MMM d, yyyy HH:mm')
  } catch {
    return dateStr
  }
}

export function timeAgo(dateStr: string) {
  try {
    return formatDistanceToNow(parseISO(dateStr), { addSuffix: true })
  } catch {
    return dateStr
  }
}

// ─── Currency helpers ────────────────────────────────────────
export function formatCurrency(amount: number | null | undefined, currency = 'USD') {
  if (amount === null || amount === undefined) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

// ─── Status display helpers ───────────────────────────────────
export const statusConfig: Record<BookingStatus, { label: string; color: string; bg: string; dot: string }> = {
  pending: {
    label: 'Pending',
    color: 'text-amber-400',
    bg: 'bg-amber-400/10 border border-amber-400/20',
    dot: 'bg-amber-400',
  },
  quoted: {
    label: 'Quoted',
    color: 'text-blue-400',
    bg: 'bg-blue-400/10 border border-blue-400/20',
    dot: 'bg-blue-400',
  },
  approved: {
    label: 'Approved',
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10 border border-emerald-400/20',
    dot: 'bg-emerald-400',
  },
  completed: {
    label: 'Completed',
    color: 'text-purple-400',
    bg: 'bg-purple-400/10 border border-purple-400/20',
    dot: 'bg-purple-400',
  },
  cancelled: {
    label: 'Cancelled',
    color: 'text-red-400',
    bg: 'bg-red-400/10 border border-red-400/20',
    dot: 'bg-red-400',
  },
}

export const vehicleLabels: Record<VehicleType, string> = {
  sedan: 'Sedan',
  suv: 'SUV',
  van: 'Van',
  minibus: 'Minibus',
  luxury: 'Luxury',
  pickup: 'Pickup',
}

export const vehicleIcons: Record<VehicleType, string> = {
  sedan: '🚗',
  suv: '🚙',
  van: '🚐',
  minibus: '🚌',
  luxury: '🚘',
  pickup: '🛻',
}

export const roleConfig: Record<UserRole, { label: string; color: string; bg: string }> = {
  admin: { label: 'Admin', color: 'text-red-400', bg: 'bg-red-400/10 border border-red-400/20' },
  manager: { label: 'Manager', color: 'text-purple-400', bg: 'bg-purple-400/10 border border-purple-400/20' },
  staff: { label: 'Staff', color: 'text-blue-400', bg: 'bg-blue-400/10 border border-blue-400/20' },
  finance: { label: 'Finance', color: 'text-emerald-400', bg: 'bg-emerald-400/10 border border-emerald-400/20' },
}

// ─── Misc helpers ─────────────────────────────────────────────
export function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function generateRef() {
  return 'FF-' + Math.random().toString(36).substring(2, 10).toUpperCase()
}

export function truncate(str: string, maxLength: number) {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength) + '…'
}

export function debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number) {
  let timer: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }
}
