import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { createClient } from '@/lib/supabase/server'
import { logAudit, adminClient } from '@/lib/audit'
import { db, schema } from '@/lib/db'

// Talks directly to Postgres via Drizzle (see lib/db) instead of PostgREST.
// auth.getUser() is Supabase Auth, a separate service, left as-is.
// logAudit() still takes a supabase-js client internally — unrelated to
// this route's own queries, left as-is for now (Phase 2d cleanup item).

type DriverRow = typeof schema.drivers.$inferSelect

function toSnakeCase(d: DriverRow, supplierCompanyName?: string | null) {
  return {
    id: d.id,
    full_name: d.fullName,
    phone: d.phone,
    license_number: d.licenseNumber,
    license_expiry: d.licenseExpiry,
    vehicle_types: d.vehicleTypes,
    is_available: d.isAvailable,
    assigned_supplier_id: d.assignedSupplierId,
    notes: d.notes,
    created_by: d.createdBy,
    created_at: d.createdAt,
    updated_at: d.updatedAt,
    ...(supplierCompanyName !== undefined
      ? { suppliers: supplierCompanyName != null ? { company_name: supplierCompanyName } : undefined }
      : {}),
  }
}

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await db
    .select({ d: schema.drivers, supplierCompanyName: schema.suppliers.companyName })
    .from(schema.drivers)
    .leftJoin(schema.suppliers, eq(schema.drivers.assignedSupplierId, schema.suppliers.id))
    .orderBy(schema.drivers.fullName)

  const data = rows.map((r) => toSnakeCase(r.d, r.supplierCompanyName))
  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()

  const [created] = await db
    .insert(schema.drivers)
    .values({
      fullName: body.full_name,
      phone: body.phone,
      licenseNumber: body.license_number,
      licenseExpiry: body.license_expiry ?? null,
      vehicleTypes: body.vehicle_types ?? [],
      isAvailable: body.is_available ?? true,
      assignedSupplierId: body.assigned_supplier_id ?? null,
      notes: body.notes ?? null,
      createdBy: user.id,
    })
    .returning()

  if (!created) return NextResponse.json({ error: 'Failed to create driver' }, { status: 400 })

  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
  await logAudit(adminClient(), {
    actorId: user.id,
    actorName: profile?.full_name || user.email || 'Unknown',
    action: 'driver_created',
    note: `Added driver ${created.fullName}`,
  })

  return NextResponse.json({ data: toSnakeCase(created) }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, ...body } = await request.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const [updated] = await db
    .update(schema.drivers)
    .set({
      fullName: 'full_name' in body ? body.full_name : undefined,
      phone: 'phone' in body ? body.phone : undefined,
      licenseNumber: 'license_number' in body ? body.license_number : undefined,
      licenseExpiry: 'license_expiry' in body ? body.license_expiry ?? null : undefined,
      vehicleTypes: 'vehicle_types' in body ? body.vehicle_types : undefined,
      isAvailable: 'is_available' in body ? body.is_available : undefined,
      assignedSupplierId: 'assigned_supplier_id' in body ? body.assigned_supplier_id ?? null : undefined,
      notes: 'notes' in body ? body.notes ?? null : undefined,
    })
    .where(eq(schema.drivers.id, id))
    .returning()

  if (!updated) return NextResponse.json({ error: 'Driver not found' }, { status: 404 })

  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
  await logAudit(adminClient(), {
    actorId: user.id,
    actorName: profile?.full_name || user.email || 'Unknown',
    action: 'driver_updated',
    note: `Updated driver ${updated.fullName} (${Object.keys(body).join(', ')})`,
  })

  return NextResponse.json({ data: toSnakeCase(updated) })
}

export async function DELETE(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Admin only — matches the equivalent check on suppliers DELETE, and the
  // delete button is only rendered for admins in DriversClient.tsx. Missing
  // here before this fix: under the old PostgREST setup this was still
  // blocked at the database level by RLS ("Admins can delete drivers"); now
  // that Drizzle talks to Postgres as a role that bypasses RLS entirely,
  // this app-level check is the only thing enforcing it.
  const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const [existing] = await db.select({ fullName: schema.drivers.fullName }).from(schema.drivers).where(eq(schema.drivers.id, id)).limit(1)

  try {
    await db.delete(schema.drivers).where(eq(schema.drivers.id, id))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete driver'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  await logAudit(adminClient(), {
    actorId: user.id,
    actorName: profile?.full_name || user.email || 'Unknown',
    action: 'driver_deleted',
    note: existing ? `Deleted driver ${existing.fullName}` : null,
  })

  return NextResponse.json({ success: true })
}
