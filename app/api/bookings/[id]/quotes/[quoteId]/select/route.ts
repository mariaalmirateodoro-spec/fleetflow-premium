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

// Marks a quote as selected and assigns its supplier to the booking. Moved
// server-side (from direct client-side Supabase writes) so supplier changes
// made this way are audit-logged like other booking mutations.
export async function POST(
  _: NextRequest,
  { params }: { params: { id: string; quoteId: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single()
  if (!profile || !['admin', 'manager', 'staff'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()

  const { data: existingBooking } = await admin.from('bookings').select('assigned_supplier').eq('id', params.id).single()
  const { data: quote } = await admin.from('quotes').select('supplier_id, total_amount, suppliers(company_name)').eq('id', params.quoteId).single()

  if (!quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })

  await admin.from('quotes').update({ is_selected: false }).eq('booking_id', params.id)
  await admin.from('quotes').update({ is_selected: true }).eq('id', params.quoteId)

  const { error } = await admin
    .from('bookings')
    .update({ status: 'quoted', assigned_supplier: quote.supplier_id })
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const supplierName = Array.isArray(quote.suppliers) ? quote.suppliers[0]?.company_name : (quote.suppliers as { company_name: string } | null)?.company_name

  await logAudit(admin, {
    bookingId: params.id,
    actorId: user.id,
    actorName: profile.full_name || user.email || 'Unknown',
    action: 'quote_selected',
    field: 'assigned_supplier',
    oldValue: existingBooking?.assigned_supplier ?? null,
    newValue: quote.supplier_id,
    note: `Selected quote from ${supplierName ?? 'supplier'} for ${quote.total_amount}`,
  })

  return NextResponse.json({ success: true })
}
