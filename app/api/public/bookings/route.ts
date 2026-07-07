import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { sendBookingConfirmationEmail } from '@/lib/email'

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

    const anonClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => [], setAll: () => {} } }
    )

    // Service-role client for sending notifications (bypasses RLS)
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
      const required = ['guest_name', 'guest_nationality', 'guest_count', 'pickup_location', 'dropoff_location', 'pickup_datetime', 'vehicle_type', 'guest_phone', 'guest_email']
      for (const field of required) {
        if (!body[field]) {
          return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 })
        }
      }
    }

    const { data, error } = await anonClient
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
        is_draft: isDraft,
        created_by: null, // guest booking — no auth user
      })
      .select('id, reference_number')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Drafts are just a save point — no staff notification, no confirmation email yet.
    if (isDraft) {
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
          message: `${body.guest_name} (${body.guest_nationality}) submitted a booking request — ${body.pickup_location} → ${body.dropoff_location}. Ref: ${data.reference_number}`,
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
