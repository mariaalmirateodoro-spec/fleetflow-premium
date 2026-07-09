import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { createClient } from '@/lib/supabase/server'
import { logAudit, adminClient } from '@/lib/audit'
import { db, schema } from '@/lib/db'

// Marks a quote as selected and assigns its supplier to the booking. Moved
// server-side (from direct client-side Supabase writes) so supplier changes
// made this way are audit-logged like other booking mutations.
//
// Talks directly to Postgres via Drizzle instead of PostgREST — also fixes
// the same total_amount -> amount_usd column-name bug described in
// ../route.ts (this handler used to select `total_amount`, which isn't a
// real column, so it would have failed every time a quote was selected).
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

  const [existingBooking] = await db
    .select({ assignedSupplier: schema.bookings.assignedSupplier, createdBy: schema.bookings.createdBy })
    .from(schema.bookings)
    .where(eq(schema.bookings.id, params.id))
    .limit(1)

  if (!existingBooking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })

  // Selecting a quote also updates the booking (assigned supplier, status),
  // so it's gated the same way as editing a booking directly — only the
  // creator, or an admin/manager. Matches the old RLS policy ("Staff can
  // update own bookings; admins/managers can update any"), which silently
  // blocked everyone else at the database level before this route talked
  // directly to Postgres.
  if (existingBooking.createdBy !== user.id && !['admin', 'manager'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [quote] = await db
    .select({
      supplierId: schema.quotes.supplierId,
      amountUsd: schema.quotes.amountUsd,
      supplierCompanyName: schema.suppliers.companyName,
    })
    .from(schema.quotes)
    .leftJoin(schema.suppliers, eq(schema.quotes.supplierId, schema.suppliers.id))
    .where(eq(schema.quotes.id, params.quoteId))
    .limit(1)

  if (!quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })

  await db.update(schema.quotes).set({ isSelected: false }).where(eq(schema.quotes.bookingId, params.id))
  await db.update(schema.quotes).set({ isSelected: true }).where(eq(schema.quotes.id, params.quoteId))

  await db
    .update(schema.bookings)
    .set({ status: 'quoted', assignedSupplier: quote.supplierId })
    .where(eq(schema.bookings.id, params.id))

  await logAudit(adminClient(), {
    bookingId: params.id,
    actorId: user.id,
    actorName: profile.full_name || user.email || 'Unknown',
    action: 'quote_selected',
    field: 'assigned_supplier',
    oldValue: existingBooking?.assignedSupplier ?? null,
    newValue: quote.supplierId,
    note: `Selected quote from ${quote.supplierCompanyName ?? 'supplier'} for ${quote.amountUsd}`,
  })

  return NextResponse.json({ success: true })
}
