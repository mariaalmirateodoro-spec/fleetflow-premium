'use client'

import { useState } from 'react'
import { Loader2, Save, User, Lock, Bell } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { getInitials, roleConfig } from '@/lib/utils'
import type { Profile, NotificationPreferences } from '@/types'

interface Props { profile: Profile }

export function SettingsContent({ profile }: Props) {
  const { toast } = useToast()
  const [tab, setTab] = useState<'profile' | 'password' | 'notifications'>('profile')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ full_name: profile.full_name, phone: profile.phone ?? '', department: profile.department ?? '' })
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' })

  const defaultNotifPrefs: NotificationPreferences = {
    new_booking_request: true,
    approval_needed: true,
    booking_approved: true,
    payment_due: profile.role === 'finance',
    system_notifications: false,
  }
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences>(
    profile.notification_preferences ?? defaultNotifPrefs
  )
  const [notifSaving, setNotifSaving] = useState(false)

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('profiles').update({ full_name: form.full_name, phone: form.phone || null, department: form.department || null }).eq('id', profile.id)
    setSaving(false)
    toast(error ? 'Failed to save' : 'Profile updated!', error ? 'error' : 'success')
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    if (pwForm.newPw !== pwForm.confirm) { toast('Passwords do not match', 'error'); return }
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: pwForm.newPw })
    setSaving(false)
    if (error) toast(error.message, 'error')
    else { toast('Password updated!', 'success'); setPwForm({ current: '', newPw: '', confirm: '' }) }
  }

  async function saveNotifications(e: React.FormEvent) {
    e.preventDefault(); setNotifSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('profiles')
      .update({ notification_preferences: notifPrefs })
      .eq('id', profile.id)
    setNotifSaving(false)
    toast(error ? 'Failed to save preferences' : 'Notification preferences saved!', error ? 'error' : 'success')
  }

  const roleCfg = roleConfig[profile.role]
  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'password', label: 'Password', icon: Lock },
    { id: 'notifications', label: 'Notifications', icon: Bell },
  ] as const

  return (
    <div className="max-w-2xl animate-fade-in">
      {/* Profile card */}
      <div className="card flex items-center gap-5 mb-6">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-fleet-600 to-purple-600 flex items-center justify-center text-white text-xl font-bold shrink-0 shadow-fleet">
          {getInitials(profile.full_name || profile.email)}
        </div>
        <div>
          <h2 className="text-lg font-display font-bold text-white">{profile.full_name || 'Set your name'}</h2>
          <p className="text-sm text-slate-400">{profile.email}</p>
          <span className={`badge mt-1 ${roleCfg.bg} ${roleCfg.color}`}>{roleCfg.label}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 glass rounded-xl p-1 mb-6 border border-white/8">
        {tabs.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all flex-1 justify-center ${
                tab === t.id ? 'bg-white/12 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Profile tab */}
      {tab === 'profile' && (
        <form onSubmit={saveProfile} className="card space-y-4 animate-fade-in">
          <h3 className="text-sm font-semibold text-white">Personal Information</h3>
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block font-medium">Full Name</label>
            <input value={form.full_name} onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
              placeholder="Your full name" className="input-dark" />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block font-medium">Email</label>
            <input value={profile.email} disabled className="input-dark opacity-50 cursor-not-allowed" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block font-medium">Phone</label>
              <input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                placeholder="+1 555-0000" className="input-dark" />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block font-medium">Department</label>
              <input value={form.department} onChange={(e) => setForm((p) => ({ ...p, department: e.target.value }))}
                placeholder="e.g. Guest Relations" className="input-dark" />
            </div>
          </div>
          <div className="flex justify-end pt-2 border-t border-white/8">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Changes
            </button>
          </div>
        </form>
      )}

      {/* Password tab */}
      {tab === 'password' && (
        <form onSubmit={changePassword} className="card space-y-4 animate-fade-in">
          <h3 className="text-sm font-semibold text-white">Change Password</h3>
          {['new', 'confirm'].map((field) => (
            <div key={field}>
              <label className="text-xs text-slate-400 mb-1.5 block font-medium capitalize">
                {field === 'new' ? 'New Password' : 'Confirm New Password'}
              </label>
              <input
                type="password"
                value={field === 'new' ? pwForm.newPw : pwForm.confirm}
                onChange={(e) => setPwForm((p) => ({ ...p, [field === 'new' ? 'newPw' : 'confirm']: e.target.value }))}
                placeholder="••••••••"
                minLength={8}
                required
                className="input-dark"
              />
            </div>
          ))}
          <p className="text-xs text-slate-500">Minimum 8 characters.</p>
          <div className="flex justify-end pt-2 border-t border-white/8">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              Update Password
            </button>
          </div>
        </form>
      )}

      {/* Notifications tab */}
      {tab === 'notifications' && (
        <form onSubmit={saveNotifications} className="card space-y-4 animate-fade-in">
          <h3 className="text-sm font-semibold text-white">Notification Preferences</h3>
          <p className="text-xs text-slate-400">Control which in-app events trigger notifications for you.</p>
          {(
            [
              { key: 'new_booking_request', label: 'New booking request', desc: 'When a new transport request is submitted' },
              { key: 'approval_needed',     label: 'Approval needed',     desc: 'When a booking is ready for your review' },
              { key: 'booking_approved',    label: 'Booking approved',    desc: 'When your submitted booking gets approved' },
              { key: 'payment_due',         label: 'Payment due reminder',desc: 'When a supplier payment is coming due' },
              { key: 'system_notifications',label: 'System notifications',desc: 'General system updates and announcements' },
            ] as { key: keyof NotificationPreferences; label: string; desc: string }[]
          ).map((item) => (
            <div key={item.key} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
              <div>
                <p className="text-sm text-slate-200 font-medium">{item.label}</p>
                <p className="text-xs text-slate-500">{item.desc}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={notifPrefs[item.key]}
                onClick={() => setNotifPrefs((p) => ({ ...p, [item.key]: !p[item.key] }))}
                className={`relative w-10 h-5 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-fleet-500 ${
                  notifPrefs[item.key] ? 'bg-fleet-600' : 'bg-white/10'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    notifPrefs[item.key] ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          ))}
          <div className="flex justify-end pt-2 border-t border-white/8">
            <button type="submit" disabled={notifSaving} className="btn-primary">
              {notifSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Preferences
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
