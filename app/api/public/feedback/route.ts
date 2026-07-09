import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db, schema } from '@/lib/db'

// Public endpoint — no auth required. Guests submit a 1–5 star rating (plus an
// optional comment) for a completed trip, identified only by reference number
// (same lookup pattern as /book/status/[reference]). Not required — this is a
// nice-to-have link included in the trip completion receipt email.
//
// Talks directly to Postgres via Drizzle instead of PostgREST — this route
// wasn't touched during the main is_draft-bug-driven migration (Phase 2)
// since it didn't have that specific bug, migrated now as part of general
// cleanup (Phase 4) for consistency.
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

    const [booking] = await db
      .select({ id: schema.bookings.id, status: schema.bookings.status })
      .from(schema.bookings)
      .where(eq(schema.bookings.referenceNumber, reference_number.toUpperCase()))
      .limit(1)

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found.' }, { status: 404 })
    }

    if (booking.status !== 'completed') {
      return NextResponse.json(
        { error: 'Feedback can only be submitted after the trip is completed.' },
        { status: 403 }
      )
    }

    const feedbackValues = {
      bookingId: booking.id,
      referenceNumber: reference_number.toUpperCase(),
      rating: ratingNum,
      comment: typeof comment === 'string' && comment.trim() ? comment.trim() : null,
    }

    await db
      .insert(schema.feedback)
      .values(feedbackValues)
      .onConflictDoUpdate({ target: schema.feedback.bookingId, set: feedbackValues })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[public/feedback] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
