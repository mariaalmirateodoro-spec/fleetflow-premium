import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { createClient } from '@/lib/supabase/server'
import { getCachedReports, computeDashboardReports, type DashboardReportData } from '@/lib/reports'

// Exports the exact same data shown on the Reports dashboard (cached report
// if one exists, otherwise a live calculation) as a formatted .xlsx workbook.
// Deliberately mirrors the existing Reports page's data — no invented
// categories — just a downloadable, nicely formatted version of it.

const FLEET = 'FF4F46E5'
const NAVY = 'FF1F2937'
const LIGHT = 'FFEEF2FF'
const WHITE = 'FFFFFFFF'
const GREEN = 'FF15803D'
const RED = 'FFB91C1C'
const AMBER = 'FFB45309'
const GOLD = 'FFFDE68A'
const GRAY = 'FF6B7280'

const thinBorder = {
  top: { style: 'thin' as const, color: { argb: 'FFD1D5DB' } },
  bottom: { style: 'thin' as const, color: { argb: 'FFD1D5DB' } },
  left: { style: 'thin' as const, color: { argb: 'FFD1D5DB' } },
  right: { style: 'thin' as const, color: { argb: 'FFD1D5DB' } },
}

const BODY_SIZE = 13
const HEADER_SIZE = 14

function styleHeaderRow(row: ExcelJS.Row, fill = FLEET) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: WHITE }, size: HEADER_SIZE }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border = thinBorder
  })
  row.height = 22
}

function titleBlock(ws: ExcelJS.Worksheet, title: string, subtitle: string) {
  ws.getCell('A1').value = title
  ws.getCell('A1').font = { bold: true, size: 20, color: { argb: NAVY } }
  ws.getCell('A2').value = subtitle
  ws.getCell('A2').font = { italic: true, size: 13, color: { argb: GRAY } }
  ws.getRow(1).height = 26
  ws.getRow(2).height = 18
}

function zebra(ws: ExcelJS.Worksheet, firstRow: number, lastRow: number, ncols: number) {
  for (let r = firstRow; r <= lastRow; r++) {
    const fill = (r - firstRow) % 2 === 0 ? LIGHT : WHITE
    for (let c = 1; c <= ncols; c++) {
      const cell = ws.getRow(r).getCell(c)
      cell.border = thinBorder
      cell.font = { ...(cell.font ?? {}), size: BODY_SIZE }
      if (!cell.fill || cell.fill.type !== 'pattern') {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } }
      }
    }
    ws.getRow(r).height = 18
  }
}

function buildWorkbook(data: DashboardReportData, generatedAt: string): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'FleetFlow Premium'
  wb.created = new Date()

  // ── About ──────────────────────────────────────────────────
  const about = wb.addWorksheet('About')
  about.views = [{ showGridLines: false }]
  about.getCell('B2').value = 'FleetFlow Premium — Business Report'
  about.getCell('B2').font = { bold: true, size: 22, color: { argb: NAVY } }
  about.getCell('B4').value = `Generated ${new Date(generatedAt).toLocaleString()}`
  about.getCell('B4').font = { size: 13, color: { argb: GRAY } }
  about.getCell('B7').value = 'Contents'
  about.getCell('B7').font = { bold: true, size: 15, color: { argb: NAVY } }
  ;[
    'Summary — key totals at a glance',
    'Monthly Trend — bookings & spend, last 12 months',
    'Status Breakdown — bookings by status',
    'Top Suppliers — ranked by trip volume',
    'Driver Stats — trips & revenue per driver',
    'Frequent Routes — most common pickup to dropoff pairs',
    'Cost Savings — budget vs. actual on completed trips',
  ].forEach((line, i) => {
    const cell = about.getCell(8 + i, 2)
    cell.value = '•  ' + line
    cell.font = { size: 13, color: { argb: NAVY } }
    about.getRow(8 + i).height = 18
  })
  about.getColumn(2).width = 80

  // ── Summary ────────────────────────────────────────────────
  const summ = wb.addWorksheet('Summary')
  summ.views = [{ showGridLines: false, state: 'frozen', ySplit: 4 }]
  titleBlock(summ, 'FleetFlow — Business Summary', `Generated ${new Date(generatedAt).toLocaleString()}`)
  summ.getRow(4).values = ['Metric', 'Value']
  styleHeaderRow(summ.getRow(4))
  const kpis: [string, number, string][] = [
    ['Total Bookings', data.summary.totalBookings, '#,##0'],
    ['Completed Trips', data.summary.completedCount, '#,##0'],
    ['Cancelled Trips', data.summary.cancelledCount, '#,##0'],
    ['Total Spend (₱)', data.summary.totalSpend, '₱#,##0;(₱#,##0);"-"'],
    ['Total Savings (₱)', data.summary.totalSavings, '₱#,##0;(₱#,##0);"-"'],
  ]
  kpis.forEach(([label, val, fmt], i) => {
    const r = summ.getRow(5 + i)
    r.getCell(1).value = label
    r.getCell(1).font = { size: BODY_SIZE }
    r.getCell(2).value = val
    r.getCell(2).font = { size: BODY_SIZE, bold: true, color: { argb: '1E3A8A' } }
    r.getCell(2).numFmt = fmt
  })
  zebra(summ, 5, 9, 2)
  summ.getColumn(1).width = 30
  summ.getColumn(2).width = 22

  // ── Monthly Trend ──────────────────────────────────────────
  const mt = wb.addWorksheet('Monthly Trend')
  mt.views = [{ showGridLines: false, state: 'frozen', ySplit: 4 }]
  titleBlock(mt, 'Monthly Bookings & Spend', 'Last 12 months')
  mt.getRow(4).values = ['Month', 'Bookings', 'Spend (₱)']
  styleHeaderRow(mt.getRow(4))
  const mtFirst = 5
  data.monthlyData.forEach((m, i) => {
    const r = mt.getRow(mtFirst + i)
    r.getCell(1).value = m.month
    r.getCell(2).value = m.bookings
    r.getCell(2).numFmt = '#,##0'
    r.getCell(3).value = m.spend
    r.getCell(3).numFmt = '₱#,##0;(₱#,##0);"-"'
  })
  const mtLast = mtFirst + data.monthlyData.length - 1
  const mtTotalRow = mtLast + 1
  const tRow = mt.getRow(mtTotalRow)
  tRow.getCell(1).value = 'Total'
  tRow.getCell(1).font = { bold: true, size: BODY_SIZE }
  tRow.getCell(2).value = { formula: `SUM(B${mtFirst}:B${mtLast})` }
  tRow.getCell(2).font = { bold: true, size: BODY_SIZE }
  tRow.getCell(2).numFmt = '#,##0'
  tRow.getCell(3).value = { formula: `SUM(C${mtFirst}:C${mtLast})` }
  tRow.getCell(3).font = { bold: true, size: BODY_SIZE }
  tRow.getCell(3).numFmt = '₱#,##0;(₱#,##0);"-"'
  tRow.height = 18
  for (let c = 1; c <= 3; c++) {
    tRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GOLD } }
    tRow.getCell(c).border = thinBorder
  }
  zebra(mt, mtFirst, mtLast, 3)
  mt.getColumn(1).width = 14
  mt.getColumn(2).width = 14
  mt.getColumn(3).width = 18

  // ── Status Breakdown ───────────────────────────────────────
  const sb = wb.addWorksheet('Status Breakdown')
  sb.views = [{ showGridLines: false, state: 'frozen', ySplit: 4 }]
  titleBlock(sb, 'Bookings by Status', '')
  sb.getRow(4).values = ['Status', 'Count', '% of Total']
  styleHeaderRow(sb.getRow(4))
  const sbFirst = 5
  data.statusData.forEach((s, i) => {
    const r = sb.getRow(sbFirst + i)
    r.getCell(1).value = s.status.charAt(0).toUpperCase() + s.status.slice(1)
    r.getCell(2).value = s.count
    r.getCell(2).numFmt = '#,##0'
  })
  const sbLast = sbFirst + data.statusData.length - 1
  for (let i = 0; i < data.statusData.length; i++) {
    const r = sb.getRow(sbFirst + i)
    r.getCell(3).value = { formula: `B${sbFirst + i}/SUM(B${sbFirst}:B${sbLast})` }
    r.getCell(3).numFmt = '0.0%'
  }
  const sbTotalRow = sbLast + 1
  const stRow = sb.getRow(sbTotalRow)
  stRow.getCell(1).value = 'Total'
  stRow.getCell(1).font = { bold: true, size: BODY_SIZE }
  stRow.getCell(2).value = { formula: `SUM(B${sbFirst}:B${sbLast})` }
  stRow.getCell(2).font = { bold: true, size: BODY_SIZE }
  stRow.getCell(2).numFmt = '#,##0'
  stRow.getCell(3).value = { formula: `SUM(C${sbFirst}:C${sbLast})` }
  stRow.getCell(3).font = { bold: true, size: BODY_SIZE }
  stRow.getCell(3).numFmt = '0.0%'
  stRow.height = 18
  for (let c = 1; c <= 3; c++) {
    stRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GOLD } }
    stRow.getCell(c).border = thinBorder
  }
  zebra(sb, sbFirst, sbLast, 3)
  sb.getColumn(1).width = 18
  sb.getColumn(2).width = 14
  sb.getColumn(3).width = 16

  // ── Top Suppliers ──────────────────────────────────────────
  const ts = wb.addWorksheet('Top Suppliers')
  ts.views = [{ showGridLines: false, state: 'frozen', ySplit: 4 }]
  titleBlock(ts, 'Top Suppliers', 'Ranked by trip volume')
  ts.getRow(4).values = ['Supplier', 'Bookings', 'Revenue (₱)', 'Rating']
  styleHeaderRow(ts.getRow(4))
  const tsFirst = 5
  data.topSuppliers.forEach((s, i) => {
    const r = ts.getRow(tsFirst + i)
    r.getCell(1).value = s.name
    r.getCell(2).value = s.bookings
    r.getCell(2).numFmt = '#,##0'
    r.getCell(3).value = s.revenue
    r.getCell(3).numFmt = '₱#,##0'
    r.getCell(4).value = s.rating
    r.getCell(4).numFmt = '0.0"  ★"'
  })
  const tsLast = tsFirst + Math.max(data.topSuppliers.length, 1) - 1
  zebra(ts, tsFirst, tsLast, 4)
  ts.getColumn(1).width = 34
  ts.getColumn(2).width = 14
  ts.getColumn(3).width = 17
  ts.getColumn(4).width = 14

  // ── Driver Stats ───────────────────────────────────────────
  const ds = wb.addWorksheet('Driver Stats')
  ds.views = [{ showGridLines: false, state: 'frozen', ySplit: 4 }]
  titleBlock(ds, 'Driver Stats', 'Trips & revenue per driver')
  ds.getRow(4).values = ['Driver', 'Trips', 'Revenue (₱)']
  styleHeaderRow(ds.getRow(4))
  const dsFirst = 5
  data.driverStats.forEach((d, i) => {
    const r = ds.getRow(dsFirst + i)
    r.getCell(1).value = d.name
    r.getCell(2).value = d.trips
    r.getCell(2).numFmt = '#,##0'
    r.getCell(3).value = d.revenue
    r.getCell(3).numFmt = '₱#,##0'
  })
  const dsLast = dsFirst + Math.max(data.driverStats.length, 1) - 1
  zebra(ds, dsFirst, dsLast, 3)
  ds.getColumn(1).width = 26
  ds.getColumn(2).width = 12
  ds.getColumn(3).width = 17

  // ── Frequent Routes ────────────────────────────────────────
  const fr = wb.addWorksheet('Frequent Routes')
  fr.views = [{ showGridLines: false, state: 'frozen', ySplit: 4 }]
  titleBlock(fr, 'Frequent Routes', 'Most common pickup to dropoff pairs')
  fr.getRow(4).values = ['Route', 'Trips']
  styleHeaderRow(fr.getRow(4))
  const frFirst = 5
  data.frequentRoutes.forEach((route, i) => {
    const r = fr.getRow(frFirst + i)
    r.getCell(1).value = route.route
    r.getCell(2).value = route.count
    r.getCell(2).numFmt = '#,##0'
  })
  const frLast = frFirst + Math.max(data.frequentRoutes.length, 1) - 1
  zebra(fr, frFirst, frLast, 2)
  fr.getColumn(1).width = 44
  fr.getColumn(2).width = 12

  // ── Cost Savings ───────────────────────────────────────────
  const cs = wb.addWorksheet('Cost Savings')
  cs.views = [{ showGridLines: false, state: 'frozen', ySplit: 4 }]
  titleBlock(cs, 'Cost Savings', 'Budget vs. actual on completed trips')
  cs.getRow(4).values = ['Reference', 'Budget (₱)', 'Actual (₱)', 'Savings (₱)']
  styleHeaderRow(cs.getRow(4))
  const csFirst = 5
  data.savingsData.forEach((s, i) => {
    const r = cs.getRow(csFirst + i)
    r.getCell(1).value = s.reference_number
    r.getCell(2).value = s.budget
    r.getCell(2).numFmt = '₱#,##0'
    r.getCell(3).value = s.actual
    r.getCell(3).numFmt = '₱#,##0'
    r.getCell(4).value = s.savings
    r.getCell(4).numFmt = '₱#,##0;[RED](₱#,##0)'
  })
  const csLast = csFirst + Math.max(data.savingsData.length, 1) - 1
  zebra(cs, csFirst, csLast, 4)
  cs.getColumn(1).width = 18
  cs.getColumn(2).width = 16
  cs.getColumn(3).width = 16
  cs.getColumn(4).width = 16

  return wb
}

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'manager', 'finance'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const cached = await getCachedReports()
  const data = cached?.data ?? (await computeDashboardReports())
  const generatedAt = cached?.generatedAt ?? new Date().toISOString()

  const wb = buildWorkbook(data, generatedAt)
  const buffer = await wb.xlsx.writeBuffer()

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="FleetFlow_Report_${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  })
}
