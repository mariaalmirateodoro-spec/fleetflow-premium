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

// Adds a new quote to a booking. Moved server-side (from a direct client-side
// Supabase insert) so it can be audit-logged like the other booking mutations.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single()
  if (!profile || !['admin', 'manager', 'staff'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { supplier_id, total_amount, includes_driver, vehicle_model, notes } = body as {
    supplier_id: string
    total_amount: number
    includes_driver?: boolean
    vehicle_model?: string | null
    notes?: string | null
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('quotes')
    .insert({
      booking_id: params.id,
      supplier_id,
      total_amount,
      includes_driver: includes_driver ?? false,
      vehicle_model: vehicle_model || null,
      notes: notes || null,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const { data: supplier } = await admin.from('suppliers').select('company_name').eq('id', supplier_id).single()
  await logAudit(admin, {
    bookingId: params.id,
    actorId: user.id,
    actorName: profile.full_name || user.email || 'Unknown',
    action: 'quote_added',
    note: `Added quote from ${supplier?.company_name ?? 'supplier'} for ${total_amount}`,
  })

  return NextResponse.json({ data }, { status: 201 })
}
