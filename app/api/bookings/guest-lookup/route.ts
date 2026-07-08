import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Staff-side "search a past guest" lookup — the equivalent of the
// returning-guest autofill that already exists on the public /book page
// (app/api/public/returning-guest), but for staff creating a booking on a
// guest's behalf. No email-verification gate here since the caller is
// already an authenticated staff member, not an anonymous guest.
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const q = new URL(request.url).searchParams.get('q')?.trim() ?? ''
    if (q.length < 2) return NextResponse.json({ data: [] })

    const { data, error } = await supabase
      .from('bookings')
      .select('guest_name, guest_nationality, guest_phone, guest_email, guest_line_id, vehicle_type, created_at')
      .or(
        `guest_name.ilike.%${q}%,guest_phone.ilike.%${q}%,guest_email.ilike.%${q}%,guest_line_id.ilike.%${q}%`
      )
      .order('created_at', { ascending: false })
      .limit(30)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Dedupe to one row per guest (by email, falling back to phone), keeping
    // the most recent booking's details since that's the freshest info.
    const seen = new Set<string>()
    const guests: typeof data = []
    for (const row of data ?? []) {
      const key = (row.guest_email || row.guest_phone || row.guest_name || '').toLowerCase()
      if (!key || seen.has(key)) continue
      seen.add(key)
      guests.push(row)
      if (guests.length >= 8) break
    }

    return NextResponse.json({ data: guests })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
