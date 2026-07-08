import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  )
}

// Public endpoint — no auth required. Guests submit a 1–5 star rating (plus an
// optional comment) for a completed trip, identified only by reference number
// (same lookup pattern as /book/status/[reference]). Not required — this is a
// nice-to-have link included in the trip completion receipt email.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { reference_number, rating, comment } = body

    if (!reference_number || typeof reference_number !== 'string') {
      return NextResponse.json({ error: 'Missing reference number.' }, { status: 400 })
    }

    const ratingNum = Number(rating)
    if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return NextResponse.json({ error: 'Rating must be a whole number between 1 and 5.' }, { status: 400 })
    }

    const admin = createAdminClient()

    const { data: booking, error: bookingErr } = await admin
      .from('bookings')
      .select('id, status')
      .eq('reference_number', reference_number.toUpperCase())
      .maybeSingle()

    if (bookingErr || !booking) {
      return NextResponse.json({ error: 'Booking not found.' }, { status: 404 })
    }

    if (booking.status !== 'completed') {
      return NextResponse.json(
        { error: 'Feedback can only be submitted after the trip is completed.' },
        { status: 403 }
      )
    }

    const { error: upsertErr } = await admin
      .from('feedback')
      .upsert(
        {
          booking_id: booking.id,
          reference_number: reference_number.toUpperCase(),
          rating: ratingNum,
          comment: typeof comment === 'string' && comment.trim() ? comment.trim() : null,
        },
        { onConflict: 'booking_id' }
      )

    if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 400 })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
