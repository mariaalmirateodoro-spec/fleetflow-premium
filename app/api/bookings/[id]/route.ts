import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { sendDriverAssignedEmail } from '@/lib/email'
import { logAudit } from '@/lib/audit'

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

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  const body = await request.json()
  const admin = createAdminClient()

  // Final cost changes have money-movement implications — restrict to
  // admin/manager (a plain staff account could otherwise quietly adjust the
  // amount after approval with nobody else aware).
  if (body.final_cost_usd !== undefined && !['admin', 'manager'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Only admins and managers can change the final cost.' }, { status: 403 })
  }

  // `is_draft` is pulled out of the update payload before it ever reaches
  // supabase-js — the staff "Edit Booking" modal always sends it explicitly
  // (true or false), and writing it directly (or selecting it by name) hits
  // the same PostgREST schema-cache bug that was blocking guest draft
  // bookings (ticket SU-415685). It's read/written separately below via a
  // small RPC that runs plain SQL inside the database instead of going
  // through PostgREST's column-aware request parsing.
  const { is_draft: newIsDraft, ...bodyWithoutDraft } = body

  // Fetch current values for anything we might need to audit or compare against.
  // Includes every field the staff "Edit Booking" form can send, so the
  // catch-all diff below only reports fields that actually changed.
  const { data: existing } = await admin
    .from('bookings')
    .select('driver_id, final_cost_usd, guest_email, guest_name, reference_number, pickup_location, dropoff_location, pickup_datetime, dropoff_datetime, vehicle_type, vehicle_plate, vehicle_model, guest_nationality, guest_count, guest_phone, guest_line_id, driver_required, budget_usd, notes, special_requests')
    .eq('id', params.id)
    .single()

  // If a driver is being assigned, check whether it's a new/changed assignment
  let shouldEmailDriver = false
  let assignedDriver: { full_name: string; phone: string } | null = null

  if (body.driver_id != null && existing && existing.driver_id !== body.driver_id && existing.guest_email) {
    const { data: driver } = await admin
      .from('drivers')
      .select('full_name, phone')
      .eq('id', body.driver_id)
      .single()

    if (driver) {
      shouldEmailDriver = true
      assignedDriver = driver as { full_name: string; phone: string }
    }
  }

  // Use admin client to bypass RLS for booking updates
  const { data, error } = await admin
    .from('bookings')
    .update(bodyWithoutDraft)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  if (newIsDraft !== undefined) {
    const { error: draftError } = await admin.rpc('fleetflow_set_is_draft', {
      p_id: params.id,
      p_is_draft: newIsDraft === true,
    })
    if (draftError) console.error('[bookings] failed to set is_draft:', draftError)
    else data.is_draft = newIsDraft === true
  }

  // Audit trail — only for the fields that matter for accountability.
  const actorName = profile?.full_name || user.email || 'Unknown'
  if (existing) {
    if (body.final_cost_usd !== undefined && body.final_cost_usd !== existing.final_cost_usd) {
      await logAudit(admin, {
        bookingId: params.id, actorId: user.id, actorName,
        action: 'final_cost_changed', field: 'final_cost_usd',
        oldValue: existing.final_cost_usd, newValue: body.final_cost_usd,
      })
    }
    if (body.driver_id !== undefined && body.driver_id !== existing.driver_id) {
      await logAudit(admin, {
        bookingId: params.id, actorId: user.id, actorName,
        action: 'driver_changed', field: 'driver_id',
        oldValue: existing.driver_id, newValue: body.driver_id,
      })
    }
  }

  // Generic catch-all: any other fields that actually changed value (guest
  // info, pickup/dropoff details, vehicle type, notes, etc. — e.g. edits made
  // through the staff "Edit Booking" form) get one summary entry. Diffed
  // against the fetched "existing" row above, not just "was this key present
  // in the request body" — the edit form resends the whole payload every
  // time, so a naive presence-check would falsely claim every field changed.
  if (existing) {
    const changedKeys = Object.keys(body).filter((k) => {
      if (['final_cost_usd', 'driver_id'].includes(k)) return false
      if (!(k in existing)) return false
      return body[k] !== (existing as Record<string, unknown>)[k]
    })
    if (changedKeys.length > 0) {
      await logAudit(admin, {
        bookingId: params.id, actorId: user.id, actorName,
        action: body.is_draft ? 'booking_draft_saved' : 'booking_updated',
        note: `Updated fields: ${changedKeys.join(', ')}`,
      })
    }
  }

  // Send driver assignment email to guest
  if (shouldEmailDriver && existing && assignedDriver) {
    try {
      await sendDriverAssignedEmail({
        guestName: existing.guest_name as string,
        guestEmail: existing.guest_email as string,
        referenceNumber: existing.reference_number as string,
        pickupLocation: existing.pickup_location as string,
        dropoffLocation: existing.dropoff_location as string,
        pickupDatetime: existing.pickup_datetime as string,
        vehicleType: existing.vehicle_type as string,
        driverName: assignedDriver.full_name,
        driverPhone: assignedDriver.phone,
        vehiclePlate: (body.vehicle_plate ?? existing.vehicle_plate) as string | null,
        vehicleModel: (body.vehicle_model ?? existing.vehicle_model) as string | null,
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
