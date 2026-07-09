import { NextRequest, NextResponse } from 'next/server'
import { inArray } from 'drizzle-orm'
import { db, schema } from '@/lib/db'
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

// Public endpoint — no auth required. Talks directly to Postgres via Drizzle
// (see lib/db) instead of going through Supabase's PostgREST layer, which
// repeatedly lost track of columns/tables/functions that provably existed in
// the database (ticket SU-415685) — most critically, this exact route's
// is_draft column, which at one point was blocking every guest booking
// submission outright. The RPC-function workarounds layered on top of
// PostgREST to survive that bug (fleetflow_create_draft_booking etc.) are no
// longer needed now that this route bypasses PostgREST entirely — this
// route's own server-side validation below (required fields, rate limiting)
// takes the place of RLS for access control, same as before.
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

    const [created] = await db
      .insert(schema.bookings)
      .values({
        guestName: body.guest_name || null,
        guestNationality: body.guest_nationality || null,
        guestCount: body.guest_count ? Number(body.guest_count) : 1,
        guestPhone: body.guest_phone || null,
        guestEmail: body.guest_email || null,
        guestLineId: body.guest_line_id ?? null,
        pickupLocation: body.pickup_location || null,
        dropoffLocation: body.dropoff_location || null,
        pickupDatetime: body.pickup_datetime || null,
        dropoffDatetime: body.dropoff_datetime ?? null,
        vehicleType: body.vehicle_type || 'sedan',
        driverRequired: body.driver_required ?? true,
        specialRequests: body.special_requests ?? null,
        status: 'pending',
        isDraft,
        createdBy: null, // guest booking — no auth user
      })
      .returning({ id: schema.bookings.id, referenceNumber: schema.bookings.referenceNumber })

    if (!created) {
      return NextResponse.json({ error: 'Failed to create booking' }, { status: 400 })
    }

    // Drafts are just a save point — no staff notification yet, but we do send
    // a lightweight "here's how to get back to it" email since it's the only
    // recovery path if the guest closes the tab.
    if (isDraft) {
      sendDraftSavedEmail(body.guest_email, created.referenceNumber)
        .catch((err) => console.error('[email] draft-saved failed:', err))
      return NextResponse.json({ reference_number: created.referenceNumber, is_draft: true }, { status: 201 })
    }

    // Notify all admin/manager/staff users about the new guest booking
    const staff = await db
      .select({ id: schema.profiles.id })
      .from(schema.profiles)
      .where(inArray(schema.profiles.role, ['admin', 'manager', 'staff']))

    if (staff.length > 0) {
      await db.insert(schema.notifications).values(
        staff.map((user) => ({
          userId: user.id,
          type: 'new_booking' as const,
          title: '🚗 New Guest Booking',
          message: `${body.guest_name} submitted a booking request — ${body.pickup_location} → ${body.dropoff_location}. Ref: ${created.referenceNumber}`,
          bookingId: created.id,
        }))
      )
    }

    // Send confirmation email to guest (non-blocking — don't fail the booking if email fails)
    sendBookingConfirmationEmail({
      guestName: body.guest_name,
      guestEmail: body.guest_email,
      referenceNumber: created.referenceNumber,
      pickupLocation: body.pickup_location,
      dropoffLocation: body.dropoff_location,
      pickupDatetime: body.pickup_datetime,
      dropoffDatetime: body.dropoff_datetime ?? null,
      vehicleType: body.vehicle_type,
      guestCount: Number(body.guest_count),
      specialRequests: body.special_requests ?? null,
    }).catch((err) => console.error('[email] confirmation failed:', err))

    return NextResponse.json({ reference_number: created.referenceNumber }, { status: 201 })
  } catch (err) {
    console.error('[public/bookings] POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
