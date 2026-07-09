import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { createClient } from '@/lib/supabase/server'
import { logAudit, adminClient } from '@/lib/audit'
import { db, schema } from '@/lib/db'

// Adds a new quote to a booking. Moved server-side (from a direct client-side
// Supabase insert) so it can be audit-logged like the other booking mutations.
//
// Talks directly to Postgres via Drizzle instead of PostgREST. While
// converting this route, found a real pre-existing bug: this handler (and
// several others touching quotes) read/wrote a column called `total_amount`,
// which was never actually the DB column's name — it's `amount_usd`
// (confirmed via information_schema.columns and schema.sql, which has
// always defined it as amount_usd). Every insert here would have failed
// with a "column does not exist" error, meaning "Add Quote" likely never
// worked in production. Fixed as part of this migration — Drizzle's typed
// insert wouldn't compile against a `total_amount` field that doesn't exist
// in the schema, which is what surfaced this.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single()
  if (!profile || !['admin', 'manager', 'staff'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { supplier_id, amount_usd, includes_driver, vehicle_model, notes } = body as {
    supplier_id: string
    amount_usd: number
    includes_driver?: boolean
    vehicle_model?: string | null
    notes?: string | null
  }

  const [created] = await db
    .insert(schema.quotes)
    .values({
      bookingId: params.id,
      supplierId: supplier_id,
      amountUsd: String(amount_usd),
      includesDriver: includes_driver ?? false,
      vehicleModel: vehicle_model || null,
      notes: notes || null,
      createdBy: user.id,
    })
    .returning()

  if (!created) return NextResponse.json({ error: 'Failed to add quote' }, { status: 400 })

  const [supplier] = await db
    .select({ companyName: schema.suppliers.companyName })
    .from(schema.suppliers)
    .where(eq(schema.suppliers.id, supplier_id))
    .limit(1)

  await logAudit(adminClient(), {
    bookingId: params.id,
    actorId: user.id,
    actorName: profile.full_name || user.email || 'Unknown',
    action: 'quote_added',
    note: `Added quote from ${supplier?.companyName ?? 'supplier'} for ${amount_usd}`,
  })

  const data = {
    id: created.id,
    booking_id: created.bookingId,
    supplier_id: created.supplierId,
    amount_usd: Number(created.amountUsd),
    includes_driver: created.includesDriver,
    vehicle_model: created.vehicleModel,
    estimated_duration_hours: created.estimatedDurationHours != null ? Number(created.estimatedDurationHours) : null,
    valid_until: created.validUntil,
    notes: created.notes,
    is_selected: created.isSelected,
    invoice_path: created.invoicePath,
    created_by: created.createdBy,
    created_at: created.createdAt,
  }

  return NextResponse.json({ data }, { status: 201 })
}
