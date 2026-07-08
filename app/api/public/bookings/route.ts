import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { sendBookingConfirmationEmail, sendDraftSavedEmail } from '@/lib/email'

// ─── Simple in-memory rate limiter ───────────────────────────
// Limits each IP to 5 booking submissions per 10 minutes.
// Works within a single serverless instance lifetime on Vercel.
const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000 // 10 minutes

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  )
}

function checkRateLimit(ip: string): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return { allowed: true, retryAfterSeconds: 0 }
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false, retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) }
  }

  entry.count++
  return { allowed: true, retryAfterSeconds: 0 }
}

// Public endpoint — no auth required. Uses anon key + RLS policy that allows
// inserts where created_by IS NULL (guest bookings).
export async function POST(request: NextRequest) {
  try {
    // Rate limit check
    const ip = getClientIp(request)
    const { allowed, retryAfterSeconds } = checkRateLimit(ip)
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many booking requests. Please wait a few minutes before trying again.' },
        {
          status: 429,
          headers: { 'Retry-After': String(retryAfterSeconds) },
        }
      )
    }

    // Service-role client for the insert itself, plus sending notifications
    // (bypasses RLS). The insert used to go through the anon-key client,
    // relying on the "Staff or guests can create bookings" INSERT policy
    // (auth.uid() IS NOT NULL OR created_by IS NULL) — but that policy alone
    // isn't enough: supabase-js's .insert().select() does an INSERT ...
    // RETURNING under the hood, and Postgres validates the RETURNING clause
    // against the table's SELECT policy too. Guests have no SELECT policy
    // covering their own just-inserted row since the wide-open
    // "Anyone can look up a booking by reference_number" SELECT policy was
    // correctly removed as part of the RLS lockdown fix earlier — Postgres
    // reports that mismatch as "new row violates row-level security policy"
    // even though the INSERT condition itself was satisfied. This whole
    // route already does its own validation (required fields, rate
    // limiting) server-side before writing, so using the service-role key
    // here — same as the rest of this file already does for notifications —
    // is safe and sidesteps the issue entirely instead of reopening the
    // security hole with a broader SELECT policy.
    const adminClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { cookies: { getAll: () => [], setAll: () => {} } }
    )

    const body = await request.json()
    const isDraft = body.is_draft === true

    // Full submissions must have the essentials; drafts can be missing anything —
    // that's the whole point of "save & finish later".
    if (!isDraft) {
      const required = ['guest_name', 'guest_count', 'pickup_location', 'dropoff_location', 'pickup_datetime', 'vehicle_type', 'guest_phone', 'guest_email']
      for (const field of required) {
        if (!body[field]) {
          return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 })
        }
      }

    } else {
      // Drafts can skip almost everything, but we still need an email —
      // it's the only way a guest can find their way back to an unfinished
      // draft if they close the tab without noting the reference number.
      if (!body.guest_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.guest_email)) {
        return NextResponse.json(
          { error: 'Please enter a valid email address before saving a draft, so we can send you a link back to it.' },
          { status: 400 }
        )
      }
    }

    // `is_draft` is deliberately omitted from the direct insert below when
    // it's false (the normal, real-submission case) — Supabase's PostgREST
    // layer has been intermittently losing track of columns/tables/functions
    // that provably exist in the database (reported to Supabase support,
    // ticket SU-415685), and `is_draft` was hit by that same bug, which was
    // blocking EVERY real guest booking outright. Leaving it out of the
    // payload lets the column's own DB-level default (false) apply instead
    // of going through PostgREST's column-aware insert path for it.
    //
    // Drafts can't use that trick (they need is_draft = true), so they go
    // through the fleetflow_create_draft_booking() RPC instead — the SQL
    // inside that function runs directly in the database and never touches
    // PostgREST's column-aware request parsing, sidestepping the cache bug
    // for this path too.
    let data: { id: string; reference_number: string } | null = null
    let error: { message: string } | null = null

    if (isDraft) {
      const { data: rpcData, error: rpcError } = await adminClient
        .rpc('fleetflow_create_draft_booking', {
          p_guest_name: body.guest_name || null,
          p_guest_nationality: body.guest_nationality || null,
          p_guest_count: body.guest_count ? Number(body.guest_count) : 1,
          p_guest_phone: body.guest_phone || null,
          p_guest_email: body.guest_email || null,
          p_guest_line_id: body.guest_line_id ?? null,
          p_pickup_location: body.pickup_location || null,
          p_dropoff_location: body.dropoff_location || null,
          p_pickup_datetime: body.pickup_datetime || null,
          p_dropoff_datetime: body.dropoff_datetime ?? null,
          p_vehicle_type: body.vehicle_type || 'sedan',
          p_driver_required: body.driver_required ?? true,
          p_special_requests: body.special_requests ?? null,
        })
        .single()
      data = rpcData as { id: string; reference_number: string } | null
      error = rpcError
    } else {
      const { data: insertData, error: insertError } = await adminClient
        .from('bookings')
        .insert({
          guest_name: body.guest_name || null,
          guest_nationality: body.guest_nationality || null,
          guest_count: body.guest_count ? Number(body.guest_count) : 1,
          guest_phone: body.guest_phone || null,
          guest_email: body.guest_email || null,
          guest_line_id: body.guest_line_id ?? null,
          pickup_location: body.pickup_location || null,
          dropoff_location: body.dropoff_location || null,
          pickup_datetime: body.pickup_datetime || null,
          dropoff_datetime: body.dropoff_datetime ?? null,
          vehicle_type: body.vehicle_type || 'sedan',
          driver_required: body.driver_required ?? true,
          special_requests: body.special_requests ?? null,
          status: 'pending',
          created_by: null, // guest booking — no auth user
        })
        .select('id, reference_number')
        .single()
      data = insertData
      error = insertError
    }

    if (error || !data) return NextResponse.json({ error: error?.message ?? 'Failed to create booking' }, { status: 400 })

    // Drafts are just a save point — no staff notification yet, but we do send
    // a lightweight "here's how to get back to it" email since it's the only
    // recovery path if the guest closes the tab.
    if (isDraft) {
      sendDraftSavedEmail(body.guest_email, data.reference_number)
        .catch((err) => console.error('[email] draft-saved failed:', err))
      return NextResponse.json({ reference_number: data.reference_number, is_draft: true }, { status: 201 })
    }

    // Notify all admin/manager/staff users about the new guest booking
    const { data: staff } = await adminClient
      .from('profiles')
      .select('id')
      .in('role', ['admin', 'manager', 'staff'])

    if (staff && staff.length > 0) {
      await adminClient.from('notifications').insert(
        staff.map((user) => ({
          user_id: user.id,
          type: 'new_booking',
          title: '🚗 New Guest Booking',
          message: `${body.guest_name} submitted a booking request — ${body.pickup_location} → ${body.dropoff_location}. Ref: ${data.reference_number}`,
          booking_id: data.id,
        }))
      )
    }

    // Send confirmation email to guest (non-blocking — don't fail the booking if email fails)
    sendBookingConfirmationEmail({
      guestName: body.guest_name,
      guestEmail: body.guest_email,
      referenceNumber: data.reference_number,
      pickupLocation: body.pickup_location,
      dropoffLocation: body.dropoff_location,
      pickupDatetime: body.pickup_datetime,
      dropoffDatetime: body.dropoff_datetime ?? null,
      vehicleType: body.vehicle_type,
      guestCount: Number(body.guest_count),
      specialRequests: body.special_requests ?? null,
    }).catch((err) => console.error('[email] confirmation failed:', err))

    return NextResponse.json({ reference_number: data.reference_number }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
