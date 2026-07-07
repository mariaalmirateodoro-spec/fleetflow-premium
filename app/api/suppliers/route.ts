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

  const { data, error } = await supabase.from('suppliers').select('*').order('company_name')
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { data, error } = await supabase
    .from('suppliers')
    .insert({ ...body, created_by: user.id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const admin = createAdminClient()
  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
  await logAudit(admin, {
    actorId: user.id,
    actorName: profile?.full_name || user.email || 'Unknown',
    action: 'supplier_created',
    note: `Added supplier ${data.company_name}`,
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
  const { data: existing } = await admin.from('suppliers').select('is_available, company_name').eq('id', id).single()

  const { data, error } = await admin
    .from('suppliers')
    .update(body)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
  const actorName = profile?.full_name || user.email || 'Unknown'

  if (existing && body.is_available !== undefined && body.is_available !== existing.is_available) {
    await logAudit(admin, {
      actorId: user.id, actorName, action: 'supplier_status_changed',
      field: 'is_available', oldValue: existing.is_available, newValue: body.is_available,
      note: `${data.company_name} ${body.is_available ? 'activated' : 'deactivated'}`,
    })
  } else {
    await logAudit(admin, {
      actorId: user.id, actorName, action: 'supplier_updated',
      note: `Updated supplier ${data.company_name} (${Object.keys(body).join(', ')})`,
    })
  }

  return NextResponse.json({ data })
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

  const admin = createAdminClient()
  const { data: existing } = await admin.from('suppliers').select('company_name').eq('id', id).single()
  const { error } = await admin.from('suppliers').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await logAudit(admin, {
    actorId: user.id,
    actorName: profile.full_name || user.email || 'Unknown',
    action: 'supplier_deleted',
    note: existing ? `Deleted supplier ${existing.company_name}` : null,
  })

  return NextResponse.json({ success: true })
}
