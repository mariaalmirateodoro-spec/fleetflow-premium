'use client'

import { useState } from 'react'
import { Search, Shield, UserCheck, UserX, RefreshCw } from 'lucide-react'
import { cn, getInitials, roleConfig, timeAgo } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import type { Profile, UserRole } from '@/types'

interface Props {
  users: Profile[]
  currentUser: Profile
}

const ROLES: UserRole[] = ['admin', 'manager', 'staff', 'finance']

export function UsersClient({ users: initialUsers, currentUser }: Props) {
  const { toast } = useToast()
  const [users, setUsers] = useState<Profile[]>(initialUsers)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [editUser, setEditUser] = useState<Profile | null>(null)
  const [newRole, setNewRole] = useState<UserRole>('staff')

  const filtered = users.filter((u) => {
    const q = search.toLowerCase()
    return !q || u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.role.toLowerCase().includes(q)
  })

  async function refresh() {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: true })
    if (data) setUsers(data)
    setLoading(false)
  }

  // Role/status changes go through /api/users (instead of writing to Supabase
  // directly from the browser) so they show up in the Activity Log — this is
  // exactly the kind of action ("who changed whose permissions") that needs
  // to be traceable.
  async function updateRole() {
    if (!editUser) return
    setLoading(true)
    const res = await fetch('/api/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: editUser.id, role: newRole }),
    })
    if (!res.ok) toast('Failed to update role', 'error')
    else { toast(`${editUser.full_name}'s role updated to ${newRole}`, 'success'); setEditUser(null) }
    await refresh()
    setLoading(false)
  }

  async function toggleActive(user: Profile) {
    if (user.id === currentUser.id) { toast("You can't deactivate yourself", 'warning'); return }
    await fetch('/api/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, is_active: !user.is_active }),
    })
    toast(`${user.full_name} ${!user.is_active ? 'activated' : 'deactivated'}`, 'success')
    await refresh()
  }

  const roleStats = ROLES.map((r) => ({ role: r, count: users.filter((u) => u.role === r).length }))

  return (
    <>
      {/* Role stats */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {roleStats.map(({ role, count }) => {
          const cfg = roleConfig[role]
          return (
            <div key={role} className={`px-4 py-3 rounded-xl border ${cfg.bg} ${cfg.color} flex items-center justify-between`}>
              <div>
                <p className="text-[10px] uppercase tracking-wider opacity-70">{cfg.label}</p>
                <p className="text-xl font-bold mt-0.5">{count}</p>
              </div>
              <Shield className="w-5 h-5 opacity-40" />
            </div>
          )
        })}
      </div>

      {/* Search + actions */}
      <div className="flex gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users by name, email, or role…" className="input-dark pl-10 w-full" />
        </div>
        <button onClick={refresh} className="btn-secondary p-2.5">
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
        </button>
      </div>

      {/* Users table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8 text-xs text-slate-500 uppercase tracking-wider">
                {['User', 'Role', 'Department', 'Status', 'Joined', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((user) => {
                const cfg = roleConfig[user.role]
                const isCurrentUser = user.id === currentUser.id
                return (
                  <tr key={user.id} className="table-row-hover">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-fleet-600/40 to-purple-600/30 flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {getInitials(user.full_name || user.email)}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-200">
                            {user.full_name || '(no name)'} {isCurrentUser && <span className="text-fleet-400 text-[10px]">(you)</span>}
                          </p>
                          <p className="text-[11px] text-slate-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`badge ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-400">{user.department ?? '—'}</td>
                    <td className="px-4 py-3.5">
                      <Badge variant={user.is_active ? 'success' : 'danger'} className="text-[10px]">
                        {user.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-500">{timeAgo(user.created_at)}</td>
                    <td className="px-4 py-3.5">
                      {!isCurrentUser && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => { setEditUser(user); setNewRole(user.role) }}
                            className="text-xs px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                          >
                            Change Role
                          </button>
                          <button
                            onClick={() => toggleActive(user)}
                            className={cn('text-xs px-2 py-1 rounded-lg border transition-colors',
                              user.is_active
                                ? 'bg-red-500/5 border-red-500/20 text-red-400 hover:bg-red-500/15'
                                : 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/15'
                            )}
                          >
                            {user.is_active ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Role edit modal */}
      {editUser && (
        <Modal open={!!editUser} onClose={() => setEditUser(null)} title="Change User Role" subtitle={`${editUser.full_name} · ${editUser.email}`} size="sm">
          <div className="space-y-4">
            <div>
              <label className="text-xs text-slate-400 mb-2 block font-medium">New Role</label>
              <div className="space-y-2">
                {ROLES.map((r) => {
                  const cfg = roleConfig[r]
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setNewRole(r)}
                      className={cn(
                        'w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm transition-all',
                        newRole === r ? `${cfg.bg} ${cfg.color} border-current/30` : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'
                      )}
                    >
                      <span className="font-medium">{cfg.label}</span>
                      {newRole === r && <span className="text-xs">✓ Selected</span>}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2 border-t border-white/8">
              <button onClick={() => setEditUser(null)} className="btn-secondary">Cancel</button>
              <button onClick={updateRole} disabled={loading || newRole === editUser.role} className="btn-primary">
                Update Role
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
