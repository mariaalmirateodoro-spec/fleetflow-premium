'use client'

import { useState } from 'react'
import { CheckCircle, XCircle, MessageSquare, Clock, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { formatDateTime, formatCurrency, vehicleLabels, timeAgo } from '@/lib/utils'
import { StatusBadge, Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import type { Approval, Booking, Profile } from '@/types'
import { useRouter } from 'next/navigation'

interface Props {
  pendingBookings: Booking[]
  recentApprovals: Approval[]
  profile: Profile
}

export function ApprovalsClient({ pendingBookings, recentApprovals, profile }: Props) {
  const { toast } = useToast()
  const router = useRouter()
  const [actionModal, setActionModal] = useState<{ booking: Booking; action: 'approved' | 'rejected' | 'revision_requested' } | null>(null)
  const [comments, setComments] = useState('')
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  async function handleAction() {
    if (!actionModal) return
    setLoading(true)
    const supabase = createClient()

    // Insert approval record
    await supabase.from('approvals').insert({
      booking_id: actionModal.booking.id,
      reviewer_id: profile.id,
      action: actionModal.action,
      comments: comments || null,
    })

    // Update booking status
    const newStatus =
      actionModal.action === 'approved' ? 'approved' :
      actionModal.action === 'rejected' ? 'cancelled' : 'pending'

    await supabase.from('bookings').update({
      status: newStatus,
      approved_by: actionModal.action === 'approved' ? profile.id : null,
      approved_at: actionModal.action === 'approved' ? new Date().toISOString() : null,
      cancellation_reason: actionModal.action === 'rejected' ? comments : null,
    }).eq('id', actionModal.booking.id)

    // Notify the booking creator
    const notifTitle =
      actionModal.action === 'approved' ? 'Booking Approved! ✅' :
      actionModal.action === 'rejected' ? 'Booking Rejected' : 'Revision Requested'
    const notifMsg =
      actionModal.action === 'approved'
        ? `Your booking ${actionModal.booking.reference_number} has been approved.`
        : actionModal.action === 'rejected'
        ? `Your booking ${actionModal.booking.reference_number} was rejected. ${comments ? 'Reason: ' + comments : ''}`
        : `Your booking ${actionModal.booking.reference_number} needs revision. ${comments ? 'Notes: ' + comments : ''}`

    await supabase.from('notifications').insert({
      user_id: actionModal.booking.created_by,
      type: actionModal.action === 'approved' ? 'approved' : 'system',
      title: notifTitle,
      message: notifMsg,
      booking_id: actionModal.booking.id,
    })

    toast(`Booking ${actionModal.action.replace('_', ' ')}`, 'success')
    setActionModal(null)
    setComments('')
    setLoading(false)
    router.refresh()
  }

  const actionConfig = {
    approved: { label: 'Approve', icon: CheckCircle, color: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20' },
    rejected: { label: 'Reject', icon: XCircle, color: 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20' },
    revision_requested: { label: 'Request Revision', icon: MessageSquare, color: 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20' },
  }

  return (
    <div className="space-y-6">
      {/* Pending section */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-base font-semibold text-white">Pending Review</h2>
          <Badge variant="warning">{pendingBookings.length}</Badge>
        </div>

        {pendingBookings.length === 0 ? (
          <EmptyState icon="✅" title="All caught up!" description="No bookings waiting for your review." />
        ) : (
          <div className="space-y-3">
            {pendingBookings.map((booking) => {
              const isExpanded = expanded === booking.id
              const profiles = booking.profiles as { full_name?: string; email?: string } | undefined
              const quotes = (booking as Booking & { quotes?: Array<{ amount_usd: number; suppliers?: { company_name: string; rating: number } }> }).quotes ?? []
              const cheapestQuote = quotes.length > 0 ? quotes.reduce((min, q) => q.amount_usd < min.amount_usd ? q : min, quotes[0]) : null

              return (
                <div key={booking.id} className="card border border-white/10 hover:border-white/15 transition-all">
                  {/* Main row */}
                  <div className="flex flex-col sm:flex-row gap-4">
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-3 mb-2">
                        <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-base shrink-0">
                          <Clock className="w-4 h-4 text-amber-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs text-fleet-400 font-semibold">{booking.reference_number}</span>
                            <StatusBadge status={booking.status} />
                            {quotes.length > 0 && <Badge variant="info" className="text-[10px]">{quotes.length} quote{quotes.length > 1 ? 's' : ''}</Badge>}
                          </div>
                          <p className="text-sm font-semibold text-white mt-0.5">{booking.guest_name}</p>
                          <p className="text-xs text-slate-400">{booking.guest_nationality} · {booking.guest_count} guest{booking.guest_count > 1 ? 's' : ''}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mt-3">
                        <div>
                          <p className="text-slate-500 mb-0.5">Pickup</p>
                          <p className="text-slate-300">{formatDateTime(booking.pickup_datetime)}</p>
                        </div>
                        <div>
                          <p className="text-slate-500 mb-0.5">Route</p>
                          <p className="text-slate-300 truncate">{booking.pickup_location} → {booking.dropoff_location}</p>
                        </div>
                        <div>
                          <p className="text-slate-500 mb-0.5">Vehicle</p>
                          <p className="text-slate-300">{vehicleLabels[booking.vehicle_type]}{booking.driver_required ? ' + driver' : ''}</p>
                        </div>
                        <div>
                          <p className="text-slate-500 mb-0.5">Budget / Best Quote</p>
                          <p className="text-slate-300">
                            {formatCurrency(booking.budget_usd)}
                            {cheapestQuote && <span className="text-emerald-400 ml-1">({formatCurrency(cheapestQuote.amount_usd)})</span>}
                          </p>
                        </div>
                      </div>

                      {booking.notes && (
                        <p className="text-xs text-slate-500 mt-2 italic">"{booking.notes}"</p>
                      )}

                      <p className="text-[11px] text-slate-600 mt-1.5">
                        Submitted by {profiles?.full_name ?? 'Unknown'} · {timeAgo(booking.created_at)}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-row sm:flex-col gap-2 shrink-0">
                      {(['approved', 'rejected', 'revision_requested'] as const).map((action) => {
                        const cfg = actionConfig[action]
                        const Icon = cfg.icon
                        return (
                          <button
                            key={action}
                            onClick={() => setActionModal({ booking, action })}
                            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl border transition-all ${cfg.color}`}
                          >
                            <Icon className="w-3.5 h-3.5 shrink-0" />
                            <span className="hidden sm:block">{cfg.label}</span>
                          </button>
                        )
                      })}
                      {quotes.length > 0 && (
                        <button
                          onClick={() => setExpanded(isExpanded ? null : booking.id)}
                          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 px-2"
                        >
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          Quotes
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded quotes */}
                  {isExpanded && quotes.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-white/8 space-y-2">
                      <p className="text-xs text-slate-400 font-medium mb-2">Quote Comparison</p>
                      {quotes.map((q, i) => (
                        <div key={i} className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.03] border border-white/5">
                          <div>
                            <p className="text-xs font-medium text-slate-200">{q.suppliers?.company_name ?? 'Unknown'}</p>
                            {q.suppliers?.rating && <p className="text-[11px] text-amber-400">★ {q.suppliers.rating}</p>}
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-white">{formatCurrency(q.amount_usd)}</p>
                            {i === 0 && <Badge variant="success" className="text-[10px]">Cheapest</Badge>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Recent approvals history */}
      <div>
        <h2 className="text-base font-semibold text-white mb-4">Recent Decisions</h2>
        <div className="card p-0 overflow-hidden">
          {recentApprovals.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">No approval history yet.</div>
          ) : (
            <div className="divide-y divide-white/5">
              {recentApprovals.map((approval) => {
                const reviewer = approval.profiles as { full_name?: string } | undefined
                const booking = approval.bookings as { reference_number?: string; guest_name?: string } | undefined
                return (
                  <div key={approval.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      approval.action === 'approved' ? 'bg-emerald-500/10 text-emerald-400' :
                      approval.action === 'rejected' ? 'bg-red-500/10 text-red-400' :
                      'bg-amber-500/10 text-amber-400'
                    }`}>
                      {approval.action === 'approved' ? <CheckCircle className="w-3.5 h-3.5" /> :
                       approval.action === 'rejected' ? <XCircle className="w-3.5 h-3.5" /> :
                       <MessageSquare className="w-3.5 h-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-300">
                        <span className="font-medium">{reviewer?.full_name ?? 'Manager'}</span>
                        {' '}<span className="text-slate-500">{approval.action.replace('_', ' ')}</span>{' '}
                        <span className="font-mono text-fleet-400">{booking?.reference_number ?? '—'}</span>
                      </p>
                      {approval.comments && (
                        <p className="text-[11px] text-slate-500 truncate">"{approval.comments}"</p>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-600 shrink-0">{timeAgo(approval.created_at)}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Action Modal */}
      {actionModal && (
        <Modal
          open={!!actionModal}
          onClose={() => { setActionModal(null); setComments('') }}
          title={actionConfig[actionModal.action].label}
          subtitle={`Booking ${actionModal.booking.reference_number} · ${actionModal.booking.guest_name}`}
          size="md"
        >
          <div className="space-y-4">
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block font-medium">
                {actionModal.action === 'approved' ? 'Approval Notes (optional)' :
                 actionModal.action === 'rejected' ? 'Rejection Reason *' : 'Revision Notes *'}
              </label>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder={
                  actionModal.action === 'approved'
                    ? 'Any notes for the team…'
                    : actionModal.action === 'rejected'
                    ? 'Please provide a reason for rejection…'
                    : 'What needs to be revised?'
                }
                rows={3}
                className="input-dark resize-none"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setActionModal(null); setComments('') }} className="btn-secondary">Cancel</button>
              <button
                onClick={handleAction}
                disabled={loading || (actionModal.action !== 'approved' && !comments)}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all border ${actionConfig[actionModal.action].color} disabled:opacity-50`}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Confirm {actionConfig[actionModal.action].label}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
