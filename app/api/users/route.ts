import { NextRequest, NextResponse } from 'next/server'
import { asc, eq } from 'drizzle-orm'
import { createClient, getUser } from '@/lib/supabase/server'
import { logAudit, adminClient } from '@/lib/audit'
import { db, schema } from '@/lib/db'

// Talks directly to Postgres via Drizzle instead of PostgREST.
export async function GET() {
  const supabase = createClient()
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Only admins can list users
  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (callerProfile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const rows = await db
    .select()
    .from(schema.profiles)
    .orderBy(asc(schema.profiles.fullName))

  const data = rows.map((p) => ({
    id: p.id,
    email: p.email,
    full_name: p.fullName,
    role: p.role,
    avatar_url: p.avatarUrl,
    department: p.department,
    phone: p.phone,
    is_active: p.isActive,
    last_login_at: p.lastLoginAt,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  }))

  return NextResponse.json({ data })
}

export async function PATCH(request: NextRequest) {
  const supabase = createClient()
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Only admins can modify users
  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (callerProfile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { userId, role, is_active } = await request.json()

  // Prevent self-demotion
  if (userId === user.id && role && role !== 'admin') {
    return NextResponse.json({ error: 'Cannot change your own role' }, { status: 400 })
  }

  const [target] = await db
    .select({ role: schema.profiles.role, isActive: schema.profiles.isActive, fullName: schema.profiles.fullName })
    .from(schema.profiles)
    .where(eq(schema.profiles.id, userId))
    .limit(1)

  const updates: { role?: 'admin' | 'staff' | 'manager' | 'finance'; isActive?: boolean } = {}
  if (role !== undefined) updates.role = role
  if (is_active !== undefined) updates.isActive = is_active

  const [updated] = await db
    .update(schema.profiles)
    .set(updates)
    .where(eq(schema.profiles.id, userId))
    .returning()

  if (!updated) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const [callerFull] = await db
    .select({ fullName: schema.profiles.fullName })
    .from(schema.profiles)
    .where(eq(schema.profiles.id, user.id))
    .limit(1)
  const actorName = callerFull?.fullName || user.email || 'Unknown'
  if (role !== undefined && target && role !== target.role) {
    await logAudit(adminClient(), {
      actorId: user.id, actorName, action: 'user_role_changed',
      field: 'role', oldValue: target.role, newValue: role,
      note: `Changed role for ${target.fullName}`,
    })
  }
  if (is_active !== undefined && target && is_active !== target.isActive) {
    await logAudit(adminClient(), {
      actorId: user.id, actorName, action: 'user_status_changed',
      field: 'is_active', oldValue: target.isActive, newValue: is_active,
      note: `${is_active ? 'Activated' : 'Deactivated'} ${target.fullName}`,
    })
  }

  const data = {
    id: updated.id,
    email: updated.email,
    full_name: updated.fullName,
    role: updated.role,
    avatar_url: updated.avatarUrl,
    department: updated.department,
    phone: updated.phone,
    is_active: updated.isActive,
    last_login_at: updated.lastLoginAt,
    created_at: updated.createdAt,
    updated_at: updated.updatedAt,
  }

  return NextResponse.json({ data })
}
