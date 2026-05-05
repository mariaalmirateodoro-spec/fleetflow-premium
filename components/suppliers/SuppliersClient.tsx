'use client'

import { useState, useMemo } from 'react'
import { Plus, Search, Star, RefreshCw, Phone, Mail, CheckCircle, XCircle } from 'lucide-react'
import { cn, formatCurrency, vehicleLabels } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/LoadingSpinner'
import { SupplierModal } from '@/components/suppliers/SupplierModal'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import type { Profile, Supplier } from '@/types'

interface Props {
  initialSuppliers: Supplier[]
  profile: Profile
}

export function SuppliersClient({ initialSuppliers, profile }: Props) {
  const { toast } = useToast()
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers)
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [selected, setSelected] = useState<Supplier | null>(null)
  const [search, setSearch] = useState('')
  const [availableOnly, setAvailableOnly] = useState(false)
  const [view, setView] = useState<'grid' | 'table'>('grid')
  const [confirmDelete, setConfirmDelete] = useState<Supplier | null>(null)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return suppliers.filter((s) => {
      const match = !q || s.company_name.toLowerCase().includes(q) ||
        s.contact_person.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q)
      const avail = !availableOnly || s.is_available
      return match && avail
    })
  }, [suppliers, search, availableOnly])

  async function refresh() {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase.from('suppliers').select('*').order('company_name')
    if (data) setSuppliers(data)
    setLoading(false)
  }

  async function toggleAvailability(supplier: Supplier) {
    const supabase = createClient()
    await supabase.from('suppliers').update({ is_available: !supplier.is_available }).eq('id', supplier.id)
    toast(`${supplier.company_name} ${!supplier.is_available ? 'activated' : 'deactivated'}`, 'success')
    await refresh()
  }

  async function deleteSupplier(supplier: Supplier) {
    setConfirmDelete(supplier)
  }

  async function confirmDeleteSupplier() {
    if (!confirmDelete) return
    const supabase = createClient()
    await supabase.from('suppliers').delete().eq('id', confirmDelete.id)
    toast(`${confirmDelete.company_name} deleted`, 'success')
    setConfirmDelete(null)
    await refresh()
  }

  const canManage = ['admin', 'manager'].includes(profile.role)
  const canCreate = ['admin', 'manager', 'staff'].includes(profile.role)

  function StarRating({ rating }: { rating: number }) {
    return (
      <div className="flex items-center gap-1">
        {[1,2,3,4,5].map((i) => (
          <Star key={i} className={cn('w-3 h-3', i <= Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-slate-600')} />
        ))}
        <span className="text-xs text-slate-400 ml-1">{rating.toFixed(1)}</span>
      </div>
    )
  }

  return (
    <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by company, contact, email…" className="input-dark pl-10 w-full" />
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-400 bg-white/5 border border-white/10 px-3 py-2.5 rounded-xl hover:bg-white/8 transition-colors">
            <input type="checkbox" checked={availableOnly} onChange={(e) => setAvailableOnly(e.target.checked)} className="w-3.5 h-3.5" />
            Available only
          </label>
          {/* View toggle */}
          <div className="flex glass border border-white/10 rounded-xl overflow-hidden">
            {(['grid', 'table'] as const).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={cn('px-3 py-2.5 text-xs transition-colors', view === v ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-slate-200')}>
                {v === 'grid' ? '⊞' : '≡'}
              </button>
            ))}
          </div>
          <button onClick={refresh} className="btn-secondary p-2.5">
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
          {canCreate && (
            <button onClick={() => { setSelected(null); setShowModal(true) }} className="btn-primary">
              <Plus className="w-4 h-4" /> Add Supplier
            </button>
          )}
        </div>
      </div>

      {/* Summary bar */}
      <div className="flex gap-4 mb-4 text-xs text-slate-400">
        <span>{filtered.length} supplier{filtered.length !== 1 ? 's' : ''}</span>
        <span>·</span>
        <span className="text-emerald-400">{suppliers.filter((s) => s.is_available).length} available</span>
        <span>·</span>
        <span className="text-amber-400">{suppliers.filter((s) => s.is_preferred).length} preferred</span>
      </div>

      {loading ? (
        <TableSkeleton rows={6} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="🏢"
          title="No suppliers found"
          description={search ? 'Try a different search term.' : 'Add your first supplier to get started.'}
          action={canCreate ? (
            <button onClick={() => { setSelected(null); setShowModal(true) }} className="btn-primary">
              <Plus className="w-4 h-4" /> Add Supplier
            </button>
          ) : undefined}
        />
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 stagger">
          {filtered.map((supplier) => (
            <div key={supplier.id} className="card glass-hover group animate-slide-up">
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-fleet-600/30 to-purple-600/20 flex items-center justify-center text-lg border border-white/10">
                    🏢
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white leading-tight">{supplier.company_name}</h3>
                    <p className="text-xs text-slate-400">{supplier.contact_person}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {supplier.is_preferred && <Badge variant="warning" className="text-[10px] py-0.5">⭐ Preferred</Badge>}
                  <Badge variant={supplier.is_available ? 'success' : 'danger'} className="text-[10px] py-0.5">
                    {supplier.is_available ? '● Active' : '● Inactive'}
                  </Badge>
                </div>
              </div>

              {/* Rating */}
              <StarRating rating={supplier.rating} />

              {/* Vehicle types */}
              <div className="flex flex-wrap gap-1.5 mt-3">
                {supplier.vehicle_types.map((v) => (
                  <span key={v} className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-slate-400">
                    {vehicleLabels[v]}
                  </span>
                ))}
              </div>

              {/* Details */}
              <div className="mt-3 pt-3 border-t border-white/8 space-y-1.5 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <Phone className="w-3 h-3 shrink-0" />{supplier.phone}
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-3 h-3 shrink-0" />{supplier.email}
                </div>
                <div className="flex items-center justify-between">
                  <span>Base rate: <span className="text-white font-medium">{formatCurrency(supplier.base_rate_usd)}/trip</span></span>
                  <span className="text-slate-500">{supplier.total_bookings} trips</span>
                </div>
              </div>

              {/* Actions */}
              {canManage && (
                <div className="mt-3 pt-3 border-t border-white/8 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => { setSelected(supplier); setShowModal(true) }} className="btn-secondary text-xs py-1.5 flex-1">Edit</button>
                  <button onClick={() => toggleAvailability(supplier)} className={cn('text-xs py-1.5 px-3 rounded-xl border transition-colors', supplier.is_available ? 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20')}>
                    {supplier.is_available ? 'Deactivate' : 'Activate'}
                  </button>
                  {profile.role === 'admin' && (
                    <button onClick={() => deleteSupplier(supplier)} className="btn-danger py-1.5 px-3 text-xs">Del</button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        /* Table view */
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8 text-xs text-slate-500 uppercase tracking-wider">
                  {['Company', 'Contact', 'Rating', 'Vehicles', 'Base Rate', 'Trips', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map((s) => (
                  <tr key={s.id} className="table-row-hover">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold text-slate-200">{s.company_name}</p>
                        {s.is_preferred && <Badge variant="warning" className="text-[10px] py-0">⭐</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-400">{s.contact_person}</td>
                    <td className="px-4 py-3.5"><StarRating rating={s.rating} /></td>
                    <td className="px-4 py-3.5 text-xs text-slate-400">{s.vehicle_types.map((v) => vehicleLabels[v]).join(', ')}</td>
                    <td className="px-4 py-3.5 text-xs text-white font-medium">{formatCurrency(s.base_rate_usd)}</td>
                    <td className="px-4 py-3.5 text-xs text-slate-400">{s.total_bookings}</td>
                    <td className="px-4 py-3.5">
                      <Badge variant={s.is_available ? 'success' : 'danger'} className="text-[10px]">
                        {s.is_available ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5">
                      {canManage && (
                        <div className="flex gap-1">
                          <button onClick={() => { setSelected(s); setShowModal(true) }} className="text-xs px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 transition-colors">Edit</button>
                          {profile.role === 'admin' && (
                            <button onClick={() => deleteSupplier(s)} className="text-xs px-2 py-1 rounded-lg bg-red-500/5 hover:bg-red-500/15 text-red-400 transition-colors">Del</button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <SupplierModal
          open={showModal}
          onClose={() => { setShowModal(false); setSelected(null) }}
          supplier={selected}
          onSuccess={async () => { setShowModal(false); await refresh(); toast(selected ? 'Supplier updated!' : 'Supplier added!', 'success') }}
        />
      )}

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmDelete(null)} />
          <div className="relative glass border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-slide-up">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 mx-auto mb-4">
              <span className="text-2xl">🗑️</span>
            </div>
            <h3 className="text-base font-semibold text-white text-center mb-1">Delete Supplier?</h3>
            <p className="text-sm text-slate-400 text-center mb-1">
              You are about to permanently delete
            </p>
            <p className="text-sm font-semibold text-white text-center mb-4">
              &ldquo;{confirmDelete.company_name}&rdquo;
            </p>
            <div className="bg-red-500/5 border border-red-500/20 rounded-xl px-4 py-3 mb-5">
              <p className="text-xs text-red-400 text-center">
                ⚠️ This action cannot be undone. All data for this supplier will be permanently removed.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteSupplier}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
