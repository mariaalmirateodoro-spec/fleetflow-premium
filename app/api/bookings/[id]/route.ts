import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { sendDriverAssignedEmail } from '@/lib/email'

// Bypasses RLS — only used server-side for admin cascade deletes
function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('bookings')
    .select('*, profiles!bookings_created_by_fkey(full_name), suppliers(*), quotes(*, suppliers(*))')
    .eq('id', params.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json({ data })
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const admin = createAdminClient()

  // If a driver is being assigned, check whether it's a new/changed assignment
  let shouldEmailDriver = false
  let currentBooking: Record<string, unknown> | null = null
  let assignedDriver: { full_name: string; phone: string } | null = null

  if (body.driver_id != null) {
    const { data: existing } = await admin
      .from('bookings')
      .select('driver_id, guest_email, guest_name, reference_number, pickup_location, dropoff_location, pickup_datetime, vehicle_type, vehicle_plate, vehicle_model')
      .eq('id', params.id)
      .single()

    if (existing && existing.driver_id !== body.driver_id && existing.guest_email) {
      const { data: driver } = await admin
        .from('drivers')
        .select('full_name, phone')
        .eq('id', body.driver_id)
        .single()

      if (driver) {
        shouldEmailDriver = true
        currentBooking = existing as Record<string, unknown>
        assignedDriver = driver as { full_name: string; phone: string }
      }
    }
  }

  // Use admin client to bypass RLS for booking updates
  const { data, error } = await admin
    .from('bookings')
    .update(body)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Send driver assignment email to guest
  if (shouldEmailDriver && currentBooking && assignedDriver) {
    try {
      await sendDriverAssignedEmail({
        guestName: currentBooking.guest_name as string,
        guestEmail: currentBooking.guest_email as string,
        referenceNumber: currentBooking.reference_number as string,
        pickupLocation: currentBooking.pickup_location as string,
        dropoffLocation: currentBooking.dropoff_location as string,
        pickupDatetime: currentBooking.pickup_datetime as string,
        vehicleType: currentBooking.vehicle_type as string,
        driverName: assignedDriver.full_name,
        driverPhone: assignedDriver.phone,
        vehiclePlate: (body.vehicle_plate ?? currentBooking.vehicle_plate) as string | null,
        vehicleModel: (body.vehicle_model ?? currentBooking.vehicle_model) as string | null,
      })
    } catch (err) {
      console.error('[driver-assign] email error:', err)
    }
  }

  return NextResponse.json({ data })
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Admin only — verify via user session
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Use service-role client to bypass RLS for cascade deletes
  const admin = createAdminClient()
  await admin.from('notifications').delete().eq('booking_id', params.id)
  await admin.from('approvals').delete().eq('booking_id', params.id)
  await admin.from('quotes').delete().eq('booking_id', params.id)

  const { error } = await admin.from('bookings').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
