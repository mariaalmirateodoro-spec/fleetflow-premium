import type { Metadata } from 'next'
import { getProfile } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Topbar } from '@/components/layout/Topbar'
import { SettingsContent } from '@/components/settings/SettingsContent'

export const metadata: Metadata = { title: 'Settings' }

export default async function SettingsPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar profile={profile} title="Settings" subtitle="Manage your account and preferences" />
      <div className="flex-1 overflow-y-auto p-6">
        <SettingsContent profile={profile} />
      </div>
    </div>
  )
}
