import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db, schema } from '@/lib/db'

// One-click star rating links used in the trip-completion receipt email.
// Email clients don't run JavaScript, so a real interactive star widget
// inside the email body isn't possible — this is the standard workaround:
// each star in the email is a plain link to this GET endpoint with the
// score baked into the URL. Clicking a star records that rating immediately
// (no extra page/step) and redirects the guest to their status page with a
// thank-you message.
//
// Only sets `rating`, never `comment` — if the guest separately left a
// comment via the full feedback form on the status page, clicking a star
// link afterwards must not wipe it out.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const origin = new URL(request.url).origin
  const referenceNumber = searchParams.get('ref')?.trim().toUpperCase() ?? null
  const rating = Number(searchParams.get('rating'))

  const redirectTo = (path: string) => NextResponse.redirect(`${origin}${path}`)

  if (!referenceNumber || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return redirectTo(`/book/status/${referenceNumber ?? ''}?rate_error=invalid`)
  }

  try {
    const [booking] = await db
      .select({ id: schema.bookings.id, status: schema.bookings.status })
      .from(schema.bookings)
      .where(eq(schema.bookings.referenceNumber, referenceNumber))
      .limit(1)

    if (!booking) {
      return redirectTo(`/book/status/${referenceNumber}?rate_error=invalid`)
    }
    if (booking.status !== 'completed') {
      return redirectTo(`/book/status/${referenceNumber}?rate_error=not_completed`)
    }

    await db
      .insert(schema.feedback)
      .values({ bookingId: booking.id, referenceNumber, rating })
      .onConflictDoUpdate({ target: schema.feedback.bookingId, set: { rating } })

    return redirectTo(`/book/status/${referenceNumber}?rated=${rating}`)
  } catch (err) {
    console.error('[public/feedback/quick] error:', err)
    return redirectTo(`/book/status/${referenceNumber}?rate_error=server`)
  }
}
