import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { notifyManagers } from '@/lib/notifications'
import { logAudit, adminClient } from '@/lib/audit'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') ?? '50')
    const offset = parseInt(searchParams.get('offset') ?? '0')

    let query = supabase
      .from('bookings')
      .select('*, profiles!bookings_created_by_fkey(full_name), suppliers(company_name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) query = query.eq('status', status)
    if (search) query = query.or(`guest_name.ilike.%${search}%,reference_number.ilike.%${search}%`)

    const { data, error, count } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ data, count })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { data, error } = await supabase
      .from('bookings')
      .insert({ ...body, created_by: user.id })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Notify managers
    await notifyManagers(
      'New Transport Request',
      `New booking ${data.reference_number} for ${data.guest_name} requires review.`,
      data.id
    )

    const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
    await logAudit(adminClient(), {
      bookingId: data.id,
      actorId: user.id,
      actorName: profile?.full_name || user.email || 'Unknown',
      action: 'booking_created',
      note: `Created booking ${data.reference_number} for ${data.guest_name}`,
    })

    return NextResponse.json({ data }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
