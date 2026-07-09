'use client'

import { useState } from 'react'
import { RefreshCw, Download } from 'lucide-react'
import { ReportsContent } from '@/components/reports/ReportsContent'
import type { DashboardReportData } from '@/lib/reports'

interface Props {
  initialData: DashboardReportData
  initialGeneratedAt: string
  isLive: boolean // true when this was computed on-the-fly (no cache row existed yet)
}

export function ReportsPageClient({ initialData, initialGeneratedAt, isLive }: Props) {
  const [data, setData] = useState(initialData)
  const [generatedAt, setGeneratedAt] = useState(initialGeneratedAt)
  const [live, setLive] = useState(isLive)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function regenerate() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/reports/regenerate', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to regenerate reports')
      setData(json.data)
      setGeneratedAt(json.generatedAt)
      setLive(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
        <p className="text-slate-500">
          {live
            ? 'No cached report yet — showing a live calculation. '
            : `Cached report generated ${new Date(generatedAt).toLocaleString('en-US', {
                dateStyle: 'medium',
                timeStyle: 'short',
                timeZone: 'Asia/Manila',
              })}. `}
          {error && <span className="text-red-400 ml-1">{error}</span>}
        </p>
        <div className="flex items-center gap-2">
          <a
            href="/api/reports/export"
            className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5"
            title="Download this report as a formatted Excel file"
          >
            <Download className="w-3.5 h-3.5" />
            Export to Excel
          </a>
          <button
            onClick={regenerate}
            disabled={loading}
            className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Regenerating…' : 'Regenerate now'}
          </button>
        </div>
      </div>
      <ReportsContent {...data} />
    </div>
  )
}
