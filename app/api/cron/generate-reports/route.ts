import { NextResponse } from 'next/server'
import { generateReports } from '@/lib/reports'

export async function GET(request: Request) {
  // Verify this is called by Vercel Cron
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { generatedAt } = await generateReports()
    return NextResponse.json({
      message: 'Reports generated',
      generatedAt,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[generate-reports] error:', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
