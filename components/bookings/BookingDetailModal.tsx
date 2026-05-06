'use client'

import { useState, useEffect } from 'react'
import { Edit2, Mail, Plus, Star, Loader2, Sparkles, Check, Copy, Send } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { StatusBadge, Badge } from '@/components/ui/Badge'
import { formatDateTime, formatCurrency, vehicleLabels } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import type { Booking, Profile, Quote, Supplier } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  booking: Booking
  suppliers: Supplier[]
  profile: Profile
  onEdit: () => void
  onRefresh: () => void
}

export function BookingDetailModal({ open, onClose, booking, suppliers, profile, onEdit, onRefresh }: Props) {
  const { toast } = useToast()
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [showAddQuote, setShowAddQuote] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [addingQuote, setAddingQuote] = useState(false)

  // Guest notification state
  const [guestEmailDraft, setGuestEmailDraft] = useState('')
  const [guestEmailLoading, setGuestEmailLoading] = useState(false)
  const [showNotifyReminder, setShowNotifyReminder] = useState(false)

  // Contact supplier state
  const [contactTab, setContactTab] = useState<'email' | 'viber'>('email')
  const [selectedSupplierId, setSelectedSupplierId] = useState(suppliers[0]?.id ?? '')
  const [emailDraft, setEmailDraft] = useState('')
  const [viberDraft, setViberDraft] = useState('')

  const [newQuote, setNewQuote] = useState({
    supplier_id: suppliers[0]?.id ?? '',
    amount_usd: 0,
    includes_driver: false,
    vehicle_model: '',
    notes: '',
  })

  useEffect(() => {
    if (open) loadQuotes()
  }, [open, booking.id])

  // Reset drafts when supplier changes
  useEffect(() => {
    setEmailDraft('')
    setViberDraft('')
  }, [selectedSupplierId])

  async function loadQuotes() {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('quotes')
      .select('*')
      .eq('booking_id', booking.id)
      .order('amount_usd', { ascending: true })
    if (error) console.error('[loadQuotes]', error)
    if (data) setQuotes(data)
  }

  async function handleSelectQuote(quoteId: string) {
    const supabase = createClient()
    await supabase.from('quotes').update({ is_selected: false }).eq('booking_id', booking.id)
    const quote = quotes.find((q) => q.id === quoteId)
    await supabase.from('quotes').update({ is_selected: true }).eq('id', quoteId)
    await supabase.from('bookings').update({
      status: 'quoted',
      assigned_supplier: quote?.supplier_id,
    }).eq('id', booking.id)
    toast('Quote selected!', 'success')
    await loadQuotes()
    onRefresh()
    if (booking.guest_email) setShowNotifyReminder(true)
  }

  async function handleAddQuote() {
    setAddingQuote(true)
    const supabase = createClient()
    const { error } = await supabase.from('quotes').insert({
      booking_id: booking.id,
      supplier_id: newQuote.supplier_id,
      amount_usd: newQuote.amount_usd,
      includes_driver: newQuote.includes_driver,
      vehicle_model: newQuote.vehicle_model || null,
      notes: newQuote.notes || null,
      created_by: profile.id,
    })
    if (error) {
      console.error('[handleAddQuote]', error)
      toast(`Failed to save quote: ${error.message}`, 'error')
      setAddingQuote(false)
      return
    }
    toast('Quote added!', 'success')
    setShowAddQuote(false)
    await loadQuotes()
    setAddingQuote(false)
  }

  async function generateDrafts() {
    setAiLoading(true)
    const supplier = suppliers.find((s) => s.id === selectedSupplierId) ?? suppliers[0]
    if (!supplier) { setAiLoading(false); return }
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'draft_email', booking, supplier }),
      })
      const data = await res.json()
      setEmailDraft(data.email ?? '')

      const vRes = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'viber_message', booking, supplier }),
      })
      const vData = await vRes.json()
      setViberDraft(vData.message ?? '')
    } catch {
      setEmailDraft('Failed to generate. Please try again.')
    }
    setAiLoading(false)
  }

  async function summarizeBooking() {
    setAiLoading(true)
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'summarize', booking }),
      })
      const data = await res.json()
      toast(data.summary ?? 'Summary ready', 'info')
    } catch { /* ignore */ }
    setAiLoading(false)
  }

  function sendViaEmail() {
    const supplier = suppliers.find((s) => s.id === selectedSupplierId)
    if (!supplier || !emailDraft) return
    const lines = emailDraft.split('\n')
    const subjectLine = lines[0].replace('Subject: ', '')
    const body = lines.slice(2).join('\n')
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(supplier.email)}&su=${encodeURIComponent(subjectLine)}&body=${encodeURIComponent(body)}`
    window.open(gmailUrl, '_blank')
  }

  function openViber() {
    const supplier = suppliers.find((s) => s.id === selectedSupplierId)
    if (!supplier) return
    // Copy message first
    if (viberDraft) {
      navigator.clipboard.writeText(viberDraft).catch(() => {})
      toast('Viber message copied! Opening Viber…', 'success')
    }
    // Clean phone number for Viber deep link
    const phone = supplier.phone.replace(/[\s\-\(\)]/g, '')
    window.open(`viber://chat?number=${encodeURIComponent(phone)}`, '_blank')
  }

  async function generateGuestEmail() {
    setGuestEmailLoading(true)
    const selectedQuote = quotes.find((q) => q.is_selected) ?? null
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'guest_email', booking, selectedQuote }),
      })
      const data = await res.json()
      setGuestEmailDraft(data.email ?? '')
    } catch {
      setGuestEmailDraft('Failed to generate. Please try again.')
    }
    setGuestEmailLoading(false)
  }

  function sendGuestEmail() {
    if (!booking.guest_email || !guestEmailDraft) return
    const lines = guestEmailDraft.split('\n')
    const subjectLine = lines[0].replace('Subject: ', '')
    const body = lines.slice(2).join('\n')
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(booking.guest_email)}&su=${encodeURIComponent(subjectLine)}&body=${encodeURIComponent(body)}`
    window.open(gmailUrl, '_blank')
  }

  const cheapest = quotes.length > 0 ? quotes[0] : null
  const bestValue = quotes.length > 1
    ? quotes.reduce((best, q) => {
        const bSupplier = suppliers.find((s) => s.id === best.supplier_id)
        const qSupplier = suppliers.find((s) => s.id === q.supplier_id)
        const bScore = (bSupplier?.rating ?? 0) / 5 * 0.5 + (1 - best.amount_usd / (cheapest?.amount_usd || 1)) * 0.5
        const qScore = (qSupplier?.rating ?? 0) / 5 * 0.5 + (1 - q.amount_usd / (cheapest?.amount_usd || 1)) * 0.5
        return qScore > bScore ? q : best
      })
    : null

  const canEdit = profile.role !== 'finance'
  const canManageQuotes = ['admin', 'manager', 'staff'].includes(profile.role)
  const selectedSupplier = suppliers.find((s) => s.id === selectedSupplierId)
  const currentDraft = contactTab === 'email' ? emailDraft : viberDraft

  return (
    <Modal open={open} onClose={onClose} title={`Booking ${booking.reference_number}`} subtitle={`${booking.guest_name} · ${booking.guest_nationality}`} size="2xl">
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        {/* Status + actions */}
        <div className="flex items-center justify-between">
          <StatusBadge status={booking.status} />
          <div className="flex gap-2">
            <button onClick={summarizeBooking} disabled={aiLoading} className="btn-secondary text-xs py-1.5 px-3">
              <Sparkles className="w-3.5 h-3.5" /> AI Summary
            </button>
            {canEdit && booking.status === 'pending' && (
              <button onClick={onEdit} className="btn-secondary text-xs py-1.5 px-3">
                <Edit2 className="w-3.5 h-3.5" /> Edit
              </button>
            )}
          </div>
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          {[
            ['Guest', booking.guest_name],
            ['Nationality', booking.guest_nationality],
            ['Guest Count', `${booking.guest_count} pax`],
            ['Vehicle', vehicleLabels[booking.vehicle_type]],
            ['Driver', booking.driver_required ? '✅ Required' : '❌ Not needed'],
            ['Budget', formatCurrency(booking.budget_usd)],
            ['Final Cost', formatCurrency(booking.final_cost_usd)],
            ['Pickup', formatDateTime(booking.pickup_datetime)],
            ['Dropoff', booking.dropoff_datetime ? formatDateTime(booking.dropoff_datetime) : '—'],
            ['Pickup Location', booking.pickup_location],
            ['Dropoff Location', booking.dropoff_location],
          ].map(([label, value]) => (
            <div key={label} className="bg-white/[0.03] rounded-xl px-3 py-2.5">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">{label}</p>
              <p className="text-xs text-slate-200 font-medium">{value}</p>
            </div>
          ))}
        </div>

        {(booking.notes || booking.special_requests) && (
          <div className="space-y-2">
            {booking.notes && (
              <div className="bg-white/[0.03] rounded-xl px-3 py-2.5">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Notes</p>
                <p className="text-xs text-slate-300">{booking.notes}</p>
              </div>
            )}
            {booking.special_requests && (
              <div className="bg-white/[0.03] rounded-xl px-3 py-2.5">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Special Requests</p>
                <p className="text-xs text-slate-300">{booking.special_requests}</p>
              </div>
            )}
          </div>
        )}

        {/* Quotes section */}
        {canManageQuotes && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-white">Supplier Quotes ({quotes.length})</h4>
              {booking.status !== 'completed' && booking.status !== 'cancelled' && (
                <button onClick={() => setShowAddQuote(!showAddQuote)} className="btn-secondary text-xs py-1.5 px-3">
                  <Plus className="w-3.5 h-3.5" /> Add Quote
                </button>
              )}
            </div>

            {showAddQuote && (
              <div className="glass rounded-xl p-4 mb-3 border border-white/10 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 mb-1 block">Supplier</label>
                    <select value={newQuote.supplier_id} onChange={(e) => setNewQuote((p) => ({ ...p, supplier_id: e.target.value }))} className="input-dark text-xs">
                      {suppliers.map((s) => <option key={s.id} value={s.id}>{s.company_name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 mb-1 block">Amount (PHP) *</label>
                    <input type="number" min={0} value={newQuote.amount_usd} onChange={(e) => setNewQuote((p) => ({ ...p, amount_usd: +e.target.value }))}
                      className="input-dark text-xs" />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 mb-1 block">Vehicle Model</label>
                    <input value={newQuote.vehicle_model} onChange={(e) => setNewQuote((p) => ({ ...p, vehicle_model: e.target.value }))}
                      placeholder="e.g. Toyota Camry" className="input-dark text-xs" />
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-400">
                      <input type="checkbox" checked={newQuote.includes_driver} onChange={(e) => setNewQuote((p) => ({ ...p, includes_driver: e.target.checked }))} />
                      Includes driver
                    </label>
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowAddQuote(false)} className="btn-secondary text-xs py-1.5 px-3">Cancel</button>
                  <button onClick={handleAddQuote} disabled={addingQuote || !newQuote.amount_usd} className="btn-primary text-xs py-1.5 px-3">
                    {addingQuote ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    Save Quote
                  </button>
                </div>
              </div>
            )}

            {quotes.length === 0 ? (
              <p className="text-xs text-slate-500 py-3 text-center">No quotes added yet.</p>
            ) : (
              <div className="space-y-2">
                {quotes.map((q) => {
                  const supplier = suppliers.find((s) => s.id === q.supplier_id)
                  const isCheapest = q.id === cheapest?.id
                  const isBestValue = q.id === bestValue?.id
                  return (
                    <div key={q.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${q.is_selected ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-white/8 bg-white/[0.02]'}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-xs font-semibold text-slate-200">{supplier?.company_name ?? 'Unknown'}</p>
                          {isCheapest && <Badge variant="success" className="text-[10px] py-0 px-1.5">Cheapest</Badge>}
                          {isBestValue && !isCheapest && <Badge variant="info" className="text-[10px] py-0 px-1.5">Best Value</Badge>}
                          {q.is_selected && <Badge variant="success" className="text-[10px] py-0 px-1.5"><Check className="w-2.5 h-2.5" /> Selected</Badge>}
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-slate-500">
                          {supplier?.rating && (
                            <span className="flex items-center gap-0.5"><Star className="w-2.5 h-2.5 text-amber-400" /> {supplier.rating}</span>
                          )}
                          {q.vehicle_model && <span>{q.vehicle_model}</span>}
                          {q.includes_driver && <span className="text-amber-400">+ driver</span>}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-white">{formatCurrency(q.amount_usd)}</p>
                        {booking.budget_usd && (
                          <p className={`text-[10px] ${q.amount_usd <= booking.budget_usd ? 'text-emerald-400' : 'text-red-400'}`}>
                            {q.amount_usd <= booking.budget_usd ? '✓ in budget' : '⚠ over budget'}
                          </p>
                        )}
                      </div>
                      {!q.is_selected && booking.status !== 'completed' && (
                        <button onClick={() => handleSelectQuote(q.id)} className="btn-secondary text-xs py-1 px-2.5 shrink-0">
                          Select
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Notify Guest ── */}
        {booking.guest_email && booking.status !== 'cancelled' && (
          <div className="border border-white/10 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 bg-white/[0.03] border-b border-white/8 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-white">Notify Guest</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">Send a booking update to the guest's email</p>
              </div>
              <span className="text-[11px] text-slate-400 bg-white/[0.04] px-2 py-1 rounded-lg truncate max-w-[180px]">
                ✉️ {booking.guest_email}
              </span>
            </div>
            <div className="p-4 space-y-3">
              {/* Notify reminder banner */}
              {showNotifyReminder && (
                <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2.5">
                  <span className="text-base leading-none mt-0.5">🔔</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-amber-300">Quote selected — notify the guest!</p>
                    <p className="text-[11px] text-amber-400/70 mt-0.5">Send them a confirmation email with the final details.</p>
                  </div>
                  <button
                    onClick={() => { setShowNotifyReminder(false); generateGuestEmail() }}
                    className="shrink-0 text-[11px] font-semibold text-amber-300 bg-amber-500/20 hover:bg-amber-500/30 px-2.5 py-1 rounded-lg transition-colors"
                  >
                    Send now →
                  </button>
                  <button onClick={() => setShowNotifyReminder(false)} className="shrink-0 text-slate-500 hover:text-slate-300 text-xs leading-none">✕</button>
                </div>
              )}

              <button
                onClick={generateGuestEmail}
                disabled={guestEmailLoading}
                className="w-full btn-secondary text-xs py-2 flex items-center justify-center gap-2 disabled:opacity-40"
              >
                {guestEmailLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {guestEmailLoading ? 'Generating…' : quotes.some(q => q.is_selected) ? 'Generate Confirmation Email' : 'Generate Booking Update Email'}
              </button>

              {guestEmailDraft ? (
                <>
                  <div className="bg-black/20 rounded-xl p-3 border border-white/8">
                    <pre className="text-[11px] text-slate-300 whitespace-pre-wrap font-sans leading-relaxed max-h-40 overflow-y-auto">{guestEmailDraft}</pre>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => navigator.clipboard.writeText(guestEmailDraft).then(() => toast('Copied!', 'success'))}
                      className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5 shrink-0"
                    >
                      <Copy className="w-3.5 h-3.5" /> Copy
                    </button>
                    <button
                      onClick={sendGuestEmail}
                      className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5 flex-1 justify-center"
                    >
                      <Send className="w-3.5 h-3.5" /> Send to Guest
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-[11px] text-slate-500 text-center">
                  {quotes.some(q => q.is_selected)
                    ? 'Generates a confirmation email with vehicle and cost details.'
                    : 'Generates an update email letting the guest know their booking is being processed.'}
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Contact Supplier ── */}
        <div className="border border-white/10 rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 bg-white/[0.03] border-b border-white/8">
            <h4 className="text-sm font-semibold text-white">Contact Supplier</h4>
            <p className="text-[11px] text-slate-500 mt-0.5">Select a supplier, choose channel, then generate &amp; send</p>
          </div>

          <div className="p-4 space-y-3">
            {suppliers.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-2">No suppliers available. Add suppliers first.</p>
            ) : (
              <>
                {/* Supplier cards */}
                <div className="space-y-1.5 max-h-44 overflow-y-auto pr-0.5">
                  {suppliers.map((s) => {
                    const isSelected = selectedSupplierId === s.id
                    return (
                      <button
                        key={s.id}
                        onClick={() => setSelectedSupplierId(s.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${
                          isSelected
                            ? 'border-fleet-500/50 bg-fleet-500/10'
                            : 'border-white/8 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/15'
                        }`}
                      >
                        {/* Radio dot */}
                        <div className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${
                          isSelected ? 'border-fleet-400' : 'border-slate-600'
                        }`}>
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-fleet-400" />}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-semibold text-slate-200 truncate">{s.company_name}</p>
                            {s.is_preferred && <span className="text-[10px] text-amber-400 shrink-0">⭐ Preferred</span>}
                          </div>
                          <p className="text-[11px] text-slate-500 truncate">{s.contact_person}</p>
                        </div>

                        {/* Contact icons */}
                        <div className="flex gap-2 shrink-0 text-slate-500">
                          <span className="text-[11px]">✉️</span>
                          <span className="text-[11px]">📞</span>
                        </div>
                      </button>
                    )
                  })}
                </div>

                {/* Selected supplier contact info */}
                {selectedSupplier && (
                  <div className="bg-white/[0.03] rounded-xl px-3 py-2 flex items-center gap-4 text-[11px] text-slate-400">
                    <span className="truncate">✉️ {selectedSupplier.email}</span>
                    <span className="shrink-0">📞 {selectedSupplier.phone}</span>
                  </div>
                )}

                {/* Channel tabs */}
                <div className="flex gap-1 bg-white/5 p-1 rounded-xl">
                  <button
                    onClick={() => setContactTab('email')}
                    className={`flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-lg transition-all ${contactTab === 'email' ? 'bg-fleet-600 text-white font-medium' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    <Mail className="w-3.5 h-3.5" /> Email
                  </button>
                  <button
                    onClick={() => setContactTab('viber')}
                    className={`flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-lg transition-all ${contactTab === 'viber' ? 'bg-[#7360f2] text-white font-medium' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    <span className="text-sm leading-none">💜</span> Viber
                  </button>
                </div>

                {/* Generate button */}
                <button
                  onClick={generateDrafts}
                  disabled={aiLoading || !selectedSupplier}
                  className="w-full btn-secondary text-xs py-2 flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  {aiLoading ? 'Generating…' : `Generate ${contactTab === 'email' ? 'Email' : 'Viber'} Message`}
                </button>

                {/* Draft preview */}
                {currentDraft ? (
                  <div className="bg-black/20 rounded-xl p-3 border border-white/8">
                    <pre className="text-[11px] text-slate-300 whitespace-pre-wrap font-sans leading-relaxed max-h-40 overflow-y-auto">{currentDraft}</pre>
                  </div>
                ) : (
                  <div className="bg-white/[0.02] rounded-xl p-3 border border-white/5 text-center">
                    <p className="text-xs text-slate-500">
                      {contactTab === 'email'
                        ? 'Generates a formal email with full booking details.'
                        : 'Generates a short, friendly Viber message.'}
                    </p>
                  </div>
                )}

                {/* Send buttons */}
                <div className="flex gap-2">
                  {currentDraft && (
                    <button
                      onClick={() => navigator.clipboard.writeText(currentDraft).then(() => toast('Copied!', 'success'))}
                      className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5 shrink-0"
                    >
                      <Copy className="w-3.5 h-3.5" /> Copy
                    </button>
                  )}
                  {contactTab === 'email' ? (
                    <button
                      onClick={sendViaEmail}
                      disabled={!emailDraft || !selectedSupplier}
                      className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5 flex-1 justify-center disabled:opacity-40"
                    >
                      <Send className="w-3.5 h-3.5" /> Send via Email
                    </button>
                  ) : (
                    <button
                      onClick={openViber}
                      disabled={!selectedSupplier}
                      className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2 px-4 rounded-xl font-semibold transition-colors bg-[#7360f2] hover:bg-[#6350e2] text-white disabled:opacity-40"
                    >
                      <span className="text-sm leading-none">💜</span> Open in Viber
                    </button>
                  )}
                </div>

                {contactTab === 'viber' && currentDraft && (
                  <p className="text-[11px] text-slate-500 text-center">
                    Message is copied to clipboard automatically — just paste it in the Viber chat.
                  </p>
                )}
              </>
            )}
          </div>
        </div>

      </div>
    </Modal>
  )
}
