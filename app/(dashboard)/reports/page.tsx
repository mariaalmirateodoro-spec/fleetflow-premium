import type { Metadata } from 'next'
import { getProfile } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Topbar } from '@/components/layout/Topbar'
import { ReportsPageClient } from '@/components/reports/ReportsPageClient'
import { getCachedReports, computeDashboardReports } from '@/lib/reports'

export const metadata: Metadata = { title: 'Reports' }

export default async function ReportsPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')
  if (!['admin', 'finance', 'manager'].includes(profile.role)) redirect('/dashboard')

  // Read the pre-computed cache (populated once a day by the generate-reports
  // cron) instead of re-scanning and re-aggregating every booking on every
  // page load. If nothing has been cached yet — e.g. the first time this page
  // is ever opened, before the cron has run — fall back to computing it live
  // for this one request so the page still works immediately.
  const cached = await getCachedReports()
  const { data, generatedAt, isLive } = cached
    ? { data: cached.data, generatedAt: cached.generatedAt, isLive: false }
    : { data: await computeDashboardReports(), generatedAt: new Date().toISOString(), isLive: true }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar profile={profile} title="Reports" subtitle="Analytics and financial overview" />
      <div className="flex-1 overflow-y-auto p-6">
        <ReportsPageClient initialData={data} initialGeneratedAt={generatedAt} isLive={isLive} />
      </div>
    </div>
  )
}
