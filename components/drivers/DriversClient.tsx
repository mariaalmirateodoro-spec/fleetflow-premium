'use client'

import { useState, useMemo, useEffect } from 'react'
import { Plus, Search, RefreshCw, Phone, UserCheck, UserX, Loader2, X, Save, AlertTriangle } from 'lucide-react'
import { cn, vehicleLabels } from '@/lib/utils'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { getActiveAssignment, type DriverAssignmentRow } from '@/lib/availability'
import type { Driver, Supplier, VehicleType, Profile } from '@/types'

const VEHICLE_TYPES: VehicleType[] = ['sedan', 'suv', 'van', 'minibus', 'luxury', 'pickup']

interface Props {
  initialDrivers: Driver[]
  suppliers: Supplier[]
  profile: Profile
}

// ─── Driver Modal ────────────────────────────────────────────────────────────

interface ModalProps {
  open: boolean
  onClose: () => void
  driver: Driver | null
  suppliers: Supplier[]
  onSuccess: () => void
}

function DriverModal({ open, onClose, driver, suppliers, onSuccess }: ModalProps) {
  const { toast } = useToast()
  const isEdit = !!driver
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    license_number: '',
    license_expiry: '',
    vehicle_types: [] as VehicleType[],
    is_available: true,
    assigned_supplier_id: '',
    notes: '',
  })

  useEffect(() => {
    if (driver) {
      setForm({
        full_name: driver.full_name,
        phone: driver.phone,
        license_number: driver.license_number,
        license_expiry: driver.license_expiry ?? '',
        vehicle_types: driver.vehicle_types,
        is_available: driver.is_available,
        assigned_supplier_id: driver.assigned_supplier_id ?? '',
        notes: driver.notes ?? '',
      })
    } else {
      setForm({ full_name: '', phone: '', license_number: '', license_expiry: '', vehicle_types: [], is_available: true, assigned_supplier_id: '', notes: '' })
    }
  }, [driver, open])

  function toggleVehicleType(vt: VehicleType) {
    setForm((p) => ({
      ...p,
      vehicle_types: p.vehicle_types.includes(vt)
        ? p.vehicle_types.filter((v) => v !== vt)
        : [...p.vehicle_types, vt],
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.full_name.trim() || !form.phone.trim() || !form.license_number.trim()) {
      toast('Please fill in all required fields', 'error')
      return
    }
    setLoading(true)
    const payload = {
      full_name: form.full_name.trim(),
      phone: form.phone.trim(),
      license_number: form.license_number.trim(),
      license_expiry: form.license_expiry || null,
      vehicle_types: form.vehicle_types,
      is_available: form.is_available,
      assigned_supplier_id: form.assigned_supplier_id || null,
      notes: form.notes.trim() || null,
    }

    const res = isEdit
      ? await fetch('/api/drivers', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: driver!.id, ...payload }) })
      : await fetch('/api/drivers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const json = await res.json()

    setLoading(false)
    if (!res.ok) {
      toast(json.error ?? 'Something went wrong', 'error')
    } else {
      toast(isEdit ? 'Driver updated!' : 'Driver added!', 'success')
      onSuccess()
      onClose()
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg glass rounded-2xl border border-white/10 shadow-2xl animate-slide-up overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
          <h2 className="text-base font-display font-bold text-white">
            {isEdit ? 'Edit Driver' : 'Add New Driver'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-slate-400 mb-1.5 block font-medium">Full Name *</label>
              <input
                value={form.full_name}
                onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
                placeholder="e.g. John Santos"
                className="input-dark"
                required
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block font-medium">Phone *</label>
              <input
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                placeholder="+66 81 234 5678"
                className="input-dark"
                required
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block font-medium">License Number *</label>
              <input
                value={form.license_number}
                onChange={(e) => setForm((p) => ({ ...p, license_number: e.target.value }))}
                placeholder="e.g. TH-2024-00123"
                className="input-dark"
                required
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block font-medium">License Expiry</label>
              <input
                type="date"
                value={form.license_expiry}
                onChange={(e) => setForm((p) => ({ ...p, license_expiry: e.target.value }))}
                className="input-dark"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block font-medium">Linked Supplier</label>
              <select
                value={form.assigned_supplier_id}
                onChange={(e) => setForm((p) => ({ ...p, assigned_supplier_id: e.target.value }))}
                className="input-dark"
              >
                <option value="">— None —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.company_name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Vehicle types */}
          <div>
            <label className="text-xs text-slate-400 mb-2 block font-medium">Vehicle Types</label>
            <div className="flex flex-wrap gap-2">
              {VEHICLE_TYPES.map((vt) => (
                <button
                  key={vt}
                  type="button"
                  onClick={() => toggleVehicleType(vt)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                    form.vehicle_types.includes(vt)
                      ? 'bg-fleet-600/30 border-fleet-500/50 text-fleet-300'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'
                  )}
                >
                  {vehicleLabels[vt]}
                </button>
              ))}
            </div>
          </div>

          {/* Availability */}
          <div className="flex items-center justify-between py-2 border-t border-white/8">
            <div>
              <p className="text-sm text-slate-200 font-medium">Available</p>
              <p className="text-xs text-slate-500">Currently accepting assignments</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={form.is_available}
              onClick={() => setForm((p) => ({ ...p, is_available: !p.is_available }))}
              className={cn(
                'relative w-10 h-5 rounded-full transition-colors focus:outline-none',
                form.is_available ? 'bg-fleet-600' : 'bg-white/10'
              )}
            >
              <span className={cn(
                'absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
                form.is_available ? 'translate-x-5' : 'translate-x-0'
              )} />
            </button>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block font-medium">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Any additional details..."
              rows={2}
              className="input-dark resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2 border-t border-white/8">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isEdit ? 'Save Changes' : 'Add Driver'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Confirm Delete Dialog ───────────────────────────────────────────────────

interface ConfirmProps {
  driver: Driver
  onCancel: () => void
  onConfirm: () => void
}

function ConfirmDeleteDialog({ driver, onCancel, onConfirm }: ConfirmProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-sm glass rounded-2xl border border-white/10 shadow-2xl animate-slide-up p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Remove Driver</p>
            <p className="text-xs text-slate-400">This cannot be undone.</p>
          </div>
        </div>
        <p className="text-sm text-slate-300">
          Are you sure you want to remove <span className="font-semibold text-white">{driver.full_name}</span>?
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
          <button onClick={onConfirm} className="flex-1 px-4 py-2 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/30 transition-colors">
            Remove
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function DriversClient({ initialDrivers, suppliers, profile }: Props) {
  const { toast } = useToast()
  const [drivers, setDrivers] = useState<Driver[]>(initialDrivers)
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [selected, setSelected] = useState<Driver | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Driver | null>(null)
  const [search, setSearch] = useState('')
  const [availableOnly, setAvailableOnly] = useState(false)
  const [upcomingCounts, setUpcomingCounts] = useState<Record<string, number>>({})
  const [activeAssignments, setActiveAssignments] = useState<DriverAssignmentRow[]>([])

  const canManage = ['admin', 'staff', 'manager'].includes(profile.role)

  // Fetch upcoming trip counts for all drivers whenever the driver list changes
  useEffect(() => {
    const ids = drivers.map((d) => d.id)
    if (ids.length === 0) return
    const supabase = createClient()
    supabase
      .from('bookings')
      .select('driver_id')
      .in('driver_id', ids)
      .in('status', ['pending', 'quoted', 'approved'])
      .gte('pickup_datetime', new Date().toISOString())
      .then(({ data }) => {
        const counts: Record<string, number> = {}
        ids.forEach((id) => (counts[id] = 0))
        ;(data ?? []).forEach((b) => {
          if (b.driver_id) counts[b.driver_id] = (counts[b.driver_id] ?? 0) + 1
        })
        setUpcomingCounts(counts)
      })
  }, [drivers])

  // Derived "on a trip right now" status — computed live from currently-approved
  // bookings, not stored. Doesn't touch the manual is_available toggle below;
  // this just tells staff which "available" drivers are momentarily out on a trip.
  useEffect(() => {
    const ids = drivers.map((d) => d.id)
    if (ids.length === 0) { setActiveAssignments([]); return }
    const supabase = createClient()
    supabase
      .from('bookings')
      .select('driver_id, status, pickup_datetime, dropoff_datetime')
      .in('driver_id', ids)
      .eq('status', 'approved')
      .then(({ data }) => setActiveAssignments((data ?? []) as DriverAssignmentRow[]))
  }, [drivers])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return drivers.filter((d) => {
      const match = !q ||
        d.full_name.toLowerCase().includes(q) ||
        d.phone.toLowerCase().includes(q) ||
        d.license_number.toLowerCase().includes(q)
      const avail = !availableOnly || d.is_available
      return match && avail
    })
  }, [drivers, search, availableOnly])

  async function refresh() {
    setLoading(true)
    const res = await fetch('/api/drivers')
    if (res.ok) {
      const json = await res.json()
      if (json.data) setDrivers(json.data as Driver[])
    }
    setLoading(false)
  }

  async function toggleAvailability(driver: Driver) {
    const res = await fetch('/api/drivers', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: driver.id, is_available: !driver.is_available }),
    })
    if (!res.ok) { const j = await res.json(); toast(j.error ?? 'Update failed', 'error'); return }
    toast(`${driver.full_name} marked as ${!driver.is_available ? 'available' : 'unavailable'}`, 'success')
    await refresh()
  }

  async function handleDelete() {
    if (!confirmDelete) return
    const res = await fetch(`/api/drivers?id=${confirmDelete.id}`, { method: 'DELETE' })
    if (!res.ok) { const j = await res.json(); toast(j.error ?? 'Delete failed', 'error') }
    else { toast('Driver removed', 'success'); await refresh() }
    setConfirmDelete(null)
  }

  function isExpiringSoon(expiry: string | null): boolean {
    if (!expiry) return false
    const days = (new Date(expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    return days >= 0 && days <= 30
  }

  function isExpired(expiry: string | null): boolean {
    if (!expiry) return false
    return new Date(expiry) < new Date()
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search drivers..."
            className="input-dark pl-9 w-full"
          />
        </div>

        <button
          onClick={() => setAvailableOnly((p) => !p)}
          className={cn(
            'px-3 py-2 rounded-xl text-xs font-medium border transition-all',
            availableOnly
              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
              : 'glass border-white/10 text-slate-400 hover:text-slate-200'
          )}
        >
          Available only
        </button>

        <button onClick={refresh} disabled={loading} className="btn-secondary p-2" title="Refresh">
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
        </button>

        {canManage && (
          <button
            onClick={() => { setSelected(null); setShowModal(true) }}
            className="btn-primary"
          >
            <Plus className="w-4 h-4" />
            Add Driver
          </button>
        )}
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Drivers', value: drivers.length, color: 'text-white' },
          { label: 'Available Now', value: drivers.filter((d) => d.is_available).length, color: 'text-emerald-400' },
          { label: 'Unavailable', value: drivers.filter((d) => !d.is_available).length, color: 'text-red-400' },
        ].map((s) => (
          <div key={s.label} className="card py-3 text-center">
            <p className={cn('text-2xl font-display font-bold', s.color)}>{s.value}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          icon="🚗"
          title={search || availableOnly ? 'No drivers match your filters' : 'No drivers yet'}
          description={canManage ? 'Add your first driver to get started.' : 'No driver records found.'}
          action={canManage ? (
            <button onClick={() => { setSelected(null); setShowModal(true) }} className="btn-primary">
              <Plus className="w-4 h-4" />
              Add Driver
            </button>
          ) : undefined}
        />
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-xs text-slate-500 uppercase tracking-wider">
                  <th className="px-4 py-3 text-left font-medium">Driver</th>
                  <th className="px-4 py-3 text-left font-medium">Contact</th>
                  <th className="px-4 py-3 text-left font-medium">License</th>
                  <th className="px-4 py-3 text-left font-medium">Vehicles</th>
                  <th className="px-4 py-3 text-left font-medium">Supplier</th>
                  <th className="px-4 py-3 text-left font-medium">Upcoming</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  {canManage && <th className="px-4 py-3 text-right font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map((d) => {
                  const expired = isExpired(d.license_expiry)
                  const expiringSoon = isExpiringSoon(d.license_expiry)
                  return (
                    <tr key={d.id} className="table-row-hover">
                      {/* Name */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-fleet-600/40 to-purple-600/40 flex items-center justify-center text-xs font-bold text-fleet-300 shrink-0">
                            {d.full_name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                          </div>
                          <span className="font-medium text-slate-200 text-xs">{d.full_name}</span>
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                          <Phone className="w-3 h-3 shrink-0" />
                          {d.phone}
                        </div>
                      </td>

                      {/* License */}
                      <td className="px-4 py-3">
                        <p className="text-xs text-slate-300 font-mono">{d.license_number}</p>
                        {d.license_expiry && (
                          <p className={cn(
                            'text-[10px] mt-0.5',
                            expired ? 'text-red-400 font-semibold' : expiringSoon ? 'text-amber-400' : 'text-slate-500'
                          )}>
                            {expired ? '⚠ Expired ' : expiringSoon ? '⚠ Expires ' : 'Exp. '}
                            {new Date(d.license_expiry).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        )}
                      </td>

                      {/* Vehicle types */}
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {d.vehicle_types.length === 0 ? (
                            <span className="text-xs text-slate-600">—</span>
                          ) : (
                            d.vehicle_types.slice(0, 3).map((vt) => (
                              <span key={vt} className="px-1.5 py-0.5 rounded-md bg-white/5 text-[10px] text-slate-400 border border-white/8">
                                {vehicleLabels[vt]}
                              </span>
                            ))
                          )}
                          {d.vehicle_types.length > 3 && (
                            <span className="text-[10px] text-slate-500">+{d.vehicle_types.length - 3}</span>
                          )}
                        </div>
                      </td>

                      {/* Supplier */}
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {(d.suppliers as any)?.company_name ?? '—'}
                      </td>

                      {/* Upcoming trips */}
                      <td className="px-4 py-3">
                        {(upcomingCounts[d.id] ?? 0) > 0 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-fleet-500/20 text-fleet-300 text-[10px] font-bold border border-fleet-500/30">
                            {upcomingCounts[d.id]}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-600">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        {(() => {
                          const active = d.is_available ? getActiveAssignment(d.id, activeAssignments) : null
                          if (active) {
                            return (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-400"
                                title={`On a trip until ${new Date(active.dropoff_datetime ?? active.pickup_datetime).toLocaleString()}`}
                              >
                                🚗 On Trip
                              </span>
                            )
                          }
                          return (
                            <span className={cn(
                              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold',
                              d.is_available
                                ? 'bg-emerald-500/15 text-emerald-400'
                                : 'bg-red-500/15 text-red-400'
                            )}>
                              {d.is_available ? <UserCheck className="w-3 h-3" /> : <UserX className="w-3 h-3" />}
                              {d.is_available ? 'Available' : 'Unavailable'}
                            </span>
                          )
                        })()}
                      </td>

                      {/* Actions */}
                      {canManage && (
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => toggleAvailability(d)}
                              title={d.is_available ? 'Mark unavailable' : 'Mark available'}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/8 transition-colors text-xs"
                            >
                              {d.is_available ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              onClick={() => { setSelected(d); setShowModal(true) }}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-fleet-300 hover:bg-fleet-500/10 transition-colors text-xs"
                            >
                              Edit
                            </button>
                            {profile.role === 'admin' && (
                              <button
                                onClick={() => setConfirmDelete(d)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors text-xs"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2.5 border-t border-white/5 text-xs text-slate-500">
            {filtered.length} of {drivers.length} driver{drivers.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {/* Modals */}
      <DriverModal
        open={showModal}
        onClose={() => setShowModal(false)}
        driver={selected}
        suppliers={suppliers}
        onSuccess={refresh}
      />

      {confirmDelete && (
        <ConfirmDeleteDialog
          driver={confirmDelete}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  )
}
