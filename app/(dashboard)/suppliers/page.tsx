import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Topbar } from '@/components/layout/Topbar'
import { SuppliersClient } from '@/components/suppliers/SuppliersClient'

export const metadata: Metadata = { title: 'Suppliers' }

export default async function SuppliersPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  const supabase = createClient()
  const { data: suppliers } = await supabase
    .from('suppliers')
    .select('*')
    .order('company_name')

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar profile={profile} title="Suppliers" subtitle="Manage transport providers and rates" />
      <div className="flex-1 overflow-y-auto p-6">
        <SuppliersClient initialSuppliers={suppliers ?? []} profile={profile} />
      </div>
    </div>
  )
}
