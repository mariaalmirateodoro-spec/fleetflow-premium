'use client'

import { DollarSign, CalendarCheck, Building2, Clock, TrendingUp, TrendingDown } from 'lucide-react'
import { formatCurrency, formatDateTime, statusConfig, vehicleLabels } from '@/lib/utils'
import { StatusBadge } from '@/components/ui/Badge'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import type { Booking, Profile } from '@/types'
import Link from 'next/link'

interface Props {
  data: {
    totalBookings: number
    pendingCount: number
    monthlySpend: number
    supplierCount: number
    upcomingBookings: Booking[]
    recentBookings: Booking[]
    monthlySpendData: { month: string; amount: number }[]
    statusCounts: Record<string, number>
    quotedCount: number
  }
  profile: Profile
}

const PIE_COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444']

export function DashboardContent({ data, profile }: Props) {
  const stats = [
    {
      label: 'Total Bookings',
      value: data.totalBookings,
      icon: '📋',
      change: '+12%',
      changeType: 'up' as const,
      color: 'from-fleet-600/20 to-fleet-600/5',
      border: 'border-fleet-500/20',
    },
    {
      label: 'Total Spend',
      value: formatCurrency(data.monthlySpend),
      icon: '💰',
      change: '+8%',
      changeType: 'up' as const,
      color: 'from-gold-500/20 to-gold-500/5',
      border: 'border-gold-500/20',
    },
    {
      label: 'Active Suppliers',
      value: data.supplierCount,
      icon: '🏢',
      change: 'Stable',
      changeType: 'neutral' as const,
      color: 'from-purple-500/20 to-purple-500/5',
      border: 'border-purple-500/20',
    },
    {
      label: 'Pending Approval',
      value: data.pendingCount,
      icon: '⏳',
      change: data.pendingCount > 5 ? 'Needs attention' : 'On track',
      changeType: data.pendingCount > 5 ? 'down' as const : 'up' as const,
      color: 'from-amber-500/20 to-amber-500/5',
      border: 'border-amber-500/20',
    },
  ]

  const pieData = Object.entries(data.statusCounts).map(([status, count]) => ({
    name: statusConfig[status as keyof typeof statusConfig]?.label ?? status,
    value: count,
  }))

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) => {
    if (active && payload?.length) {
      return (
        <div className="glass rounded-xl px-3 py-2 text-sm border border-white/10">
          <p className="text-slate-400 text-xs">{label}</p>
          <p className="text-white font-semibold">{formatCurrency(payload[0].value)}</p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Stats grid */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 stagger">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`stat-card bg-gradient-to-br ${stat.color} border ${stat.border} animate-slide-up`}
          >
            <div className="flex items-start justify-between mb-3">
              <span className="text-2xl">{stat.icon}</span>
              <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-lg ${
                stat.changeType === 'up' ? 'text-emerald-400 bg-emerald-400/10' :
                stat.changeType === 'down' ? 'text-red-400 bg-red-400/10' :
                'text-slate-400 bg-white/5'
              }`}>
                {stat.changeType === 'up' ? <TrendingUp className="w-3 h-3" /> :
                 stat.changeType === 'down' ? <TrendingDown className="w-3 h-3" /> : null}
                {stat.change}
              </span>
            </div>
            <p className="text-2xl font-display font-bold text-white">{stat.value}</p>
            <p className="text-xs text-slate-400 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Spend chart */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Monthly Spend</h3>
              <p className="text-xs text-slate-400">Last 6 months</p>
            </div>
            <span className="badge bg-fleet-500/10 text-fleet-400 border border-fleet-500/20">PHP</span>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.monthlySpendData}>
                <defs>
                  <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="amount" stroke="#6366f1" strokeWidth={2} fill="url(#spendGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status breakdown */}
        <div className="card">
          <h3 className="text-sm font-semibold text-white mb-1">By Status</h3>
          <p className="text-xs text-slate-400 mb-4">Booking breakdown</p>
          {pieData.length > 0 ? (
            <>
              <div className="h-36 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={62}
                      dataKey="value" strokeWidth={0}>
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} opacity={0.85} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => [v, 'bookings']} contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5 mt-2">
                {pieData.map((item, i) => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-slate-400">{item.name}</span>
                    </div>
                    <span className="text-slate-300 font-medium">{item.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-48 flex items-center justify-center text-slate-500 text-sm">No data yet</div>
          )}
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Upcoming bookings */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Upcoming Bookings</h3>
            <Link href="/bookings" className="text-xs text-fleet-400 hover:text-fleet-300 transition-colors">View all →</Link>
          </div>
          <div className="space-y-2">
            {data.upcomingBookings.length === 0 ? (
              <p className="text-sm text-slate-500 py-4 text-center">No upcoming bookings</p>
            ) : (
              data.upcomingBookings.map((booking) => (
                <div key={booking.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] transition-colors border border-white/5">
                  <div className="w-8 h-8 rounded-lg bg-fleet-500/10 flex items-center justify-center text-sm">
                    🚗
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-200 truncate">{booking.guest_name}</p>
                    <p className="text-[11px] text-slate-500 truncate">{booking.pickup_location} → {booking.dropoff_location}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[11px] text-slate-400">{formatDateTime(booking.pickup_datetime)}</p>
                    <StatusBadge status={booking.status} className="mt-0.5" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent activity */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Recent Activity</h3>
            <Link href="/bookings" className="text-xs text-fleet-400 hover:text-fleet-300 transition-colors">View all →</Link>
          </div>
          <div className="space-y-2">
            {data.recentBookings.length === 0 ? (
              <p className="text-sm text-slate-500 py-4 text-center">No recent activity</p>
            ) : (
              data.recentBookings.map((booking) => {
                const profiles = booking.profiles as { full_name?: string } | undefined
                return (
                  <div key={booking.id} className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-white/[0.03] transition-colors">
                    <div className="w-6 h-6 rounded-full bg-fleet-500/20 flex items-center justify-center text-xs shrink-0 mt-0.5">
                      {booking.status === 'approved' ? '✅' : booking.status === 'completed' ? '🏁' : booking.status === 'cancelled' ? '❌' : '📋'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-300">
                        <span className="font-medium">{booking.reference_number}</span>{' '}
                        <span className="text-slate-500">·</span>{' '}
                        {booking.guest_name}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {(profiles as { full_name?: string } | undefined)?.full_name ?? 'Unknown'} · {vehicleLabels[booking.vehicle_type]}
                      </p>
                    </div>
                    <StatusBadge status={booking.status} />
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
