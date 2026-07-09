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

// Layout: every sheet gets a blank left margin column (A) and a blank top
// margin row (1), so the title/table don't start flush against the sheet
// edges — the previous version placed everything starting at A1, which read
// as cramped once opened in Excel. Content now starts at column B, with the
// title/subtitle/table stacked with an extra blank row between the subtitle
// and the table header for breathing room.
const MARGIN_COL = 1 // column A
const CONTENT_COL = 2 // column B — first real column
const TITLE_ROW = 2
const SUBTITLE_ROW = 3
const HEADER_ROW = 6
const DATA_FIRST_ROW = 7

function styleHeaderRow(ws: ExcelJS.Worksheet, row: number, ncols: number, fill = FLEET) {
  for (let c = CONTENT_COL; c < CONTENT_COL + ncols; c++) {
    const cell = ws.getRow(row).getCell(c)
    cell.font = { bold: true, color: { argb: WHITE }, size: HEADER_SIZE }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border = thinBorder
  }
  ws.getRow(row).height = 24
}

function setRowValues(ws: ExcelJS.Worksheet, row: number, values: (string | number)[]) {
  values.forEach((v, i) => {
    ws.getRow(row).getCell(CONTENT_COL + i).value = v
  })
}

function titleBlock(ws: ExcelJS.Worksheet, title: string, subtitle: string) {
  ws.getRow(1).height = 12
  ws.getCell(TITLE_ROW, CONTENT_COL).value = title
  ws.getCell(TITLE_ROW, CONTENT_COL).font = { bold: true, size: 20, color: { argb: NAVY } }
  if (subtitle) {
    ws.getCell(SUBTITLE_ROW, CONTENT_COL).value = subtitle
    ws.getCell(SUBTITLE_ROW, CONTENT_COL).font = { italic: true, size: 13, color: { argb: GRAY } }
  }
  ws.getRow(TITLE_ROW).height = 28
  ws.getRow(SUBTITLE_ROW).height = 20
  ws.getRow(4).height = 10
  ws.getRow(5).height = 10
  ws.getColumn(MARGIN_COL).width = 3
}

function zebra(ws: ExcelJS.Worksheet, firstRow: number, lastRow: number, ncols: number) {
  for (let r = firstRow; r <= lastRow; r++) {
    const fill = (r - firstRow) % 2 === 0 ? LIGHT : WHITE
    for (let c = CONTENT_COL; c < CONTENT_COL + ncols; c++) {
      const cell = ws.getRow(r).getCell(c)
      cell.border = thinBorder
      cell.font = { ...(cell.font ?? {}), size: BODY_SIZE }
      if (!cell.fill || cell.fill.type !== 'pattern') {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } }
      }
    }
    ws.getRow(r).height = 20
  }
}

function totalRowFill(ws: ExcelJS.Worksheet, row: number, ncols: number) {
  for (let c = CONTENT_COL; c < CONTENT_COL + ncols; c++) {
    ws.getRow(row).getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GOLD } }
    ws.getRow(row).getCell(c).border = thinBorder
  }
  ws.getRow(row).height = 20
}

// Excel column letter for a 1-based column index (B, C, D, ...) — used to
// build SUM/percentage formulas that reference the (now offset) columns.
function colLetter(n: number): string {
  let s = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    s = String.fromCharCode(65 + rem) + s
    n = Math.floor((n - rem) / 26)
  }
  return s
}

function buildWorkbook(data: DashboardReportData, generatedAt: string): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'FleetFlow Premium'
  wb.created = new Date()

  const B = colLetter(CONTENT_COL)
  const C = colLetter(CONTENT_COL + 1)
  const D = colLetter(CONTENT_COL + 2)

  // ── Summary ────────────────────────────────────────────────
  const summ = wb.addWorksheet('Summary')
  summ.views = [{ showGridLines: false, state: 'frozen', ySplit: HEADER_ROW }]
  titleBlock(summ, 'FleetFlow — Business Summary', `Generated ${new Date(generatedAt).toLocaleString()}`)
  setRowValues(summ, HEADER_ROW, ['Metric', 'Value'])
  styleHeaderRow(summ, HEADER_ROW, 2)
  const kpis: [string, number, string][] = [
    ['Total Bookings', data.summary.totalBookings, '#,##0'],
    ['Completed Trips', data.summary.completedCount, '#,##0'],
    ['Cancelled Trips', data.summary.cancelledCount, '#,##0'],
    ['Total Spend (₱)', data.summary.totalSpend, '₱#,##0;(₱#,##0);"-"'],
    ['Total Savings (₱)', data.summary.totalSavings, '₱#,##0;(₱#,##0);"-"'],
  ]
  kpis.forEach(([label, val, fmt], i) => {
    const r = summ.getRow(DATA_FIRST_ROW + i)
    r.getCell(CONTENT_COL).value = label
    r.getCell(CONTENT_COL).font = { size: BODY_SIZE }
    r.getCell(CONTENT_COL + 1).value = val
    r.getCell(CONTENT_COL + 1).font = { size: BODY_SIZE, bold: true, color: { argb: '1E3A8A' } }
    r.getCell(CONTENT_COL + 1).numFmt = fmt
  })
  zebra(summ, DATA_FIRST_ROW, DATA_FIRST_ROW + kpis.length - 1, 2)
  summ.getColumn(CONTENT_COL).width = 30
  summ.getColumn(CONTENT_COL + 1).width = 22

  // ── Monthly Trend ──────────────────────────────────────────
  const mt = wb.addWorksheet('Monthly Trend')
  mt.views = [{ showGridLines: false, state: 'frozen', ySplit: HEADER_ROW }]
  titleBlock(mt, 'Monthly Bookings & Spend', 'Last 12 months')
  setRowValues(mt, HEADER_ROW, ['Month', 'Bookings', 'Spend (₱)'])
  styleHeaderRow(mt, HEADER_ROW, 3)
  data.monthlyData.forEach((m, i) => {
    const r = mt.getRow(DATA_FIRST_ROW + i)
    r.getCell(CONTENT_COL).value = m.month
    r.getCell(CONTENT_COL + 1).value = m.bookings
    r.getCell(CONTENT_COL + 1).numFmt = '#,##0'
    r.getCell(CONTENT_COL + 2).value = m.spend
    r.getCell(CONTENT_COL + 2).numFmt = '₱#,##0;(₱#,##0);"-"'
  })
  const mtLast = DATA_FIRST_ROW + data.monthlyData.length - 1
  const mtTotalRow = mtLast + 1
  const tRow = mt.getRow(mtTotalRow)
  tRow.getCell(CONTENT_COL).value = 'Total'
  tRow.getCell(CONTENT_COL).font = { bold: true, size: BODY_SIZE }
  tRow.getCell(CONTENT_COL + 1).value = { formula: `SUM(${C}${DATA_FIRST_ROW}:${C}${mtLast})` }
  tRow.getCell(CONTENT_COL + 1).font = { bold: true, size: BODY_SIZE }
  tRow.getCell(CONTENT_COL + 1).numFmt = '#,##0'
  tRow.getCell(CONTENT_COL + 2).value = { formula: `SUM(${D}${DATA_FIRST_ROW}:${D}${mtLast})` }
  tRow.getCell(CONTENT_COL + 2).font = { bold: true, size: BODY_SIZE }
  tRow.getCell(CONTENT_COL + 2).numFmt = '₱#,##0;(₱#,##0);"-"'
  totalRowFill(mt, mtTotalRow, 3)
  zebra(mt, DATA_FIRST_ROW, mtLast, 3)
  mt.getColumn(CONTENT_COL).width = 14
  mt.getColumn(CONTENT_COL + 1).width = 14
  mt.getColumn(CONTENT_COL + 2).width = 18

  // ── Status Breakdown ───────────────────────────────────────
  const sb = wb.addWorksheet('Status Breakdown')
  sb.views = [{ showGridLines: false, state: 'frozen', ySplit: HEADER_ROW }]
  titleBlock(sb, 'Bookings by Status', '')
  setRowValues(sb, HEADER_ROW, ['Status', 'Count', '% of Total'])
  styleHeaderRow(sb, HEADER_ROW, 3)
  data.statusData.forEach((s, i) => {
    const r = sb.getRow(DATA_FIRST_ROW + i)
    r.getCell(CONTENT_COL).value = s.status.charAt(0).toUpperCase() + s.status.slice(1)
    r.getCell(CONTENT_COL + 1).value = s.count
    r.getCell(CONTENT_COL + 1).numFmt = '#,##0'
  })
  const sbLast = DATA_FIRST_ROW + data.statusData.length - 1
  for (let i = 0; i < data.statusData.length; i++) {
    const r = sb.getRow(DATA_FIRST_ROW + i)
    r.getCell(CONTENT_COL + 2).value = { formula: `${C}${DATA_FIRST_ROW + i}/SUM(${C}${DATA_FIRST_ROW}:${C}${sbLast})` }
    r.getCell(CONTENT_COL + 2).numFmt = '0.0%'
  }
  const sbTotalRow = sbLast + 1
  const stRow = sb.getRow(sbTotalRow)
  stRow.getCell(CONTENT_COL).value = 'Total'
  stRow.getCell(CONTENT_COL).font = { bold: true, size: BODY_SIZE }
  stRow.getCell(CONTENT_COL + 1).value = { formula: `SUM(${C}${DATA_FIRST_ROW}:${C}${sbLast})` }
  stRow.getCell(CONTENT_COL + 1).font = { bold: true, size: BODY_SIZE }
  stRow.getCell(CONTENT_COL + 1).numFmt = '#,##0'
  stRow.getCell(CONTENT_COL + 2).value = { formula: `SUM(${D}${DATA_FIRST_ROW}:${D}${sbLast})` }
  stRow.getCell(CONTENT_COL + 2).font = { bold: true, size: BODY_SIZE }
  stRow.getCell(CONTENT_COL + 2).numFmt = '0.0%'
  totalRowFill(sb, sbTotalRow, 3)
  zebra(sb, DATA_FIRST_ROW, sbLast, 3)
  sb.getColumn(CONTENT_COL).width = 18
  sb.getColumn(CONTENT_COL + 1).width = 14
  sb.getColumn(CONTENT_COL + 2).width = 16

  // ── Top Suppliers ──────────────────────────────────────────
  const ts = wb.addWorksheet('Top Suppliers')
  ts.views = [{ showGridLines: false, state: 'frozen', ySplit: HEADER_ROW }]
  titleBlock(ts, 'Top Suppliers', 'Ranked by trip volume')
  setRowValues(ts, HEADER_ROW, ['Supplier', 'Bookings', 'Revenue (₱)', 'Rating'])
  styleHeaderRow(ts, HEADER_ROW, 4)
  data.topSuppliers.forEach((s, i) => {
    const r = ts.getRow(DATA_FIRST_ROW + i)
    r.getCell(CONTENT_COL).value = s.name
    r.getCell(CONTENT_COL + 1).value = s.bookings
    r.getCell(CONTENT_COL + 1).numFmt = '#,##0'
    r.getCell(CONTENT_COL + 2).value = s.revenue
    r.getCell(CONTENT_COL + 2).numFmt = '₱#,##0'
    r.getCell(CONTENT_COL + 3).value = s.rating
    r.getCell(CONTENT_COL + 3).numFmt = '0.0"  ★"'
  })
  const tsLast = DATA_FIRST_ROW + Math.max(data.topSuppliers.length, 1) - 1
  zebra(ts, DATA_FIRST_ROW, tsLast, 4)
  ts.getColumn(CONTENT_COL).width = 34
  ts.getColumn(CONTENT_COL + 1).width = 14
  ts.getColumn(CONTENT_COL + 2).width = 17
  ts.getColumn(CONTENT_COL + 3).width = 14

  // ── Driver Stats ───────────────────────────────────────────
  const ds = wb.addWorksheet('Driver Stats')
  ds.views = [{ showGridLines: false, state: 'frozen', ySplit: HEADER_ROW }]
  titleBlock(ds, 'Driver Stats', 'Trips & revenue per driver')
  setRowValues(ds, HEADER_ROW, ['Driver', 'Trips', 'Revenue (₱)'])
  styleHeaderRow(ds, HEADER_ROW, 3)
  data.driverStats.forEach((d, i) => {
    const r = ds.getRow(DATA_FIRST_ROW + i)
    r.getCell(CONTENT_COL).value = d.name
    r.getCell(CONTENT_COL + 1).value = d.trips
    r.getCell(CONTENT_COL + 1).numFmt = '#,##0'
    r.getCell(CONTENT_COL + 2).value = d.revenue
    r.getCell(CONTENT_COL + 2).numFmt = '₱#,##0'
  })
  const dsLast = DATA_FIRST_ROW + Math.max(data.driverStats.length, 1) - 1
  zebra(ds, DATA_FIRST_ROW, dsLast, 3)
  ds.getColumn(CONTENT_COL).width = 26
  ds.getColumn(CONTENT_COL + 1).width = 12
  ds.getColumn(CONTENT_COL + 2).width = 17

  // ── Frequent Routes ────────────────────────────────────────
  const fr = wb.addWorksheet('Frequent Routes')
  fr.views = [{ showGridLines: false, state: 'frozen', ySplit: HEADER_ROW }]
  titleBlock(fr, 'Frequent Routes', 'Most common pickup to dropoff pairs')
  setRowValues(fr, HEADER_ROW, ['Route', 'Trips'])
  styleHeaderRow(fr, HEADER_ROW, 2)
  data.frequentRoutes.forEach((route, i) => {
    const r = fr.getRow(DATA_FIRST_ROW + i)
    r.getCell(CONTENT_COL).value = route.route
    r.getCell(CONTENT_COL + 1).value = route.count
    r.getCell(CONTENT_COL + 1).numFmt = '#,##0'
  })
  const frLast = DATA_FIRST_ROW + Math.max(data.frequentRoutes.length, 1) - 1
  zebra(fr, DATA_FIRST_ROW, frLast, 2)
  fr.getColumn(CONTENT_COL).width = 44
  fr.getColumn(CONTENT_COL + 1).width = 12

  // ── Cost Savings ───────────────────────────────────────────
  const cs = wb.addWorksheet('Cost Savings')
  cs.views = [{ showGridLines: false, state: 'frozen', ySplit: HEADER_ROW }]
  titleBlock(cs, 'Cost Savings', 'Budget vs. actual on completed trips')
  setRowValues(cs, HEADER_ROW, ['Reference', 'Budget (₱)', 'Actual (₱)', 'Savings (₱)'])
  styleHeaderRow(cs, HEADER_ROW, 4)
  data.savingsData.forEach((s, i) => {
    const r = cs.getRow(DATA_FIRST_ROW + i)
    r.getCell(CONTENT_COL).value = s.reference_number
    r.getCell(CONTENT_COL + 1).value = s.budget
    r.getCell(CONTENT_COL + 1).numFmt = '₱#,##0'
    r.getCell(CONTENT_COL + 2).value = s.actual
    r.getCell(CONTENT_COL + 2).numFmt = '₱#,##0'
    r.getCell(CONTENT_COL + 3).value = s.savings
    r.getCell(CONTENT_COL + 3).numFmt = '₱#,##0;[RED](₱#,##0)'
  })
  const csLast = DATA_FIRST_ROW + Math.max(data.savingsData.length, 1) - 1
  zebra(cs, DATA_FIRST_ROW, csLast, 4)
  cs.getColumn(CONTENT_COL).width = 18
  cs.getColumn(CONTENT_COL + 1).width = 16
  cs.getColumn(CONTENT_COL + 2).width = 16
  cs.getColumn(CONTENT_COL + 3).width = 16

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
