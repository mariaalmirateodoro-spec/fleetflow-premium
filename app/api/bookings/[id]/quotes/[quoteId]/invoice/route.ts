import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { logAudit } from '@/lib/audit'

function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// Called after the browser has already uploaded the file straight to
// Supabase Storage (bucket: supplier-invoices). This just records which
// storage path belongs to which quote, and logs it.
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

  const admin = createAdminClient()
  const { data: quote, error } = await admin
    .from('quotes')
    .update({ invoice_path: path })
    .eq('id', params.quoteId)
    .select('supplier_id, total_amount')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const { data: supplier } = await admin.from('suppliers').select('company_name').eq('id', quote.supplier_id).single()
  await logAudit(admin, {
    bookingId: params.id,
    actorId: user.id,
    actorName: profile.full_name || user.email || 'Unknown',
    action: 'invoice_uploaded',
    note: `Uploaded invoice from ${supplier?.company_name ?? 'supplier'} (quoted ${quote.total_amount})`,
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

  const admin = createAdminClient()
  const { data: quote } = await admin.from('quotes').select('invoice_path').eq('id', params.quoteId).single()
  if (!quote?.invoice_path) return NextResponse.json({ error: 'No invoice on file' }, { status: 404 })

  const { data, error } = await admin.storage
    .from('supplier-invoices')
    .createSignedUrl(quote.invoice_path, 60)

  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Failed to create link' }, { status: 400 })
  return NextResponse.json({ url: data.signedUrl })
}
