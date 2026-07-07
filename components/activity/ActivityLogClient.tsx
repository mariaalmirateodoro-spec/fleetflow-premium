'use client'

import { useMemo, useState } from 'react'
import { RefreshCw, Search } from 'lucide-react'
import { cn, formatDateTime } from '@/lib/utils'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSpinner'
import { createClient } from '@/lib/supabase/client'

interface AuditLogRow {
  id: string
  booking_id: string | null
  actor_id: string | null
  actor_name: string | null
  action: string
  field: string | null
  old_value: string | null
  new_value: string | null
  note: string | null
  created_at: string
  reference_number: string | null
}

interface Props {
  initialLogs: AuditLogRow[]
}

const ACTION_LABELS: Record<string, string> = {
  booking_created: 'Booking created',
  booking_updated: 'Booking edited',
  booking_draft_saved: 'Draft saved',
  booking_cancelled: 'Booking cancelled',
  booking_completed: 'Trip completed',
  booking_approved: 'Booking approved',
  booking_rejected: 'Booking rejected',
  booking_revision_requested: 'Revision requested',
  modification_approved: 'Modification approved',
  modification_rejected: 'Modification rejected',
  final_cost_changed: 'Final cost changed',
  driver_changed: 'Driver assigned',
  quote_added: 'Quote added',
  quote_selected: 'Quote selected',
  driver_created: 'Driver added',
  driver_updated: 'Driver updated',
  driver_deleted: 'Driver deleted',
  supplier_created: 'Supplier added',
  supplier_updated: 'Supplier updated',
  supplier_status_changed: 'Supplier status changed',
  supplier_deleted: 'Supplier deleted',
  user_role_changed: 'User role changed',
  user_status_changed: 'User status changed',
}

const ACTION_COLORS: Record<string, string> = {
  booking_cancelled: 'bg-red-500/10 text-red-400 border-red-500/20',
  booking_rejected: 'bg-red-500/10 text-red-400 border-red-500/20',
  supplier_deleted: 'bg-red-500/10 text-red-400 border-red-500/20',
  driver_deleted: 'bg-red-500/10 text-red-400 border-red-500/20',
  booking_approved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  modification_approved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  booking_completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  final_cost_changed: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  user_role_changed: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
}

function actionLabel(action: string) {
  return ACTION_LABELS[action] ?? action.replace(/_/g, ' ')
}

function describe(log: AuditLogRow): string {
  if (log.field && (log.old_value !== null || log.new_value !== null)) {
    return `${log.field.replace(/_/g, ' ')}: ${log.old_value ?? '—'} → ${log.new_value ?? '—'}`
  }
  return log.note ?? ''
}

export function ActivityLogClient({ initialLogs }: Props) {
  const [logs, setLogs] = useState<AuditLogRow[]>(initialLogs)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('all')

  const actions = useMemo(() => Array.from(new Set(logs.map((l) => l.action))).sort(), [logs])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return logs.filter((l) => {
      const matchesSearch =
        !q ||
        (l.actor_name ?? '').toLowerCase().includes(q) ||
        (l.reference_number ?? '').toLowerCase().includes(q) ||
        (l.note ?? '').toLowerCase().includes(q) ||
        actionLabel(l.action).toLowerCase().includes(q)
      const matchesAction = actionFilter === 'all' || l.action === actionFilter
      return matchesSearch && matchesAction
    })
  }, [logs, search, actionFilter])

  async function refresh() {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(300)
    if (data) {
      const bookingIds = Array.from(new Set(data.map((l) => l.booking_id).filter(Boolean))) as string[]
      let refByBookingId: Record<string, string> = {}
      if (bookingIds.length > 0) {
        const { data: bookings } = await supabase.from('bookings').select('id, reference_number').in('id', bookingIds)
        refByBookingId = Object.fromEntries((bookings ?? []).map((b) => [b.id, b.reference_number]))
      }
      setLogs(data.map((l) => ({ ...l, reference_number: l.booking_id ? refByBookingId[l.booking_id] ?? null : null })))
    }
    setLoading(false)
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by staff name, reference number, or action…"
            className="input-dark pl-10 w-full"
          />
        </div>
        <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="input-dark sm:w-56">
          <option value="all">All actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>{actionLabel(a)}</option>
          ))}
        </select>
        <button onClick={refresh} className="btn-secondary p-2.5">
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
        </button>
      </div>

      <div className="mb-4 text-xs text-slate-400">
        {filtered.length} event{filtered.length !== 1 ? 's' : ''}
      </div>

      {loading ? (
        <TableSkeleton rows={8} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="🗒️"
          title="No activity found"
          description={search || actionFilter !== 'all' ? 'Try a different search or filter.' : 'Staff actions will appear here as they happen.'}
        />
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8 text-xs text-slate-500 uppercase tracking-wider">
                  {['When', 'Staff', 'Action', 'Booking', 'Details'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map((log) => (
                  <tr key={log.id} className="table-row-hover">
                    <td className="px-4 py-3.5 text-xs text-slate-400 whitespace-nowrap">{formatDateTime(log.created_at)}</td>
                    <td className="px-4 py-3.5 text-xs font-medium text-slate-200 whitespace-nowrap">{log.actor_name ?? 'Unknown'}</td>
                    <td className="px-4 py-3.5">
                      <span className={cn(
                        'text-[11px] px-2 py-0.5 rounded-md border whitespace-nowrap',
                        ACTION_COLORS[log.action] ?? 'bg-white/5 text-slate-400 border-white/10'
                      )}>
                        {actionLabel(log.action)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-400 whitespace-nowrap">{log.reference_number ?? '—'}</td>
                    <td className="px-4 py-3.5 text-xs text-slate-400">{describe(log)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}
