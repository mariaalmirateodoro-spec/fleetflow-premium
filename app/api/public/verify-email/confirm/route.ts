import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function POST(request: NextRequest) {
  try {
    const { email, code } = await request.json()

    if (!email || !code) {
      return NextResponse.json({ error: 'Email and code are required.' }, { status: 400 })
    }

    const normalizedEmail = String(email).trim().toLowerCase()
    const normalizedCode = String(code).trim()

    const adminClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { cookies: { getAll: () => [], setAll: () => {} } }
    )

    // Calls a DB function via RPC instead of querying the table directly —
    // see supabase/patch_email_verification_rpc.sql for why.
    const { data: confirmed, error } = await adminClient.rpc('fleetflow_confirm_email_verification', {
      p_email: normalizedEmail,
      p_code: normalizedCode,
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (!confirmed) {
      return NextResponse.json({ error: 'Incorrect or expired code. Please try again or request a new one.' }, { status: 400 })
    }

    return NextResponse.json({ verified: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
