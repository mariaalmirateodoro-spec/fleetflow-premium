'use client'

import { formatCurrency } from '@/lib/utils'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts'

interface Props {
  monthlyData: { month: string; bookings: number; spend: number }[]
  topSuppliers: { name: string; bookings: number; revenue: number; rating: number }[]
  savingsData: { reference_number: string; budget: number; actual: number; savings: number }[]
  frequentRoutes: { route: string; count: number }[]
  statusData: { status: string; count: number }[]
  summary: { totalSpend: number; totalSavings: number; completedCount: number; cancelledCount: number; totalBookings: number }
}

const COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444']

const tooltipStyle = {
  contentStyle: { background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 },
  labelStyle: { color: '#94a3b8' },
}

export function ReportsContent({ monthlyData, topSuppliers, savingsData, frequentRoutes, statusData, summary }: Props) {
  const summaryCards = [
    { label: 'Total Spend', value: formatCurrency(summary.totalSpend), icon: '💰', color: 'from-fleet-600/20' },
    { label: 'Cost Savings', value: formatCurrency(summary.totalSavings), icon: '📉', color: 'from-emerald-500/20' },
    { label: 'Completed', value: summary.completedCount, icon: '🏁', color: 'from-purple-500/20' },
    { label: 'Cancelled', value: summary.cancelledCount, icon: '❌', color: 'from-red-500/20' },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Summary cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 stagger">
        {summaryCards.map((c) => (
          <div key={c.label} className={`stat-card bg-gradient-to-br ${c.color} to-transparent animate-slide-up`}>
            <span className="text-2xl block mb-2">{c.icon}</span>
            <p className="text-2xl font-display font-bold text-white">{c.value}</p>
            <p className="text-xs text-slate-400 mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Monthly Bookings + Spend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="text-sm font-semibold text-white mb-4">Monthly Bookings</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} barSize={14}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="bookings" fill="#6366f1" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold text-white mb-4">Monthly Spend (USD)</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip {...tooltipStyle} formatter={(v: number) => [formatCurrency(v), 'Spend']} />
                <Line type="monotone" dataKey="spend" stroke="#a855f7" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top Suppliers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 card">
          <h3 className="text-sm font-semibold text-white mb-4">Top Suppliers by Bookings</h3>
          {topSuppliers.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">No supplier data yet.</p>
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topSuppliers} layout="vertical" barSize={10}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="name" type="category" tick={{ fill: '#94a3b8', fontSize: 10 }} width={120} axisLine={false} tickLine={false} />
                  <Tooltip {...tooltipStyle} />
                  <Bar dataKey="bookings" fill="#f59e0b" radius={[0,4,4,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Status pie */}
        <div className="card">
          <h3 className="text-sm font-semibold text-white mb-4">Booking Status</h3>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData.filter((s) => s.count > 0)} cx="50%" cy="50%" outerRadius={60} dataKey="count" strokeWidth={0}>
                  {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} opacity={0.85} />)}
                </Pie>
                <Tooltip {...tooltipStyle} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Cost savings + frequent routes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Savings */}
        <div className="card">
          <h3 className="text-sm font-semibold text-white mb-4">Cost Savings (Budget vs Actual)</h3>
          {savingsData.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">No completed bookings with cost data.</p>
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={savingsData} barSize={8}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="reference_number" tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                  <Tooltip {...tooltipStyle} formatter={(v: number) => [formatCurrency(v)]} />
                  <Bar dataKey="budget" fill="#6366f1" radius={[4,4,0,0]} name="Budget" />
                  <Bar dataKey="actual" fill="#10b981" radius={[4,4,0,0]} name="Actual" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Frequent routes */}
        <div className="card">
          <h3 className="text-sm font-semibold text-white mb-4">Top Routes</h3>
          {frequentRoutes.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">No route data yet.</p>
          ) : (
            <div className="space-y-2">
              {frequentRoutes.map((r, i) => (
                <div key={r.route} className="flex items-center gap-3">
                  <span className="text-xs text-slate-600 w-4 shrink-0">{i + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-300 truncate">{r.route}</p>
                    <div className="mt-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-fleet-600 to-purple-600"
                        style={{ width: `${(r.count / frequentRoutes[0].count) * 100}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-fleet-400 shrink-0">{r.count}×</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Supplier revenue table */}
      {topSuppliers.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/8">
            <h3 className="text-sm font-semibold text-white">Supplier Performance Summary</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-xs text-slate-500 uppercase tracking-wider">
                  <th className="px-4 py-3 text-left font-medium">Supplier</th>
                  <th className="px-4 py-3 text-left font-medium">Bookings</th>
                  <th className="px-4 py-3 text-left font-medium">Revenue</th>
                  <th className="px-4 py-3 text-left font-medium">Avg per booking</th>
                  <th className="px-4 py-3 text-left font-medium">Rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {topSuppliers.map((s) => (
                  <tr key={s.name} className="table-row-hover">
                    <td className="px-4 py-3 text-xs font-medium text-slate-200">{s.name}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{s.bookings}</td>
                    <td className="px-4 py-3 text-xs text-white font-semibold">{formatCurrency(s.revenue)}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{formatCurrency(s.bookings > 0 ? s.revenue / s.bookings : 0)}</td>
                    <td className="px-4 py-3 text-xs text-amber-400">★ {s.rating.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
