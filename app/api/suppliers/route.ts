import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { createClient } from '@/lib/supabase/server'
import { logAudit, adminClient } from '@/lib/audit'
import { db, schema } from '@/lib/db'

// Talks directly to Postgres via Drizzle (see lib/db) instead of PostgREST.
// auth.getUser() is Supabase Auth, a separate service, left as-is.
// logAudit() still takes a supabase-js client internally — unrelated to
// this route's own queries, left as-is for now (Phase 2d cleanup item).

type SupplierRow = typeof schema.suppliers.$inferSelect

function toSnakeCase(s: SupplierRow) {
  return {
    id: s.id,
    company_name: s.companyName,
    contact_person: s.contactPerson,
    phone: s.phone,
    email: s.email,
    address: s.address,
    vehicle_types: s.vehicleTypes,
    base_rate_usd: s.baseRateUsd != null ? Number(s.baseRateUsd) : null,
    rating: s.rating != null ? Number(s.rating) : 0,
    total_bookings: s.totalBookings,
    is_available: s.isAvailable,
    is_preferred: s.isPreferred,
    notes: s.notes,
    created_by: s.createdBy,
    created_at: s.createdAt,
    updated_at: s.updatedAt,
  }
}

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await db.select().from(schema.suppliers).orderBy(schema.suppliers.companyName)
  return NextResponse.json({ data: rows.map(toSnakeCase) })
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()

  const [created] = await db
    .insert(schema.suppliers)
    .values({
      companyName: body.company_name,
      contactPerson: body.contact_person,
      phone: body.phone,
      email: body.email,
      address: body.address ?? null,
      vehicleTypes: body.vehicle_types ?? [],
      baseRateUsd: body.base_rate_usd != null ? String(body.base_rate_usd) : null,
      notes: body.notes ?? null,
      isPreferred: body.is_preferred ?? false,
      isAvailable: body.is_available ?? true,
      createdBy: user.id,
    })
    .returning()

  if (!created) return NextResponse.json({ error: 'Failed to create supplier' }, { status: 400 })

  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
  await logAudit(adminClient(), {
    actorId: user.id,
    actorName: profile?.full_name || user.email || 'Unknown',
    action: 'supplier_created',
    note: `Added supplier ${created.companyName}`,
  })

  return NextResponse.json({ data: toSnakeCase(created) }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, ...body } = await request.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const [existing] = await db
    .select({ isAvailable: schema.suppliers.isAvailable, companyName: schema.suppliers.companyName })
    .from(schema.suppliers)
    .where(eq(schema.suppliers.id, id))
    .limit(1)

  const [updated] = await db
    .update(schema.suppliers)
    .set({
      companyName: 'company_name' in body ? body.company_name : undefined,
      contactPerson: 'contact_person' in body ? body.contact_person : undefined,
      phone: 'phone' in body ? body.phone : undefined,
      email: 'email' in body ? body.email : undefined,
      address: 'address' in body ? body.address ?? null : undefined,
      vehicleTypes: 'vehicle_types' in body ? body.vehicle_types : undefined,
      baseRateUsd: 'base_rate_usd' in body ? (body.base_rate_usd != null ? String(body.base_rate_usd) : null) : undefined,
      notes: 'notes' in body ? body.notes ?? null : undefined,
      isPreferred: 'is_preferred' in body ? body.is_preferred : undefined,
      isAvailable: 'is_available' in body ? body.is_available : undefined,
    })
    .where(eq(schema.suppliers.id, id))
    .returning()

  if (!updated) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })

  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
  const actorName = profile?.full_name || user.email || 'Unknown'
  const admin = adminClient()

  if (existing && body.is_available !== undefined && body.is_available !== existing.isAvailable) {
    await logAudit(admin, {
      actorId: user.id, actorName, action: 'supplier_status_changed',
      field: 'is_available', oldValue: existing.isAvailable, newValue: body.is_available,
      note: `${updated.companyName} ${body.is_available ? 'activated' : 'deactivated'}`,
    })
  } else {
    await logAudit(admin, {
      actorId: user.id, actorName, action: 'supplier_updated',
      note: `Updated supplier ${updated.companyName} (${Object.keys(body).join(', ')})`,
    })
  }

  return NextResponse.json({ data: toSnakeCase(updated) })
}

export async function DELETE(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const [existing] = await db.select({ companyName: schema.suppliers.companyName }).from(schema.suppliers).where(eq(schema.suppliers.id, id)).limit(1)

  try {
    await db.delete(schema.suppliers).where(eq(schema.suppliers.id, id))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete supplier'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  await logAudit(adminClient(), {
    actorId: user.id,
    actorName: profile?.full_name || user.email || 'Unknown',
    action: 'supplier_deleted',
    note: existing ? `Deleted supplier ${existing.companyName}` : null,
  })

  return NextResponse.json({ success: true })
}
