import { NextRequest, NextResponse } from 'next/server'
import { desc, ilike, or } from 'drizzle-orm'
import { createClient, getUser } from '@/lib/supabase/server'
import { db, schema } from '@/lib/db'

// Staff-side "search a past guest" lookup — the equivalent of the
// returning-guest autofill that already exists on the public /book page
// (app/api/public/returning-guest), but for staff creating a booking on a
// guest's behalf. No email-verification gate here since the caller is
// already an authenticated staff member, not an anonymous guest.
//
// Talks directly to Postgres via Drizzle instead of PostgREST.
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    // Fast, cached check — middleware.ts already did the authoritative,
    // network-verified check for this request. See lib/supabase/server.ts.
    const user = await getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const q = new URL(request.url).searchParams.get('q')?.trim() ?? ''
    if (q.length < 2) return NextResponse.json({ data: [] })

    const like = `%${q}%`
    const rows = await db
      .select({
        guestName: schema.bookings.guestName,
        guestNationality: schema.bookings.guestNationality,
        guestPhone: schema.bookings.guestPhone,
        guestEmail: schema.bookings.guestEmail,
        guestLineId: schema.bookings.guestLineId,
        vehicleType: schema.bookings.vehicleType,
        createdAt: schema.bookings.createdAt,
      })
      .from(schema.bookings)
      .where(
        or(
          ilike(schema.bookings.guestName, like),
          ilike(schema.bookings.guestPhone, like),
          ilike(schema.bookings.guestEmail, like),
          ilike(schema.bookings.guestLineId, like)
        )
      )
      .orderBy(desc(schema.bookings.createdAt))
      .limit(30)

    // Dedupe to one row per guest (by email, falling back to phone), keeping
    // the most recent booking's details since that's the freshest info.
    const seen = new Set<string>()
    const guests: typeof rows = []
    for (const row of rows) {
      const key = (row.guestEmail || row.guestPhone || row.guestName || '').toLowerCase()
      if (!key || seen.has(key)) continue
      seen.add(key)
      guests.push(row)
      if (guests.length >= 8) break
    }

    const data = guests.map((row) => ({
      guest_name: row.guestName,
      guest_nationality: row.guestNationality,
      guest_phone: row.guestPhone,
      guest_email: row.guestEmail,
      guest_line_id: row.guestLineId,
      vehicle_type: row.vehicleType,
      created_at: row.createdAt,
    }))

    return NextResponse.json({ data })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
