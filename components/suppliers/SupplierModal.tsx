'use client'

import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { createClient } from '@/lib/supabase/client'
import { vehicleLabels } from '@/lib/utils'
import type { Supplier, VehicleType } from '@/types'

const VEHICLE_TYPES: VehicleType[] = ['sedan', 'suv', 'van', 'minibus', 'luxury', 'pickup']

interface Props {
  open: boolean
  onClose: () => void
  supplier: Supplier | null
  onSuccess: () => void
}

export function SupplierModal({ open, onClose, supplier, onSuccess }: Props) {
  const isEdit = !!supplier
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    company_name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    vehicle_types: [] as VehicleType[],
    base_rate_usd: '',
    notes: '',
    is_preferred: false,
    is_available: true,
  })

  useEffect(() => {
    if (supplier) {
      setForm({
        company_name: supplier.company_name,
        contact_person: supplier.contact_person,
        phone: supplier.phone,
        email: supplier.email,
        address: supplier.address ?? '',
        vehicle_types: supplier.vehicle_types,
        base_rate_usd: supplier.base_rate_usd?.toString() ?? '',
        notes: supplier.notes ?? '',
        is_preferred: supplier.is_preferred,
        is_available: supplier.is_available,
      })
    }
  }, [supplier])

  function toggleVehicle(v: VehicleType) {
    setForm((p) => ({
      ...p,
      vehicle_types: p.vehicle_types.includes(v)
        ? p.vehicle_types.filter((x) => x !== v)
        : [...p.vehicle_types, v],
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const payload = {
      company_name: form.company_name,
      contact_person: form.contact_person,
      phone: form.phone,
      email: form.email,
      address: form.address || null,
      vehicle_types: form.vehicle_types,
      base_rate_usd: form.base_rate_usd ? parseFloat(form.base_rate_usd) : null,
      notes: form.notes || null,
      is_preferred: form.is_preferred,
      is_available: form.is_available,
    }

    let error
    if (isEdit) {
      ;({ error } = await supabase.from('suppliers').update(payload).eq('id', supplier!.id))
    } else {
      ;({ error } = await supabase.from('suppliers').insert(payload))
    }
    setLoading(false)
    if (!error) onSuccess()
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Supplier' : 'Add Supplier'} subtitle="Transport provider details" size="xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 sm:col-span-1">
            <label className="text-xs text-slate-400 mb-1.5 block font-medium">Company Name *</label>
            <input value={form.company_name} onChange={(e) => setForm((p) => ({ ...p, company_name: e.target.value }))}
              placeholder="e.g. Premier Limo Services" required className="input-dark" />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block font-medium">Contact Person *</label>
            <input value={form.contact_person} onChange={(e) => setForm((p) => ({ ...p, contact_person: e.target.value }))}
              placeholder="Full name" required className="input-dark" />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block font-medium">Phone *</label>
            <input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              placeholder="+1 555-0000" required className="input-dark" />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block font-medium">Email *</label>
            <input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              placeholder="contact@company.com" required className="input-dark" />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-slate-400 mb-1.5 block font-medium">Address</label>
            <input value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
              placeholder="Company address (optional)" className="input-dark" />
          </div>
        </div>

        {/* Vehicle types */}
        <div>
          <label className="text-xs text-slate-400 mb-2 block font-medium">Vehicle Types *</label>
          <div className="flex flex-wrap gap-2">
            {VEHICLE_TYPES.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => toggleVehicle(v)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                  form.vehicle_types.includes(v)
                    ? 'bg-fleet-500/20 border-fleet-500/40 text-fleet-300'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'
                }`}
              >
                {vehicleLabels[v]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block font-medium">Base Rate (PHP/trip)</label>
            <input type="number" min={0} value={form.base_rate_usd} onChange={(e) => setForm((p) => ({ ...p, base_rate_usd: e.target.value }))}
              placeholder="e.g. 120" className="input-dark" />
          </div>
          <div className="flex flex-col justify-end gap-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-400">
              <input type="checkbox" checked={form.is_preferred} onChange={(e) => setForm((p) => ({ ...p, is_preferred: e.target.checked }))} />
              Mark as Preferred Partner
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-400">
              <input type="checkbox" checked={form.is_available} onChange={(e) => setForm((p) => ({ ...p, is_available: e.target.checked }))} />
              Currently Available
            </label>
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-400 mb-1.5 block font-medium">Internal Notes</label>
          <textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            rows={2} placeholder="e.g. English-speaking drivers, 24/7 availability…" className="input-dark resize-none" />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-white/8">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={loading || form.vehicle_types.length === 0} className="btn-primary">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {isEdit ? 'Update Supplier' : 'Add Supplier'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
