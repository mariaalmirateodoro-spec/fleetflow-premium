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

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('drivers')
    .select('*, suppliers(company_name)')
    .order('full_name')

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('drivers')
    .insert({ ...body, created_by: user.id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
  await logAudit(admin, {
    actorId: user.id,
    actorName: profile?.full_name || user.email || 'Unknown',
    action: 'driver_created',
    note: `Added driver ${data.full_name}`,
  })

  return NextResponse.json({ data }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, ...body } = await request.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('drivers')
    .update(body)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
  await logAudit(admin, {
    actorId: user.id,
    actorName: profile?.full_name || user.email || 'Unknown',
    action: 'driver_updated',
    note: `Updated driver ${data.full_name} (${Object.keys(body).join(', ')})`,
  })

  return NextResponse.json({ data })
}

export async function DELETE(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const admin = createAdminClient()
  const { data: existing } = await admin.from('drivers').select('full_name').eq('id', id).single()
  const { error } = await admin.from('drivers').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
  await logAudit(admin, {
    actorId: user.id,
    actorName: profile?.full_name || user.email || 'Unknown',
    action: 'driver_deleted',
    note: existing ? `Deleted driver ${existing.full_name}` : null,
  })

  return NextResponse.json({ success: true })
}
