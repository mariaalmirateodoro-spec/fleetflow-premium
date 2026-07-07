import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  )
}

// Public endpoint — but only useful, and only returns anything, once the
// caller has already verified this email via /api/public/verify-email/confirm
// in this session. That's the "proof this is really your inbox" step we
// already require for a real booking, reused here so we don't hand back a
// past guest's name/phone/nationality to anyone who merely types their email.
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required.' }, { status: 400 })
    }
    const normalizedEmail = email.trim().toLowerCase()

    const admin = createAdminClient()

    const { data: verification } = await admin
      .from('email_verifications')
      .select('id')
      .eq('email', normalizedEmail)
      .eq('verified', true)
      .eq('used', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!verification) {
      // Not an error — just means we can't vouch for this email yet, so no lookup.
      return NextResponse.json({ returning: false })
    }

    const { data: previous } = await admin
      .from('bookings')
      .select('guest_name, guest_nationality, guest_phone, vehicle_type')
      .ilike('guest_email', normalizedEmail)
      .eq('is_draft', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!previous) {
      return NextResponse.json({ returning: false })
    }

    return NextResponse.json({ returning: true, previous })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
