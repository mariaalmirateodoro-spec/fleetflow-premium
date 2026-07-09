import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { createClient } from '@/lib/supabase/server'
import { logAudit, adminClient } from '@/lib/audit'
import { db, schema } from '@/lib/db'

// adminClient() (from lib/audit.ts) is only used below for Supabase Storage
// (signed URLs) — a separate service from the database/PostgREST, not
// something Drizzle has any concept of, so it stays on supabase-js.

// Called after the browser has already uploaded the file straight to
// Supabase Storage (bucket: supplier-invoices). This just records which
// storage path belongs to which quote, and logs it. The DB update/select
// here now goes through Drizzle instead of PostgREST — also fixes the same
// total_amount -> amount_usd column-name bug described in ../route.ts
// (this handler used to select `total_amount`, which isn't a real column,
// so uploading an invoice would have failed every time).
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; quoteId: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single()
  if (!profile || !['admin', 'manager', 'staff', 'finance'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { path } = await request.json() as { path: string }
  if (!path) return NextResponse.json({ error: 'Missing file path' }, { status: 400 })

  const [quote] = await db
    .update(schema.quotes)
    .set({ invoicePath: path })
    .where(eq(schema.quotes.id, params.quoteId))
    .returning({ supplierId: schema.quotes.supplierId, amountUsd: schema.quotes.amountUsd })

  if (!quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })

  const [supplier] = await db
    .select({ companyName: schema.suppliers.companyName })
    .from(schema.suppliers)
    .where(eq(schema.suppliers.id, quote.supplierId))
    .limit(1)

  await logAudit(adminClient(), {
    bookingId: params.id,
    actorId: user.id,
    actorName: profile.full_name || user.email || 'Unknown',
    action: 'invoice_uploaded',
    note: `Uploaded invoice from ${supplier?.companyName ?? 'supplier'} (quoted ${quote.amountUsd})`,
  })

  return NextResponse.json({ success: true })
}

// Generates a short-lived signed URL so the invoice can be viewed — the
// bucket is private, so there's no permanent public link.
export async function GET(
  _: NextRequest,
  { params }: { params: { id: string; quoteId: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [quote] = await db
    .select({ invoicePath: schema.quotes.invoicePath })
    .from(schema.quotes)
    .where(eq(schema.quotes.id, params.quoteId))
    .limit(1)
  if (!quote?.invoicePath) return NextResponse.json({ error: 'No invoice on file' }, { status: 404 })

  const admin = adminClient()
  const { data, error } = await admin.storage
    .from('supplier-invoices')
    .createSignedUrl(quote.invoicePath, 60)

  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Failed to create link' }, { status: 400 })
  return NextResponse.json({ url: data.signedUrl })
}
