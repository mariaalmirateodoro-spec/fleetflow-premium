import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createNotification } from '@/lib/notifications'

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const bookingId = request.nextUrl.searchParams.get('booking_id')
  let query = supabase
    .from('approvals')
    .select('*, profiles!approvals_approved_by_fkey(full_name, email)')
    .order('created_at', { ascending: false })

  if (bookingId) query = query.eq('booking_id', bookingId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Only admins/managers can approve
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'manager'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { booking_id, action, comments, quote_id } = await request.json()

  // Create approval record
  const { data: approval, error: approvalError } = await supabase
    .from('approvals')
    .insert({ booking_id, action, comments, approved_by: user.id })
    .select()
    .single()

  if (approvalError) return NextResponse.json({ error: approvalError.message }, { status: 400 })

  // Update booking status based on action
  const statusMap: Record<string, string> = {
    approved: 'approved',
    rejected: 'rejected',
    revision_requested: 'pending',
  }
  const newStatus = statusMap[action] ?? 'pending'

  const updatePayload: Record<string, unknown> = { status: newStatus }
  if (action === 'approved' && quote_id) {
    updatePayload.selected_quote_id = quote_id
  }

  await supabase.from('bookings').update(updatePayload).eq('id', booking_id)

  // Notify the booking creator
  const { data: booking } = await supabase
    .from('bookings')
    .select('created_by, reference_number')
    .eq('id', booking_id)
    .single()

  if (booking) {
    const actionLabels: Record<string, string> = {
      approved: 'approved',
      rejected: 'rejected',
      revision_requested: 'sent back for revision',
    }
    await createNotification(supabase, {
      user_id: booking.created_by,
      title: `Booking ${actionLabels[action] ?? action}`,
      message: `Booking ${booking.reference_number} has been ${actionLabels[action] ?? action}.${comments ? ` Comment: ${comments}` : ''}`,
      type: action === 'approved' ? 'success' : action === 'rejected' ? 'error' : 'info',
      booking_id,
    })
  }

  return NextResponse.json({ data: approval }, { status: 201 })
}
