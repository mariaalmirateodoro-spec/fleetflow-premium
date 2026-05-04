import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Topbar } from '@/components/layout/Topbar'
import { UsersClient } from '@/components/users/UsersClient'

export const metadata: Metadata = { title: 'User Management' }

export default async function UsersPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')
  if (profile.role !== 'admin') redirect('/dashboard')

  const supabase = createClient()
  const { data: users } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: true })

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar profile={profile} title="User Management" subtitle="Manage team access and roles" />
      <div className="flex-1 overflow-y-auto p-6">
        <UsersClient users={users ?? []} currentUser={profile} />
      </div>
    </div>
  )
}
